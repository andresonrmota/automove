'use client';

import { useState, useEffect } from 'react';
import { getTelegramConfig, saveTelegramConfig, testTelegram } from '@/lib/api-client';
import styles from './TelegramForm.module.css';

interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
}

export default function TelegramForm() {
  const [form, setForm] = useState<TelegramConfig>({ enabled: false, botToken: '', chatId: '' });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    getTelegramConfig()
      .then(data => {
        if (data) setForm(data);
      })
      .catch(() => {});
  }, []);

  const set = (field: keyof TelegramConfig, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleTest = async () => {
    if (!form.botToken || !form.chatId) {
      setFeedback({ type: 'error', message: 'Preencha Token e Chat ID para testar.' });
      return;
    }

    setTesting(true);
    setFeedback(null);
    try {
      const data = await testTelegram({ botToken: form.botToken, chatId: form.chatId });
      if (data.error) throw new Error(data.error);
      setFeedback({ type: 'success', message: 'Mensagem de teste enviada com sucesso! Verifique seu Telegram.' });
    } catch (e: unknown) {
      setFeedback({ type: 'error', message: e instanceof Error ? e.message : 'Erro desconhecido.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (form.enabled && (!form.botToken || !form.chatId)) {
      setFeedback({ type: 'error', message: 'Preencha Token e Chat ID para habilitar a notificação.' });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const data = await saveTelegramConfig(form);
      if (data.error) throw new Error(data.error);
      setFeedback({ type: 'success', message: 'Configurações salvas com sucesso!' });
    } catch (e: unknown) {
      setFeedback({ type: 'error', message: e instanceof Error ? e.message : 'Erro desconhecido.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.headerRow}>
        <h2 className={styles.sectionTitle}>Notificações do Telegram</h2>
        <button 
          type="button" 
          className={styles.infoBtn} 
          onClick={() => setShowTutorial(!showTutorial)} 
          title="Como configurar o Telegram?"
        >
          ℹ️
        </button>
      </div>
      <p className={styles.sectionDesc}>
        Receba alertas automáticos no Telegram assim que a automação finalizar seus processos.
      </p>

      {showTutorial && (
        <div className={styles.tutorialBox}>
          <h4 className={styles.tutorialTitle}>Como obter suas credenciais do Telegram:</h4>
          <ol className={styles.tutorialList}>
            <li>Abra o Telegram e busque por <strong>@BotFather</strong>.</li>
            <li>Envie o comando <code>/newbot</code> e siga as instruções para criar seu bot.</li>
            <li>Copie o <strong>Token</strong> gerado e cole no campo "Bot Token".</li>
            <li>Busque por <strong>@userinfobot</strong> (ou adicione seu novo bot a um grupo).</li>
            <li>Copie o <strong>Chat ID</strong> numérico gerado e cole no campo "Chat ID" (se for grupo, geralmente começa com um sinal de menos <code>-</code>).</li>
            <li><strong>Importante:</strong> Envie um "Olá" para o seu bot (ou no grupo) para iniciar a conversa antes de testar a integração!</li>
          </ol>
        </div>
      )}

      <div className={styles.field}>
        <div className={styles.switchRow}>
          <div>
            <span className={styles.label}>Habilitar Notificações</span>
            <span className={styles.hint}>O resumo do processamento será enviado ao final do fluxo.</span>
          </div>
          <button
            type="button"
            className={`${styles.switch} ${form.enabled ? styles.active : ''}`}
            onClick={() => set('enabled', !form.enabled)}
            role="switch"
            aria-checked={form.enabled}
          >
            <span className={styles.thumb} />
          </button>
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Bot Token</label>
        <input
          className={styles.input}
          type="text"
          placeholder="Ex: 123456789:ABCdefGHIjklmNOPqrsTUVwxyz..."
          value={form.botToken}
          onChange={e => set('botToken', e.target.value)}
        />
        <span className={styles.hint}>Token fornecido pelo @BotFather.</span>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Chat ID</label>
        <input
          className={styles.input}
          type="text"
          placeholder="Ex: -100123456789 ou 123456789"
          value={form.chatId}
          onChange={e => set('chatId', e.target.value)}
        />
        <span className={styles.hint}>ID do seu chat ou grupo (onde o bot é membro).</span>
      </div>

      {feedback && (
        <p className={feedback.type === 'success' ? styles.successMsg : styles.errorMsg}>
          {feedback.message}
        </p>
      )}

      <div className={styles.buttonsRow}>
        <button 
          className={styles.testBtn} 
          onClick={handleTest} 
          disabled={testing || saving || !form.botToken || !form.chatId}
        >
          {testing ? 'Testando...' : 'Testar Integração'}
        </button>

        <button 
          className={styles.saveBtn} 
          onClick={handleSave} 
          disabled={saving || testing}
        >
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </div>
    </div>
  );
}
