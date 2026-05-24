'use client';

import { useState, useEffect } from 'react';
import styles from './AccessForm.module.css';

interface AccessConfig {
  user: string;
  pass: string;
  client: string;
  headless: boolean;
}

export default function AccessForm() {
  const [form, setForm] = useState<AccessConfig>({ user: '', pass: '', client: '', headless: true });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [validationResult, setValidationResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => { if (data.access) setForm(data.access); })
      .catch(() => { });
  }, []);

  const set = (field: keyof AccessConfig, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleValidate = async () => {
    if (!form.user || !form.pass || !form.client) {
      setValidationResult({ type: 'error', message: 'Preencha usuário, senha e empresa antes de validar.' });
      return;
    }
    setValidating(true);
    setValidationResult(null);
    try {
      const res = await fetch('/api/validate-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: form.user, pass: form.pass, client: form.client }),
      });
      const data = await res.json();
      if (data.success) {
        setValidationResult({ type: 'success', message: 'Credenciais válidas! Login realizado com sucesso.' });
      } else {
        setValidationResult({ type: 'error', message: data.error || 'Credenciais inválidas.' });
      }
    } catch {
      setValidationResult({ type: 'error', message: 'Não foi possível conectar ao portal MOVE.' });
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    if (!form.user || !form.pass || !form.client) {
      setFeedback({ type: 'error', message: 'Preencha todos os campos obrigatórios.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access: form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar.');
      setFeedback({ type: 'success', message: 'Configurações de acesso salvas!' });
    } catch (e: unknown) {
      setFeedback({ type: 'error', message: e instanceof Error ? e.message : 'Erro desconhecido.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>Acesso ao portal MOVE</h2>
      <p className={styles.sectionDesc}>
        Credenciais utilizadas pelo robô para entrar no portal. Salvas localmente no dispositivo.
      </p>

      <div className={styles.fields}>
        <div className={styles.field}>
          <label className={styles.label}>Usuário <span className={styles.required}>*</span></label>
          <input
            className={styles.input}
            type="text"
            placeholder="Ex: andreson.mota"
            value={form.user}
            onChange={e => set('user', e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Senha <span className={styles.required}>*</span></label>
          <div className={styles.passRow}>
            <input
              className={styles.input}
              type={showPass ? 'text' : 'password'}
              placeholder="Senha do portal"
              value={form.pass}
              onChange={e => set('pass', e.target.value)}
              autoComplete="current-password"
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
          <label className={styles.label}>Cliente / Empresa <span className={styles.required}>*</span></label>
          <input
            className={styles.input}
            type="text"
            placeholder="Ex: MV"
            value={form.client}
            onChange={e => set('client', e.target.value)}
            autoComplete="off"
          />
          <span className={styles.hint}>Código da empresa conforme aparece no portal.</span>
        </div>

        <div className={styles.field}>
          <div className={styles.switchRow}>
            <div>
              <span className={styles.label}>Executar em modo invísivel</span>
              <span className={styles.hint}> [navegador fica oculto]</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.headless}
              className={`${styles.toggle} ${form.headless ? styles.toggleOn : ''}`}
              onClick={() => set('headless', !form.headless)}
            />
          </div>
        </div>
      </div>

      <button
        className={styles.validateBtn}
        onClick={handleValidate}
        disabled={validating || saving}
        type="button"
      >
        {validating ? (
          <><span className={styles.spinner} /> Validando credenciais...</>
        ) : 'Validar credenciais'}
      </button>

      {validationResult && (
        <div className={`${styles.validationResult} ${validationResult.type === 'success' ? styles.validationSuccess : styles.validationError}`}>
          <span>{validationResult.type === 'success' ? '✅' : '❌'}</span>
          <span>{validationResult.message}</span>
        </div>
      )}

      {feedback && (
        <p className={feedback.type === 'success' ? styles.successMsg : styles.errorMsg}>
          {feedback.message}
        </p>
      )}

      <button className={styles.saveBtn} onClick={handleSave} disabled={saving || validating}>
        {saving ? 'Salvando...' : 'Salvar acesso'}
      </button>
    </div>
  );
}
