'use client';

import { useState, useEffect } from 'react';
import { getTelegramConfig, saveTelegramConfig, testTelegram } from '@/lib/api-client';
import { TELEGRAM_BOT_USERNAME } from '@/lib/telegram-bot';
import styles from './TelegramForm.module.css';

interface TelegramConfig {
  enabled: boolean;
  chatId: string;
}

export default function TelegramForm() {
  const [form, setForm] = useState<TelegramConfig>({ enabled: false, chatId: '' });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    getTelegramConfig()
      .then(data => {
        if (data) setForm({ enabled: !!data.enabled, chatId: data.chatId || '' });
      })
      .catch(() => {});
  }, []);

  const set = (field: keyof TelegramConfig, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleTest = async () => {
    if (!form.chatId) {
      setFeedback({ type: 'error', message: 'Informe o Chat ID para testar.' });
      return;
    }

    setTesting(true);
    setFeedback(null);
    try {
      const data = await testTelegram({ chatId: form.chatId });
      if (data.error) throw new Error(data.error);
      setFeedback({ type: 'success', message: 'Mensagem de teste enviada com sucesso! Verifique seu Telegram.' });
    } catch (e: unknown) {
      setFeedback({ type: 'error', message: e instanceof Error ? e.message : 'Erro desconhecido.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (form.enabled && !form.chatId) {
      setFeedback({ type: 'error', message: 'Informe o Chat ID para habilitar a notificação.' });
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
          title="Como obter meu Chat ID?"
        >
          ℹ️
        </button>
      </div>
      <p className={styles.sectionDesc}>
        Receba alertas automáticos no Telegram assim que a automação finalizar seus processos.
        As mensagens são enviadas pelo bot <strong>@{TELEGRAM_BOT_USERNAME}</strong>; você só precisa informar o seu Chat ID.
      </p>

      {showTutorial && (
        <div className={styles.tutorialBox}>
          <h4 className={styles.tutorialTitle}>Como obter o seu Chat ID:</h4>
          <ol className={styles.tutorialList}>
            <li>Abra o Telegram e busque por <strong>@userinfobot</strong>.</li>
            <li>Toque em <strong>Iniciar</strong> (ou envie <code>/start</code>). Ele responde com o seu <strong>Id</strong>, um número como <code>123456789</code>.</li>
            <li>Copie esse número e cole no campo <strong>Chat ID</strong> abaixo.</li>
            <li><strong>Importante:</strong> busque por <strong>@{TELEGRAM_BOT_USERNAME}</strong> e toque em <strong>Iniciar</strong>. Sem isso o Telegram não permite que o bot envie mensagens para você.</li>
            <li>Clique em <strong>Testar Integração</strong> para confirmar o recebimento e depois em <strong>Salvar configurações</strong>.</li>
          </ol>
          <p className={styles.tutorialNote}>
            Para receber em um grupo: adicione <strong>@{TELEGRAM_BOT_USERNAME}</strong> ao grupo, envie uma mensagem nele e
            use como Chat ID o número do grupo (começa com <code>-</code>), que o <strong>@userinfobot</strong> informa ao ser
            encaminhada a ele uma mensagem do grupo.
          </p>
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
        <label className={styles.label}>Chat ID</label>
        <input
          className={styles.input}
          type="text"
          placeholder="Ex: 123456789"
          value={form.chatId}
          onChange={e => set('chatId', e.target.value)}
        />
        <span className={styles.hint}>
          Seu ID numérico no Telegram. Não sabe qual é? Clique no ℹ️ acima para ver como obter.
        </span>
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
          disabled={testing || saving || !form.chatId}
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
