import React, { useState } from 'react';
import styles from './LoginForm.module.css';
import TriageForm from '../TriageForm/TriageForm';

export default function LoginForm() {
  const [activeTab, setActiveTab] = useState<'triage' | 'automation'>('triage');
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [report, setReport] = useState<any>(null);
  const [diagnosticErrors, setDiagnosticErrors] = useState<string[]>([]);
  const [automationFiles, setAutomationFiles] = useState<any[]>([]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('running');
    setMessage('Iniciando conexão com o servidor...');
    setReport(null);
    setDiagnosticErrors([]);
    setAutomationFiles([]);

    try {
      const response = await fetch('/api/automation', {
        method: 'POST',
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
              // Filtrar logs para mostrar apenas os iniciais ou importantes
              const msg = data.message;
              if (msg.includes('Diagnóstico') || msg.includes('portal') || msg.includes('login') || msg.includes('Login realizado')) {
                setMessage(msg);
              }
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
              setMessage('Erro na automação.');
              if (data.details) setDiagnosticErrors(data.details);
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
          <div className={styles.logo}>
            <img src="/logo.png" alt="AutoMove Logo" className={styles.logoImage} />
            <h1 className={styles.title}>AutoMove</h1>
          </div>
          <p className={styles.subtitle}>Automação de Prestação de Contas</p>
        </div>

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
              <div className={styles.infoBox}>
                <p>As credenciais configuradas no arquivo <code>.env</code> serão utilizadas para o acesso ao portal MOVE.</p>
              </div>

              <button 
                type="submit" 
                className={`${styles.button} ${status === 'running' ? styles.loading : ''}`}
                disabled={status === 'running'}
              >
                {status === 'running' ? 'Executando...' : 'Iniciar Automação'}
              </button>
            </form>

            {message && (
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
    </div>
  );
}
