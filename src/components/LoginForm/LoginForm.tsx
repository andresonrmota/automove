import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from './LoginForm.module.css';
import TriageForm from '../TriageForm/TriageForm';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import { getSettings, previewAutomation, runAutomation, onAutomationLog } from '@/lib/api-client';
import { APP_VERSION, APP_AUTHOR, APP_YEAR } from '@/lib/version';

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
  
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLogs]);

  useEffect(() => {
    getSettings()
      .then(data => {
        const { baseFolder } = data.folders ?? {};
        setFoldersConfigured(!!baseFolder);
        const list = data.projects ?? [];
        setProjects(list);
        const acc = data.access ?? {};
        setAccessUser(acc.user ?? '');
        setAccessHeadless(acc.headless ?? true);
        setAccessConfigured(!!(acc.user && acc.pass));
      })
      .catch(() => setFoldersConfigured(false));
  }, [activeTab]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPreviewLoading(true);
    // Limpa a tela de fundo (dados de execução anterior) para não confundir o usuário
    setReport(null);
    setStatus('idle');
    setMessage('');
    setConsoleLogs([]);
    setAutomationFiles([]);
    setDiagnosticErrors([]);

    try {
      const data = await previewAutomation();
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

    const unsubscribe = onAutomationLog((data: any) => {
      try {
        if (data.type === 'log') {
          const msg = data.message;
          setConsoleLogs(prev => {
            const newLogs = [...prev, msg];
            return newLogs.length > 100 ? newLogs.slice(newLogs.length - 100) : newLogs;
          });
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
      } catch (err) {
        console.error('Erro ao processar log IPC:', err);
      }
    });

    try {
      const selectedProject = projects.find(p => p.id === selectedProjectId) ?? null;
      const res = await runAutomation(selectedProject);
      
      if (res.success) {
        setStatus('success');
        setMessage('Automação concluída com sucesso!');
        if (res.report) setReport(res.report);
      } else {
        setStatus('error');
        const isCredentialError = res.error?.includes('INVALID_CREDENTIALS') || res.error?.includes('Usuário ou senha inválidos');
        const isTimeoutError = res.error?.includes('LOGIN_TIMEOUT') || res.error?.includes('demorou demais');
        if (isCredentialError) {
          setMessage('CREDENTIAL_ERROR');
        } else if (isTimeoutError) {
          setMessage(res.error || 'Portal MOVE não respondeu.');
        } else {
          setMessage(res.error || 'Erro na automação.');
          if (res.details) setDiagnosticErrors(res.details);
        }
      }
    } catch (err) {
      setStatus('error');
      setMessage('Falha na comunicação com o processo principal.');
    } finally {
      unsubscribe();
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

        {foldersConfigured === false && activeTab === 'automation' && (
          <div className={styles.configWarning}>
            <span className={styles.configWarningIcon}>⚠️</span>
            <div>
              <strong>Pasta Base não configurada.</strong>
              <p>Volte para a aba "Preparar Recibos" e selecione a pasta antes de automatizar.</p>
            </div>
          </div>
        )}

        <div className={styles.tabs}>
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
                disabled={status === 'running' || previewLoading || !accessConfigured || projects.length === 0 || !selectedProjectId || !foldersConfigured}
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
                    <div className={styles.terminalLine}>Conectando ao servidor...</div>
                  ) : (
                    consoleLogs.map((log, i) => (
                      <div key={i} className={styles.terminalLine}>{log || '\u00A0'}</div>
                    ))
                  )}
                  <div ref={terminalEndRef} />
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
        <p>© {APP_YEAR} {APP_AUTHOR} - v {APP_VERSION}</p>
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
