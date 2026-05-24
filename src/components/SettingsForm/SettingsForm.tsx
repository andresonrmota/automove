'use client';

import { useState, useEffect } from 'react';
import FolderPicker from '@/components/FolderPicker/FolderPicker';
import styles from './SettingsForm.module.css';

interface FolderConfig {
  novos: string;
  triados: string;
  concluidos: string;
}

type FolderKey = keyof FolderConfig;

const LABELS: Record<FolderKey, { title: string; description: string }> = {
  novos: {
    title: 'Novos',
    description: 'Onde você coloca os arquivos que ainda precisam ser triados.',
  },
  triados: {
    title: 'Triados',
    description: 'Destino dos arquivos após a triagem, prontos para o robô lançar.',
  },
  concluidos: {
    title: 'Concluídos',
    description: 'Onde o robô move os arquivos após lançar com sucesso no MOVE.',
  },
};

export default function SettingsForm() {
  const [folders, setFolders] = useState<FolderConfig>({ novos: '', triados: '', concluidos: '' });
  const [pickerTarget, setPickerTarget] = useState<FolderKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => setFolders(data.folders))
      .catch(() => {});
  }, []);

  const handleSelect = (path: string) => {
    if (!pickerTarget) return;
    setFolders(prev => ({ ...prev, [pickerTarget]: path }));
    setPickerTarget(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folders }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar.');
      setFeedback({ type: 'success', message: 'Configurações salvas com sucesso!' });
    } catch (e: unknown) {
      setFeedback({ type: 'error', message: e instanceof Error ? e.message : 'Erro desconhecido.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Pastas de trabalho</h2>
        <p className={styles.sectionDesc}>
          Defina onde cada etapa do fluxo deve ler e salvar os arquivos.
        </p>

        <div className={styles.fields}>
          {(Object.keys(LABELS) as FolderKey[]).map(key => (
            <div key={key} className={styles.field}>
              <div className={styles.fieldHeader}>
                <span className={styles.fieldTitle}>{LABELS[key].title}</span>
                <span className={styles.fieldDesc}>{LABELS[key].description}</span>
              </div>
              <div className={styles.fieldRow}>
                <span className={styles.pathDisplay}>
                  {folders[key] || <em className={styles.empty}>Nenhuma pasta selecionada</em>}
                </span>
                <button
                  className={styles.chooseBtn}
                  onClick={() => setPickerTarget(key)}
                >
                  Escolher pasta
                </button>
              </div>
            </div>
          ))}
        </div>

        {feedback && (
          <p className={feedback.type === 'success' ? styles.successMsg : styles.errorMsg}>
            {feedback.message}
          </p>
        )}

        <button
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </div>

      {pickerTarget && (
        <FolderPicker
          initialPath={folders[pickerTarget] || undefined}
          onSelect={handleSelect}
          onClose={() => setPickerTarget(null)}
        />
      )}
    </>
  );
}
