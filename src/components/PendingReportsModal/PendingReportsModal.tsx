import React, { useState } from 'react';
import styles from './PendingReportsModal.module.css';

interface PendingReport {
  id: string;
  project: string;
  value: string;
}

interface Props {
  reports: PendingReport[];
  onSelectContinuation: (pcId: string) => void;
  onSelectNew: () => void;
  onCancel: () => void;
}

export default function PendingReportsModal({ reports, onSelectContinuation, onSelectNew, onCancel }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(reports[0]?.id || null);

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Prestações Pendentes Encontradas</h2>
          <p className={styles.subtitle}>
            Já existem prestações em aberto para este projeto no portal MOVE.
          </p>
        </div>

        <div className={styles.warningContainer}>
          <span className={styles.warningIcon}>⚠️</span>
          <p className={styles.warningText}>
            O Move permite múltiplos apontamentos no mesmo projeto. Selecione abaixo para dar continuidade a um lançamento anterior ou crie um novo apontamento do zero.
          </p>
        </div>

        <div className={styles.list}>
          {reports.map((report) => (
            <div
              key={report.id}
              className={`${styles.item} ${selectedId === report.id ? styles.itemSelected : ''}`}
              onClick={() => setSelectedId(report.id)}
            >
              <div className={styles.radio}>
                <input
                  type="radio"
                  name="pending-report"
                  checked={selectedId === report.id}
                  onChange={() => setSelectedId(report.id)}
                />
              </div>
              <div className={styles.reportDetails}>
                <div className={styles.reportId}>{report.id}</div>
                <div className={styles.reportProject}>{report.project}</div>
              </div>
              <div className={styles.reportValue}>{report.value}</div>
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className={styles.newBtn} onClick={onSelectNew}>
            Nova do Zero
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={() => selectedId && onSelectContinuation(selectedId)}
            disabled={!selectedId}
          >
            Continuar Lançamento
          </button>
        </div>
      </div>
    </div>
  );
}
