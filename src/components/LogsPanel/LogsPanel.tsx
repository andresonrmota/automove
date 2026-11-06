'use client';

import { getHomeDir, openFolder } from '@/lib/api-client';
import styles from '../BackupForm/BackupForm.module.css';

export default function LogsPanel() {
  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>Logs de Execução</h2>
      <p className={styles.sectionDesc}>
        Cada execução gera um arquivo de log, com as 30 mais recentes guardadas neste computador.
        Em caso de falha, o log também é copiado para a pasta Erros e enviado pelo Telegram.
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.exportBtn}
          onClick={async () => openFolder(`${await getHomeDir()}/.automove/logs`)}
        >
          Abrir pasta de logs
        </button>
      </div>
    </div>
  );
}
