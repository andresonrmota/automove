import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { getFolderConfig, getAccessConfig } from '@/lib/config';

interface ProjectInfo {
  id: string;
  name: string;
  international: boolean;
}

export async function runMoveAutomation(project: ProjectInfo | null, onProgress?: (event: unknown) => void) {
  const isInternational = project?.international ?? false;
  const log = (msg: string) => {
    console.log(msg);
    if (onProgress) onProgress({ type: 'log', message: msg });
  };

  const emitFileStatus = (fileName: string, status: 'pending' | 'processing' | 'success' | 'error', index: number, total: number) => {
    if (onProgress) onProgress({ type: 'file_status', fileName, status, index, total });
  };

  const { triados: uploadsDir, concluidos: processedDir } = getFolderConfig();
  const access = getAccessConfig();

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
  const year = new Date().getFullYear();

  for (const fileName of files) {
    try {
      const typeChar = fileName[0].toUpperCase();
      const dayStr = fileName.substring(1, 3);
      const monthStr = fileName.substring(3, 5);
      const day = parseInt(dayStr, 10);
      const month = parseInt(monthStr, 10);
      const rawValue = fileName.substring(5, 10);
      
      const expenseDate = `${dayStr}/${monthStr}/${year}`;
      const dateKey = `${dayStr}/${monthStr}`;

      // Regra dos 60 dias
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const limitDate = new Date(today);
      limitDate.setDate(today.getDate() - 60);
      
      const expenseDateObj = new Date(year, month - 1, day);
      
      if (expenseDateObj < limitDate) {
        errors.push(`Documentos ${fileName} não pode ser enviado por que a MV não aceita nota com data de emissão anterior a 60 dias`);
        continue;
      }

      if (day < 1 || day > 31 || month < 1 || month > 12) {
        errors.push(`Data inválida no arquivo "${fileName}" (${dayStr}/${monthStr}).`);
        continue;
      }

      const valueNumeric = parseFloat(`${parseInt(rawValue.substring(0, 3), 10)}.${rawValue.substring(3, 5)}`);

      if (typeChar === 'A' || typeChar === 'S') {
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

  if (errors.length > 0) {
    log('[AutoMove] ❌ Diagnóstico reprovado. Automação interrompida.');
    return {
      success: false,
      error: 'Falha no Diagnóstico Prévio',
      details: errors
    };
  }

  log('[AutoMove] ✅ Diagnóstico aprovado! Abrindo portal...');

  // --- 2. INICIALIZAÇÃO DO BROWSER ---
  const browser = await chromium.launch({
    headless: access.headless,
    slowMo: 50
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    log('[AutoMove] 🌐 Acessando portal MOVE...');
    await page.goto('https://move.mv.com.br/', { waitUntil: 'networkidle' });

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

    // 4. CLICAR EM NOVA PRESTAÇÃO DE CONTAS
    log('[AutoMove] ➕ Clicando em Nova Prestação de Contas...');
    const newReportButton = page.locator('text="Nova prestação de contas"').first();
    
    try {
      await newReportButton.waitFor({ state: 'visible', timeout: 5000 });
      await newReportButton.click();
    } catch {
      log('[AutoMove] ⚠️ Botão por texto não encontrado, tentando seletor alternativo...');
      await page.locator('button:has-text("Nova prestação de contas")').click();
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

    for (let i = 0; i < files.length; i++) {
      const fileName = files[i];
      const filePath = path.join(uploadsDir, fileName);
      const isFirstDocument = i === 0;

      emitFileStatus(fileName, 'processing', i, files.length);
      log(`\n[AutoMove] 🔄 [${i + 1}/${files.length}] Processando: ${fileName}`);

      // PARSER: [TIPO][DDMM][VALOR]...
      const typeChar = fileName[0].toUpperCase();
      const day = fileName.substring(1, 3);
      const month = fileName.substring(3, 5);
      const rawValue = fileName.substring(5, 10);
      const year = new Date().getFullYear();
      const expenseDate = `${day}/${month}/${year}`;

      const valueInteger = parseInt(rawValue.substring(0, 3), 10);
      const valueCents = rawValue.substring(3, 5);
      const expenseValueStr = `${valueInteger},${valueCents}`;
      const expenseValueNumeric = parseFloat(`${valueInteger}.${valueCents}`);

      const typeMapping: Record<string, string> = {
        'A': 'Alimentação - OK',
        'T': 'Transportes Urbanos - OK',
        'S': 'Alimentação - OK',
        'H': 'Hospedagem - OK',
        'L': 'Lavanderia - OK',
        'E': 'Estacionamento - OK'
      };

      const expenseType = typeMapping[typeChar] || 'Alimentação - OK';
      log(`[AutoMove] 🔍 Tipo: ${expenseType}, Data: ${expenseDate}, Valor: R$ ${expenseValueStr}`);

      try {
        // 5. PREENCHIMENTO DO FORMULÁRIO
        if (isFirstDocument) {
          log(`[AutoMove] 🏢 Selecionando Projeto: "${project?.name ?? '(nenhum)'}"...`);
          const projectContainer = page.locator('div:has(> label:has-text("Projeto"))').first();
          const projectInput = projectContainer.locator('input').first();
          await projectInput.waitFor({ state: 'visible', timeout: 10000 });
          await projectInput.click();
          await projectInput.fill('');
          await page.waitForTimeout(500);

          if (project?.name) {
            await projectInput.type(project.name, { delay: 40 });
            await page.waitForTimeout(1200);
            const matchingOption = page.locator(`[role="option"]:has-text("${project.name}")`).first();
            const fallbackOption = page.locator('[role="option"], .MuiAutocomplete-option').first();
            const option = (await matchingOption.count()) > 0 ? matchingOption : fallbackOption;
            await option.waitFor({ state: 'visible', timeout: 5000 });
            await option.click();
          } else {
            await page.keyboard.press('ArrowDown');
            await page.waitForTimeout(800);
            const firstOption = page.locator('[role="option"], .MuiAutocomplete-option').first();
            await firstOption.waitFor({ state: 'visible', timeout: 5000 });
            await firstOption.click();
          }

          await page.waitForTimeout(1500);
          log('[AutoMove] ✅ Projeto selecionado.');
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
          await dateInput.fill(`${year}-${month}-${day}`);
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
        await descInput.fill(`DESPESA COM ${expenseType.toUpperCase()}`);
        await page.waitForTimeout(1000);

        // ANEXO
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(filePath);
        await page.waitForTimeout(2000); 

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

        // VERIFICAÇÃO NA TABELA
        log('[AutoMove] ⏳ Confirmando na tabela...');
        try {
          const tableRow = page.locator(`table >> text="${expenseValueStr}"`).first();
          await tableRow.waitFor({ state: 'visible', timeout: 8000 });
          log('[AutoMove] ✅ Lançamento confirmado!');
        } catch {
          await page.waitForTimeout(4000);
        }

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
        console.error(`[AutoMove] ❌ Falha no arquivo ${fileName}:`, errorMessage);
        await page.screenshot({ path: `error_${fileName}.png` });
        results.push({
          file: fileName,
          status: 'error',
          message: errorMessage
        });
      }
    }

    if (!access.headless) {
      await page.waitForTimeout(5000);
    }

    return { 
      success: true, 
      message: `Processamento concluído: ${processedCount} de ${files.length} arquivos lançados.`,
      report: {
        items: results,
        total: totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        count: processedCount
      }
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
