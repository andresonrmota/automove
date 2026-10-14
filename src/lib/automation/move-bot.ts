import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { getFolderConfig, getAccessConfig } from '@/lib/config';
import { sendTelegramNotification, sendTelegramScreenshots } from './telegram';
import { captureFinalScreenshots } from './screenshots';

interface ProjectInfo {
  id: string;
  name: string;
  international: boolean;
}

/**
 * Repete uma checagem até ela retornar true ou o tempo esgotar.
 * Erros durante a checagem (ex.: tabela re-renderizando) são ignorados e a
 * checagem é refeita no próximo intervalo.
 */
async function waitForCondition(check: () => Promise<boolean>, timeoutMs: number, intervalMs = 500): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await check()) return true;
    } catch {
      // tenta de novo no próximo ciclo
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return false;
}

export async function runMoveAutomation(
  project: ProjectInfo | null,
  isContinuation: boolean,
  ignoreExistingCheck: boolean,
  targetPCId: string | null,
  onProgress?: (event: unknown) => void
) {
  const isInternational = project?.international ?? false;
  const log = (msg: string) => {
    console.log(msg);
    if (onProgress) onProgress({ type: 'log', message: msg });
  };

  const emitFileStatus = (fileName: string, status: 'pending' | 'processing' | 'success' | 'error', index: number, total: number) => {
    if (onProgress) onProgress({ type: 'file_status', fileName, status, index, total });
  };

  const { baseFolder } = await getFolderConfig();
  const access = await getAccessConfig();

  if (!baseFolder) {
    throw new Error('Pasta Base não configurada nas definições.');
  }

  const uploadsDir = path.join(baseFolder, 'Triados');
  const processedDir = path.join(baseFolder, 'Processados');

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir, { recursive: true });
  }

  // --- 1. DIAGNÓSTICO PRÉVIO (PRE-FLIGHT CHECK) ---
  const files = fs.readdirSync(uploadsDir).filter((f: string) =>
    !f.startsWith('.') && 
    (f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.pdf'))
  );

  if (files.length === 0) {
    log('[AutoMove] ℹ️ Nenhum arquivo encontrado para processar.');
    return { success: true, message: 'Nenhum arquivo encontrado' };
  }

  log(`[AutoMove] 📂 Encontrados ${files.length} arquivos para processar. Iniciando Diagnóstico...`);

  const errors: string[] = [];
  const dailyMealData: Record<string, { total: number, files: string[] }> = {};
  const monthlyLaundryData: Record<string, { total: number, files: string[] }> = {};
  const year = new Date().getFullYear();

  for (const fileName of files) {
    try {
      const typeChar = fileName.substring(0, 2).toUpperCase();
      const dayStr = fileName.substring(2, 4);
      const monthStr = fileName.substring(4, 6);
      const yearStr = fileName.substring(6, 8);
      const day = parseInt(dayStr, 10);
      const month = parseInt(monthStr, 10);
      const parsedYear = parseInt(`20${yearStr}`, 10);
      const expenseYear = isNaN(parsedYear) ? year : parsedYear;
      const rawValue = fileName.substring(8, 13);
      
      const expenseDate = `${dayStr}/${monthStr}/${expenseYear}`;
      const dateKey = `${dayStr}/${monthStr}`;

      // Regra dos 60 dias
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const limitDate = new Date(today);
      limitDate.setDate(today.getDate() - 60);
      
      const expenseDateObj = new Date(expenseYear, month - 1, day);
      
      if (expenseDateObj < limitDate) {
        errors.push(`Documentos ${fileName} não pode ser enviado por que a MV não aceita nota com data de emissão anterior a 60 dias`);
        continue;
      }

      if (day < 1 || day > 31 || month < 1 || month > 12) {
        errors.push(`Data inválida no arquivo "${fileName}" (${dayStr}/${monthStr}).`);
        continue;
      }

      const valueNumeric = parseFloat(`${parseInt(rawValue.substring(0, 3), 10)}.${rawValue.substring(3, 5)}`);

      if (typeChar === 'AL') {
        if (!isInternational) {
          if (valueNumeric > 40) {
            errors.push(`A MV estabelece como valor diário máximo para refeição de R$ 40,00. Seu arquivo ${fileName} informa R$ ${valueNumeric.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em ${expenseDate}.`);
          }
          if (!dailyMealData[dateKey]) {
            dailyMealData[dateKey] = { total: 0, files: [] };
          }
          dailyMealData[dateKey].total += valueNumeric;
          dailyMealData[dateKey].files.push(fileName);
        }
      }

      if (typeChar === 'LV') {
        const monthKey = `${monthStr}/${expenseYear}`;
        if (!monthlyLaundryData[monthKey]) {
          monthlyLaundryData[monthKey] = { total: 0, files: [] };
        }
        monthlyLaundryData[monthKey].total += valueNumeric;
        monthlyLaundryData[monthKey].files.push(fileName);

        if (valueNumeric > 250) {
          errors.push(`O limite mensal estabelecido para despesas de Lavanderia é de R$ 250,00. Seu arquivo ${fileName} informa R$ ${valueNumeric.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`);
        }
      }
    } catch (e) {
      errors.push(`Erro ao interpretar o arquivo "${fileName}". Verifique o padrão de nome.`);
    }
  }

  // Validação da somatória diária
  for (const dateKey in dailyMealData) {
    const data = dailyMealData[dateKey];
    if (data.total > 40 && data.files.length > 1) {
      const fileList = data.files.join(' e ');
      const expenseDate = `${dateKey}/${year}`;
      errors.push(`A MV estabelece como valor diário máximo para refeição de R$ 40,00. Os arquivos ${fileList}, juntos, somam R$ ${data.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em alimentação em ${expenseDate}.`);
    }
  }

  // Validação da somatória mensal de lavanderia
  for (const monthKey in monthlyLaundryData) {
    const data = monthlyLaundryData[monthKey];
    if (data.total > 250 && data.files.length > 1) {
      const fileList = data.files.join(' e ');
      errors.push(`O limite mensal para Lavanderia é de R$ 250,00. Os arquivos ${fileList}, juntos, somam R$ ${data.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no mês ${monthKey}.`);
    }
  }

  if (errors.length > 0) {
    log('[AutoMove] ❌ Diagnóstico reprovado. Automação interrompida.');
    return {
      success: false,
      error: 'Falha no Diagnóstico Prévio',
      details: errors
    };
  }

  log('[AutoMove] ✅ Diagnóstico aprovado! Abrindo portal...');

  const launchOptions: any = {
    headless: access.headless,
    slowMo: 50
  };

  if (process.platform === 'win32') {
    if (fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe') || 
        fs.existsSync('C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe')) {
      launchOptions.channel = 'chrome';
    } else if (fs.existsSync('C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe') || 
               fs.existsSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe')) {
      launchOptions.channel = 'msedge';
    }
  } else if (process.platform === 'darwin') {
    if (fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')) {
      launchOptions.executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    } else if (fs.existsSync('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge')) {
      launchOptions.executablePath = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
    }
  }

  // Usar profile temporário para forçar uma nova instância isolada
  const crypto = require('crypto');
  const os = require('os');
  const tempProfilePath = path.join(os.tmpdir(), `automove-pw-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
  
  const context = await chromium.launchPersistentContext(tempProfilePath, {
    ...launchOptions,
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  });
  
  // Guardamos o contexto na variavel browser para podermos fechar depois, 
  // já que o código original faz browser.close() no final
  const browser = context;

  const page = await context.newPage();

  try {
    try {
      log('[AutoMove] 🌐 Acessando portal MOVE...');
      await page.goto('https://move.mv.com.br/', { waitUntil: 'networkidle', timeout: 45000 });
    } catch (e: any) {
      return {
        success: false,
        error: 'CONNECTION_FAILED',
        details: ['O site da MV (portal MOVE) não respondeu ou está fora do ar no momento. A automação não pôde ser iniciada. Tente novamente mais tarde.']
      };
    }

    // 1. LOGIN
    log('[AutoMove] 🔑 Realizando login...');
    
    // Usuário
    const userField = page.locator('input.MuiOutlinedInput-input').nth(0);
    await userField.waitFor({ state: 'visible', timeout: 10000 });
    await userField.click();
    await page.keyboard.type(access.user, { delay: 100 });

    // Senha
    const passField = page.locator('input[type="password"]');
    await passField.click();
    await page.keyboard.type(access.pass, { delay: 100 });

    // Empresa (MV) - O portal costuma vir com MV, mas vamos garantir
    const companySelect = page.locator('#demo-simple-select-outlined');
    if (await companySelect.isVisible()) {
      await companySelect.click();
      const mvOption = page.locator('li[role="option"]:has-text("MV")');
      await mvOption.waitFor({ state: 'visible' });
      await mvOption.click();
    }

    // Botão Entrar
    log('[AutoMove] 🖱️ Clicando em Entrar...');
    const loginButton = page.locator('button.MuiButton-contained');
    await loginButton.click();

    // Aguardar redirect OU mensagem de erro de credencial
    const loginOutcome = await Promise.race([
      page.waitForURL('**/site**', { timeout: 20000 }).then(() => 'success' as const),
      page.waitForSelector('text="Usuário ou senha inválidos"', { timeout: 20000 }).then(() => 'invalid_credentials' as const),
    ]).catch(() => 'timeout' as const);

    if (loginOutcome === 'invalid_credentials') {
      return {
        success: false,
        error: 'INVALID_CREDENTIALS',
        details: ['Usuário ou senha inválidos. Verifique as credenciais em Configurações → Acesso ao MOVE.'],
      };
    }

    if (loginOutcome === 'timeout') {
      return {
        success: false,
        error: 'LOGIN_TIMEOUT',
        details: ['O portal MOVE demorou demais para responder. Verifique sua conexão e tente novamente.'],
      };
    }

    log('[AutoMove] ✅ Login realizado com sucesso.');

    // 2. NAVEGAÇÃO PARA PRESTAÇÃO DE CONTAS
    log('[AutoMove] 📂 Navegando para Prestação de Contas...');
    
    // Tentar clicar no menu lateral
    const menuPrestacao = page.locator('text="Prestação de Contas"').first();
    await menuPrestacao.waitFor({ state: 'visible' });
    await menuPrestacao.click();

    // 3. AGUARDAR 7 SEGUNDOS
    log('[AutoMove] ⏳ Aguardando 7 segundos para carregamento total...');
    await page.waitForTimeout(7000);

    // 4. VERIFICAÇÃO DE PRESTAÇÕES PENDENTES E SELEÇÃO DE FLUXO
    log('[AutoMove] 📋 Verificando tabela de prestações pendentes...');
    const rows = page.locator('table tbody tr, table tr:has(td)');
    
    let hasTableRows = false;
    try {
      await rows.first().waitFor({ state: 'visible', timeout: 5000 });
      hasTableRows = true;
    } catch {
      log('[AutoMove] ℹ️ Nenhuma prestação de contas pendente encontrada na listagem.');
    }

    const matchingReports: { id: string; project: string; value: string; rowIndex: number }[] = [];

    if (hasTableRows) {
      const rowCount = await rows.count();
      log(`[AutoMove] 📋 Encontradas ${rowCount} prestações de contas na listagem.`);

      for (let r = 0; r < rowCount; r++) {
        const row = rows.nth(r);
        const cells = row.locator('td');
        const cellCount = await cells.count();

        if (cellCount >= 5) {
          const projectText = (await cells.nth(4).innerText()).trim();
          const pcId = (await cells.nth(1).innerText()).trim();
          const pcValue = cellCount >= 8 ? (await cells.nth(7).innerText()).trim() : '';

          if (project?.name) {
            const normTableProj = projectText.toLowerCase().replace(/\s+/g, ' ');
            const normSelectedProj = project.name.toLowerCase().replace(/\s+/g, ' ');

            if (normTableProj.includes(normSelectedProj) || normSelectedProj.includes(normTableProj)) {
              matchingReports.push({ id: pcId, project: projectText, value: pcValue, rowIndex: r });
            }
          }
        }
      }
    }

    if (isContinuation) {
      // --- MODO CONTINUIDADE ---
      if (matchingReports.length === 0) {
        throw new Error(`Não foi encontrada nenhuma prestação de contas pendente associada ao projeto "${project?.name || ''}" no portal MOVE. Verifique se o projeto selecionado é o correto.`);
      }

      let targetRowIndex = -1;
      let matchedProjectName = '';
      let matchedPCId = '';

      if (targetPCId) {
        // Lançar na prestação específica escolhida no modal
        const found = matchingReports.find(r => r.id === targetPCId);
        if (found) {
          targetRowIndex = found.rowIndex;
          matchedProjectName = found.project;
          matchedPCId = found.id;
        } else {
          throw new Error(`A prestação ${targetPCId} selecionada não foi encontrada ou não pertence ao projeto "${project?.name}".`);
        }
      } else {
        // Se ativado manualmente de início, escolhemos a mais recente (primeira da lista)
        const found = matchingReports[0];
        targetRowIndex = found.rowIndex;
        matchedProjectName = found.project;
        matchedPCId = found.id;
      }

      log(`[AutoMove] 🖱️ Abrindo prestação de contas pendente ${matchedPCId} para o projeto "${matchedProjectName}"...`);
      const actionCell = rows.nth(targetRowIndex).locator('td').first();
      const viewButton = actionCell.locator('img[alt="detalhes"], img[src*="search"]').first();
      await viewButton.waitFor({ state: 'visible', timeout: 5000 });
      await viewButton.click();

      // Aguardar a tela de lançamentos carregar
      log('[AutoMove] ⏳ Aguardando carregamento da tela de lançamentos...');
      await page.waitForTimeout(5000);
    } else {
      // --- MODO CRIAÇÃO DO ZERO ---
      if (!ignoreExistingCheck && matchingReports.length > 0) {
        log(`[AutoMove] ⚠️ Encontradas ${matchingReports.length} prestações pendentes para este projeto.`);
        return {
          success: false,
          error: 'PENDING_REPORT_FOUND',
          details: matchingReports.map(r => ({ id: r.id, project: r.project, value: r.value }))
        };
      }

      log('[AutoMove] ➕ Clicando em Nova Prestação de Contas...');
      const newReportButton = page.locator('text="Nova prestação de contas"').first();
      
      try {
        await newReportButton.waitFor({ state: 'visible', timeout: 8000 });
        await newReportButton.click();
      } catch {
        log('[AutoMove] ⚠️ Botão por texto não encontrado, tentando seletor alternativo...');
        await page.locator('button:has-text("Nova prestação de contas")').first().click();
      }

      log('[AutoMove] ⏳ Aguardando carregamento do formulário...');
      await page.waitForTimeout(3000);
    }

    // --- 3. ORDENAÇÃO E PROCESSAMENTO ---
    log('[AutoMove] 📂 Iniciando ordenação e processamento...');

    // Ordenação Cronológica (DDMM)
    files.sort((a, b) => {
      const dayA = parseInt(a.substring(1, 3), 10);
      const monthA = parseInt(a.substring(3, 5), 10);
      const dayB = parseInt(b.substring(1, 3), 10);
      const monthB = parseInt(b.substring(3, 5), 10);
      
      if (monthA !== monthB) return monthA - monthB;
      return dayA - dayB;
    });

    // Notificar lista inicial
    files.forEach((f, idx) => emitFileStatus(f, 'pending', idx, files.length));

    const results: any[] = [];
    let totalValue = 0;
    let processedCount = 0;

    const metadataPath = path.join(uploadsDir, 'metadata.json');
    let metadataStore: Record<string, string> = {};
    if (fs.existsSync(metadataPath)) {
      try { metadataStore = JSON.parse(fs.readFileSync(metadataPath, 'utf8')); } catch(e){}
    }

    for (let i = 0; i < files.length; i++) {
      const fileName = files[i];
      const filePath = path.join(uploadsDir, fileName);
      const isFirstDocument = i === 0;

      emitFileStatus(fileName, 'processing', i, files.length);
      log(`\n[AutoMove] 🔄 [${i + 1}/${files.length}] Processando: ${fileName}`);

      // PARSER: [TIPO][DDMMYY][VALOR]...
      const typeChar = fileName.substring(0, 2).toUpperCase();
      const day = fileName.substring(2, 4);
      const month = fileName.substring(4, 6);
      const yearStr = fileName.substring(6, 8);
      const rawValue = fileName.substring(8, 13);
      const currentYear = new Date().getFullYear();
      const parsedYear = parseInt(`20${yearStr}`, 10);
      const expenseYearNum = isNaN(parsedYear) ? currentYear : parsedYear;
      const expenseDate = `${day}/${month}/${expenseYearNum}`;

      const valueInteger = parseInt(rawValue.substring(0, 3), 10);
      const valueCents = rawValue.substring(3, 5);
      const expenseValueStr = `${valueInteger},${valueCents}`;
      const expenseValueNumeric = parseFloat(`${valueInteger}.${valueCents}`);

      const typeMapping: Record<string, string> = {
        'AL': 'Alimentação',
        'BG': 'Bagagem',
        'CB': 'Combustível',
        'ES': 'Estacionamento',
        'LV': 'Lavanderia',
        'PG': 'Pedágio',
        'TA': 'Taxi APP',
        'TU': 'Transportes Urbanos'
      };

      const expenseType = typeMapping[typeChar] || 'Alimentação';
      log(`[AutoMove] 🔍 Tipo: ${expenseType}, Data: ${expenseDate}, Valor: R$ ${expenseValueStr}`);

      try {
        // 5. PREENCHIMENTO DO FORMULÁRIO
        if (isFirstDocument) {
          if (isContinuation) {
            log('[AutoMove] ⏩ Modo continuidade ativo: Pulando a seleção do Projeto.');
            // Aguardar um momento para garantir que o formulário de inclusão carregue e campos estejam prontos
            await page.waitForTimeout(2000);
          } else {
            log(`[AutoMove] 🏢 Selecionando Projeto: "${project?.name ?? '(nenhum)'}"...`);
            const projectContainer = page.locator('div:has(> label:has-text("Projeto"))').first();
            const projectInput = projectContainer.locator('input').first();
            await projectInput.waitFor({ state: 'visible', timeout: 10000 });
            await projectInput.click();
            await projectInput.fill('');
            await page.waitForTimeout(500);

            if (project?.name) {
              // Digita o nome aos poucos para acionar o autocomplete
              await projectInput.type(project.name, { delay: 50 });
              await page.waitForTimeout(2000);

              // Tenta encontrar a opção pelo texto — múltiplos seletores MUI
              const optionSelectors = [
                `li[role="option"]:has-text("${project.name}")`,
                `[role="option"]:has-text("${project.name}")`,
                `.MuiAutocomplete-option:has-text("${project.name}")`,
                `li[role="option"]`,
                `[role="option"]`,
                `.MuiAutocomplete-option`,
              ];

              let clicked = false;
              for (const sel of optionSelectors) {
                try {
                  const opt = page.locator(sel).first();
                  await opt.waitFor({ state: 'visible', timeout: 4000 });
                  await opt.click();
                  clicked = true;
                  log(`[AutoMove] ✅ Opção selecionada via: ${sel}`);
                  break;
                } catch {
                  // tenta o próximo seletor
                }
              }

              // Fallback: navegar com teclado se nenhum seletor funcionou
              if (!clicked) {
                log('[AutoMove] ⚠️ Dropdown não encontrado via seletor — usando teclado (ArrowDown + Enter)');
                await page.keyboard.press('ArrowDown');
                await page.waitForTimeout(600);
                await page.keyboard.press('Enter');
              }
            } else {
              await page.keyboard.press('ArrowDown');
              await page.waitForTimeout(800);
              await page.keyboard.press('Enter');
            }

            await page.waitForTimeout(1500);
            log('[AutoMove] ✅ Projeto selecionado.');
          }
        } else {
          log('[AutoMove] ⏩ Pulando seleção de Projeto (já preenchido).');
        }

        // ITEM DE DESPESA
        log(`[AutoMove] 🍴 Selecionando item: ${expenseType}`);
        const itemContainer = page.locator('div:has(> label:has-text("Item de despesa"))').first();
        const itemInput = itemContainer.locator('input').first();
        await itemInput.waitFor({ state: 'visible', timeout: 15000 });
        
        let isDisabled = true;
        let retries = 0;
        while (isDisabled && retries < 15) {
          isDisabled = await itemInput.evaluate((el) => (el as HTMLInputElement).disabled);
          if (isDisabled) {
            await page.waitForTimeout(1000);
            retries++;
          }
        }

        log('[AutoMove] ⌨️ Digitando item...');
        await itemInput.click();
        await itemInput.fill('');
        
        let currentType = expenseType.substring(0, 6);
        await page.keyboard.type(currentType, { delay: 100 });
        
        // Espera a lista carregar e aperta Enter
        await page.waitForTimeout(4000);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);

        // DATA DA DESPESA
        log(`[AutoMove] 📅 Preenchendo data: ${expenseDate}`);
        const dateInput = page.locator('label:has-text("Data da despesa") + div input, input[name="expenseDate"], input[type="date"]').first();
        const inputType = await dateInput.getAttribute('type');
        if (inputType === 'date') {
          await dateInput.fill(`${expenseYearNum}-${month}-${day}`);
        } else {
          await dateInput.fill(expenseDate);
        }
        await page.keyboard.press('Tab');

        // VALOR APONTADO
        const valueInput = page.locator('label:has-text("Valor apontado") + div input, input[name="value"], input[placeholder*="R$"]').first();
        await valueInput.click();
        await page.keyboard.type(expenseValueStr, { delay: 50 });
        await page.keyboard.press('Tab');

        // DESCRIÇÃO
        const descInput = page.locator('label:has-text("Descrição") + div textarea, label:has-text("Descrição") + div input, textarea[name="description"]').first();
        await descInput.waitFor({ state: 'visible', timeout: 10000 });
        await descInput.click();
        const customDescription = metadataStore[fileName];
        const finalDescription = customDescription || `DESPESA COM ${expenseType.toUpperCase()}`;
        await descInput.fill(finalDescription);
        await page.waitForTimeout(1000);

        // ANEXO
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(filePath);
        await page.waitForTimeout(2000); 

        // ESTADO DA TABELA ANTES DE INCLUIR (para confirmar depois que uma linha NOVA apareceu)
        const tableRows = page.locator('table tbody tr, table tr:has(td)');
        const valueCells = page.locator('table td', { hasText: expenseValueStr });
        const rowsBefore = await tableRows.count();
        const valueMatchesBefore = await valueCells.count();

        // INCLUIR
        const includeButton = page.locator('button:has-text("Incluir despesa"), button:has-text("Incluir")').first();
        await includeButton.click();

        // NOVO: Clique no pop-up de "Ok" (Despesa incluída...)
        log('[AutoMove] 🆗 Confirmando pop-up de sucesso...');
        const okButton = page.locator('button:has-text("Ok")').first();
        try {
          await okButton.waitFor({ state: 'visible', timeout: 8000 });
          await okButton.click();
          await page.waitForTimeout(1000);
        } catch {
          log('[AutoMove] ⚠️ Pop-up "Ok" não apareceu ou já fechou.');
        }

        // VERIFICAÇÃO NA TABELA (obrigatória: sem confirmação a nota é tratada como NÃO lançada)
        log('[AutoMove] ⏳ Confirmando na tabela...');
        const confirmed = await waitForCondition(async () => {
          const rowsNow = await tableRows.count();
          const valueMatchesNow = await valueCells.count();
          return valueMatchesNow > valueMatchesBefore || (rowsNow > rowsBefore && valueMatchesNow > 0);
        }, 20000);

        if (!confirmed) {
          throw new Error(
            `Lançamento NÃO confirmado: nenhuma linha nova com o valor R$ ${expenseValueStr} apareceu na tabela do Move em 20s. ` +
            'O arquivo permaneceu em Triados para nova tentativa.'
          );
        }
        log('[AutoMove] ✅ Lançamento confirmado na tabela!');

        // MOVER PARA PROCESSADOS
        const destinationPath = path.join(processedDir, fileName);
        fs.renameSync(filePath, destinationPath);
        log(`[AutoMove] 📁 Arquivo movido para: processed/${fileName}`);
        emitFileStatus(fileName, 'success', i, files.length);
        
        results.push({
          file: fileName,
          type: expenseType,
          value: expenseValueStr,
          date: expenseDate,
          status: 'success'
        });
        totalValue += expenseValueNumeric;
        processedCount++;

      } catch (fileError: unknown) {
        const errorMessage = fileError instanceof Error ? fileError.message : String(fileError);
        log(`[AutoMove] ❌ Falha no arquivo ${fileName}: ${errorMessage}`);
        emitFileStatus(fileName, 'error', i, files.length);
        try {
          const errorsDir = path.join(baseFolder, 'Erros');
          if (!fs.existsSync(errorsDir)) fs.mkdirSync(errorsDir, { recursive: true });
          await page.screenshot({ path: path.join(errorsDir, `erro_${Date.now()}_${fileName}.png`) });
        } catch (screenshotErr) {
          console.error('[AutoMove] Não foi possível salvar o print do erro:', screenshotErr);
        }
        results.push({
          file: fileName,
          status: 'error',
          message: errorMessage
        });
      }
    }

    // Prints da tela final para confirmação visual no Telegram
    const finalScreenshots = await captureFinalScreenshots(page, log);

    if (!access.headless) {
      await page.waitForTimeout(5000);
    }

    const finalReport = {
      items: results,
      total: totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      count: processedCount
    };

    // Disparar notificação do Telegram
    try {
      log('[AutoMove] 📱 Enviando notificação para o Telegram...');
      await sendTelegramNotification(finalReport, project?.name);
      log('[AutoMove] 📬 Notificação processada com sucesso.');

      if (finalScreenshots.length > 0) {
        try {
          log(`[AutoMove] 📸 Enviando ${finalScreenshots.length} print(s) de confirmação para o Telegram...`);
          await sendTelegramScreenshots(finalScreenshots, project?.name);
          log('[AutoMove] 🖼️ Prints de confirmação enviados.');
        } catch (screenshotErr) {
          log('[AutoMove] ⚠️ Resumo enviado, mas não foi possível enviar os prints de confirmação pelo Telegram.');
          console.error('[AutoMove] Erro ao enviar prints:', screenshotErr);
        }
      } else {
        log('[AutoMove] ⚠️ Nenhum print da tela final pôde ser capturado.');
      }
    } catch (telegramErr) {
      log('[AutoMove] ⚠️ Não foi possível enviar notificação pelo Telegram (Falha de rede/configuração).');
      console.error('[AutoMove] Erro no telegram:', telegramErr);
    }

    return { 
      success: true, 
      message: `Processamento concluído: ${processedCount} de ${files.length} arquivos lançados.`,
      report: finalReport
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[AutoMove] ❌ Erro crítico na automação:', errorMessage);
    throw error;
  } finally {
    if (access.headless) {
      await browser.close();
    }
  }
}
