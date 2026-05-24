import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './LoginForm.module.css';
import TriageForm from '../TriageForm/TriageForm';
import ConfirmModal from '../ConfirmModal/ConfirmModal';

export default function LoginForm() {
  const [activeTab, setActiveTab] = useState<'triage' | 'automation'>('triage');
  const [foldersConfigured, setFoldersConfigured] = useState<boolean | null>(null);
  const [projects, setProjects] = useState<{ id: string; name: string; international: boolean }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [accessUser, setAccessUser] = useState('');
  const [accessHeadless, setAccessHeadless] = useState(true);
  const [accessConfigured, setAccessConfigured] = useState<boolean | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [report, setReport] = useState<any>(null);
  const [diagnosticErrors, setDiagnosticErrors] = useState<string[]>([]);
  const [automationFiles, setAutomationFiles] = useState<any[]>([]);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [previewItems, setPreviewItems] = useState<any[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        const { novos, triados, concluidos } = data.folders ?? {};
        setFoldersConfigured(!!(novos && triados && concluidos));
        const list = data.projects ?? [];
        setProjects(list);
        const acc = data.access ?? {};
        setAccessUser(acc.user ?? '');
        setAccessHeadless(acc.headless ?? true);
        setAccessConfigured(!!(acc.user && acc.pass));
      })
      .catch(() => setFoldersConfigured(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/automation/preview');
      const data = await res.json();
      setPreviewItems(data.items ?? []);
    } catch {
      setPreviewItems([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirm = async () => {
    setPreviewItems(null);
    setStatus('running');
    setMessage('Iniciando conexão com o servidor...');
    setReport(null);
    setDiagnosticErrors([]);
    setAutomationFiles([]);
    setConsoleLogs([]);

    try {
      const selectedProject = projects.find(p => p.id === selectedProjectId) ?? null;
      const response = await fetch('/api/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: selectedProject }),
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            
            if (data.type === 'log') {
              const msg = data.message;
              setConsoleLogs(prev => [...prev, msg].slice(-3));
              setMessage(msg);
            }

            if (data.type === 'file_status') {
              setAutomationFiles(prev => {
                const existing = prev.findIndex(f => f.name === data.fileName);
                if (existing >= 0) {
                  const updated = [...prev];
                  updated[existing] = { name: data.fileName, status: data.status };
                  return updated;
                }
                return [...prev, { name: data.fileName, status: data.status }];
              });
            }

            if (data.status === 'success') {
              setStatus('success');
              setMessage('Automação concluída com sucesso!');
              if (data.report) setReport(data.report);
            } else if (data.status === 'error') {
              setStatus('error');
              const isCredentialError = data.message?.includes('INVALID_CREDENTIALS') || data.details?.[0]?.includes('Usuário ou senha inválidos');
              const isTimeoutError = data.message?.includes('LOGIN_TIMEOUT') || data.details?.[0]?.includes('demorou demais');
              if (isCredentialError) {
                setMessage('CREDENTIAL_ERROR');
              } else if (isTimeoutError) {
                setMessage(data.details?.[0] || 'Portal MOVE não respondeu.');
              } else {
                setMessage(data.message || 'Erro na automação.');
                if (data.details) setDiagnosticErrors(data.details);
              }
            }
          } catch (err) {
            console.error('Erro ao processar linha de log:', err);
          }
        }
      }
    } catch (err) {
      setStatus('error');
      setMessage('Falha na conexão com o servidor.');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.headerRow}>
            <div className={styles.logo}>
              <img src="/logo.png" alt="AutoMove Logo" className={styles.logoImage} />
              <h1 className={styles.title}>AutoMove</h1>
            </div>
            <Link href="/settings" className={styles.settingsLink} title="Configurações">
              ⚙
            </Link>
          </div>
          <p className={styles.subtitle}>Automação de Prestação de Contas</p>
        </div>

        {foldersConfigured === false && (
          <div className={styles.configWarning}>
            <span className={styles.configWarningIcon}>⚠️</span>
            <div>
              <strong>Configure as pastas de trabalho antes de continuar.</strong>
              <p>Acesse <Link href="/settings" className={styles.configWarningLink}>Configurações</Link> e defina as 3 pastas do fluxo.</p>
            </div>
          </div>
        )}

        <div className={styles.tabs} style={foldersConfigured === false ? { pointerEvents: 'none', opacity: 0.35 } : undefined}>
          <button 
            className={`${styles.tabButton} ${activeTab === 'triage' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('triage')}
          >
            1. Preparar Recibos
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'automation' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('automation')}
          >
            2. Lançar no MOVE
          </button>
        </div>

        {activeTab === 'triage' && <TriageForm />}

        {activeTab === 'automation' && (
          <>
            <form className={styles.form} onSubmit={handleLogin}>
              {accessConfigured === false ? (
                <div className={styles.configWarning}>
                  <span className={styles.configWarningIcon}>⚠️</span>
                  <div>
                    <strong>Acesso ao MOVE não configurado.</strong>
                    <p>Vá em <Link href="/settings/acesso" className={styles.configWarningLink}>Configurações → Acesso ao MOVE</Link> e informe suas credenciais.</p>
                  </div>
                </div>
              ) : accessConfigured === true && (
                <div className={styles.accessCard}>
                  <div className={styles.accessInfo}>
                    <span className={styles.accessIcon}>👤</span>
                    <span className={styles.accessUser}>{accessUser}</span>
                  </div>
                  <div className={styles.accessMode}>
                    <span className={`${styles.modeDot} ${accessHeadless ? styles.modeSilent : styles.modeVisible}`} />
                    <span>{accessHeadless ? 'Modo silencioso' : 'Navegador visível'}</span>
                  </div>
                </div>
              )}

              {projects.length === 0 ? (
                <div className={styles.noProjects}>
                  Nenhum projeto cadastrado. <Link href="/settings" className={styles.configWarningLink}>Adicione em Configurações →</Link>
                </div>
              ) : (
                <div className={styles.projectSelector}>
                  <label className={styles.projectLabel}>Projeto</label>
                  <select
                    className={styles.projectSelect}
                    value={selectedProjectId}
                    onChange={e => setSelectedProjectId(e.target.value)}
                    disabled={status === 'running'}
                  >
                    <option value="" disabled>Selecione o projeto...</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.international ? ' 🌐' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                className={`${styles.button} ${(status === 'running' || previewLoading) ? styles.loading : ''}`}
                disabled={status === 'running' || previewLoading || !accessConfigured || projects.length === 0 || !selectedProjectId}
              >
                {status === 'running' ? 'Executando...' : previewLoading ? 'Carregando...' : 'Iniciar Automação'}
              </button>
            </form>

            {message === 'CREDENTIAL_ERROR' ? (
              <div className={styles.credentialError}>
                <span>🔐</span>
                <div>
                  <strong>Usuário ou senha inválidos no portal MOVE.</strong>
                  <p>Corrija as credenciais em <Link href="/settings/acesso" className={styles.configWarningLink}>Configurações → Acesso ao MOVE</Link>.</p>
                </div>
              </div>
            ) : message && !(accessHeadless && status === 'running') && (
              <div className={`${styles.status} ${styles[status]}`}>
                <span className={styles.statusIcon}>
                  {status === 'running' && '⏳'}
                  {status === 'success' && '✅'}
                  {status === 'error' && '❌'}
                </span>
                <p>{message}</p>
              </div>
            )}

            {automationFiles.length > 0 && status === 'running' && (
              <div className={styles.automationList}>
                {automationFiles.map((file, idx) => (
                  <div key={idx} className={`${styles.fileItem} ${styles[file.status]}`}>
                    <span className={styles.fileIcon}>
                      {file.status === 'pending' && '⏳'}
                      {file.status === 'processing' && '🔄'}
                      {file.status === 'success' && '✅'}
                      {file.status === 'error' && '❌'}
                    </span>
                    <span className={styles.fileName}>{file.name}</span>
                  </div>
                ))}
              </div>
            )}

            {accessHeadless && status !== 'idle' && (
              <div className={styles.terminalConsole}>
                <div className={styles.terminalHeader}>
                  <span>Terminal de Execução</span>
                  <div className={styles.terminalDots}>
                    <span className={styles.dotRed} />
                    <span className={styles.dotYellow} />
                    <span className={styles.dotGreen} />
                  </div>
                </div>
                <div className={styles.terminalBody}>
                  {consoleLogs.length === 0 ? (
                    <>
                      <div className={styles.terminalLine}>Conectando ao servidor...</div>
                      <div className={styles.terminalLine}>&nbsp;</div>
                      <div className={styles.terminalLine}>&nbsp;</div>
                    </>
                  ) : (
                    [...Array(Math.max(0, 3 - consoleLogs.length)).fill(''), ...consoleLogs].map((log, i) => (
                      <div key={i} className={styles.terminalLine}>{log || '\u00A0'}</div>
                    ))
                  )}
                </div>
              </div>
            )}

            {diagnosticErrors.length > 0 && (
              <div className={styles.diagnosticBox}>
                <h4 className={styles.diagnosticTitle}>Pendências Encontradas:</h4>
                <ul className={styles.diagnosticList}>
                  {diagnosticErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
                <p className={styles.diagnosticFooter}>Corrija os nomes dos arquivos e tente novamente.</p>
              </div>
            )}

            {report && (
              <div className={styles.reportContainer}>
                <div className={styles.reportHeader}>
                  <h3 className={styles.reportTitle}>Resumo dos Lançamentos</h3>
                  <span className={styles.reportCount}>{report.count} arquivos</span>
                </div>
                
                <div className={styles.tableWrapper}>
                  <table className={styles.reportTable}>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Tipo</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.items.map((item: any, idx: number) => (
                        <tr key={idx} className={item.status === 'error' ? styles.rowError : ''}>
                          <td className={styles.tdDate}>{item.date || '-'}</td>
                          <td>
                            <div className={styles.itemType}>{item.type || 'Erro'}</div>
                            <div className={styles.fileName}>{item.file}</div>
                          </td>
                          <td className={styles.itemValue}>R$ {item.value || '0,00'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={styles.totalizer}>
                  <span className={styles.totalLabel}>Total Lançado</span>
                  <span className={styles.totalValue}>R$ {report.total}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className={styles.footer}>
        <p>© 2026 AutoMove Enterprise - Fase 1</p>
      </div>

      {previewItems !== null && (
        <ConfirmModal
          items={previewItems}
          onConfirm={handleConfirm}
          onCancel={() => setPreviewItems(null)}
        />
      )}
    </div>
  );
}
