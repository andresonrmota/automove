'use client';

import styles from './ConfirmModal.module.css';

interface ExpenseItem {
  fileName: string;
  type?: string;
  date?: string;
  value?: string;
  error?: boolean;
}

interface Props {
  items: ExpenseItem[];
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ items, onConfirm, onCancel }: Props) {
  const valid = items.filter(i => !i.error);
  const invalid = items.filter(i => i.error);

  const total = valid.reduce((sum, i) => {
    const v = parseFloat(i.value!.replace('.', '').replace(',', '.'));
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Confirmar Lançamentos</h2>
          <p className={styles.subtitle}>
            {valid.length} {valid.length === 1 ? 'arquivo será enviado' : 'arquivos serão enviados'} ao portal MOVE
          </p>
        </div>

        <div className={styles.list}>
          {valid.map((item, idx) => (
            <div key={idx} className={styles.item}>
              <div className={styles.itemDate}>{item.date}</div>
              <div className={styles.itemType}>{item.type}</div>
              <div className={styles.itemValue}>R$ {item.value}</div>
            </div>
          ))}
        </div>

        {invalid.length > 0 && (
          <div className={styles.invalidWarning}>
            <span>⚠️</span>
            <span>{invalid.length} {invalid.length === 1 ? 'arquivo ignorado' : 'arquivos ignorados'} (nome inválido): {invalid.map(i => i.fileName).join(', ')}</span>
          </div>
        )}

        <div className={styles.totalRow}>
          <span className={styles.totalLabel}>Total</span>
          <span className={styles.totalValue}>
            R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>Cancelar</button>
          <button className={styles.confirmBtn} onClick={onConfirm} disabled={valid.length === 0}>
            Confirmar e Iniciar
          </button>
        </div>
      </div>
    </div>
  );
}
