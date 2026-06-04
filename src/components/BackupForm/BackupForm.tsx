'use client';

import { useState } from 'react';
import { exportSettings, importSettings } from '@/lib/api-client';
import styles from './BackupForm.module.css';

export default function BackupForm() {
  // Export State
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  
  // Import Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [importPassword, setImportPassword] = useState('');
  const [showImportPass, setShowImportPass] = useState(false);

  // General State
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isExportDisabled = loading || password.length < 6 || password !== confirmPassword;
  const isImportDisabled = loading || importPassword.length < 6;

  const handleExport = async () => {
    if (isExportDisabled) return;

    setLoading(true);
    setFeedback(null);
    try {
      const data = await exportSettings(password);
      if (data.canceled) {
        setFeedback(null);
      } else if (data.success) {
        setFeedback({ type: 'success', message: 'Configurações exportadas com sucesso!' });
        setPassword('');
        setConfirmPassword('');
      } else {
        setFeedback({ type: 'error', message: data.error || 'Erro ao exportar.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao exportar.' });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (isImportDisabled) return;

    setLoading(true);
    setFeedback(null);
    try {
      const data = await importSettings(importPassword);
      if (data.canceled) {
        setFeedback(null);
      } else if (data.success) {
        setFeedback({ type: 'success', message: 'Configurações importadas com sucesso! Elas já estão em vigor.' });
        setIsModalOpen(false);
        setImportPassword('');
      } else {
        setFeedback({ type: 'error', message: data.error || 'Erro ao importar.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao importar.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Backup e Restauração</h2>
        <p className={styles.sectionDesc}>
          Exporte ou importe as suas configurações (projetos, acessos, bot) com total segurança. 
          O arquivo gerado é protegido com <strong>Criptografia AES-256</strong>.
        </p>

        <div className={styles.alertBox}>
          <strong>Atenção:</strong> A senha digitada abaixo servirá para <em>trancar</em> o arquivo 
          na exportação. Se você esquecer essa senha, o backup será 100% irrecuperável.
        </div>

        <div className={styles.fields}>
          <div className={styles.field}>
            <label className={styles.label}>Senha Mestra <span className={styles.required}>*</span></label>
            <div className={styles.passRow}>
              <input
                className={styles.input}
                type={showPass ? 'text' : 'password'}
                placeholder="Mínimo de 6 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className={styles.showBtn}
                onClick={() => setShowPass(v => !v)}
                title={showPass ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Confirmar Senha <span className={styles.required}>*</span></label>
            <div className={styles.passRow}>
              <input
                className={styles.input}
                type={showConfirmPass ? 'text' : 'password'}
                placeholder="Repita a senha mestra"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className={styles.showBtn}
                onClick={() => setShowConfirmPass(v => !v)}
                title={showConfirmPass ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showConfirmPass ? '🙈' : '👁️'}
              </button>
            </div>
            {password !== confirmPassword && confirmPassword.length > 0 && (
              <span className={styles.required} style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                As senhas não coincidem
              </span>
            )}
          </div>
        </div>

        {feedback && !isModalOpen && (
          <p className={feedback.type === 'success' ? styles.successMsg : styles.errorMsg}>
            {feedback.message}
          </p>
        )}

        <div className={styles.actions}>
          <button 
            className={styles.exportBtn} 
            onClick={handleExport} 
            disabled={isExportDisabled}
          >
            {loading ? 'Aguarde...' : 'Exportar Dados'}
          </button>

          <button 
            className={styles.importBtn} 
            onClick={() => {
              setFeedback(null);
              setIsModalOpen(true);
            }} 
            disabled={loading}
          >
            Importar Dados
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Importar Configurações</h3>
            <p className={styles.modalDesc}>
              Digite a senha que foi utilizada no momento da exportação deste arquivo de backup.
            </p>

            <div className={styles.field}>
              <label className={styles.label}>Senha do Backup <span className={styles.required}>*</span></label>
              <div className={styles.passRow}>
                <input
                  className={styles.input}
                  type={showImportPass ? 'text' : 'password'}
                  placeholder="Senha mestra"
                  value={importPassword}
                  onChange={e => setImportPassword(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className={styles.showBtn}
                  onClick={() => setShowImportPass(v => !v)}
                >
                  {showImportPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {feedback && isModalOpen && (
              <p className={feedback.type === 'success' ? styles.successMsg : styles.errorMsg} style={{ marginTop: '16px', marginBottom: 0 }}>
                {feedback.message}
              </p>
            )}

            <div className={styles.modalActions}>
              <button 
                className={styles.cancelBtn} 
                onClick={() => {
                  setIsModalOpen(false);
                  setImportPassword('');
                  setFeedback(null);
                }}
                disabled={loading}
              >
                Cancelar
              </button>
              <button 
                className={styles.exportBtn} 
                onClick={handleImport} 
                disabled={isImportDisabled}
              >
                {loading ? 'Aguarde...' : 'Selecionar Arquivo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
