'use client';

import { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '@/lib/api-client';
import styles from './ProjectsForm.module.css';

interface Project {
  id: string;
  name: string;
  international: boolean;
  inactiveDate?: string;
}

export default function ProjectsForm() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [newName, setNewName] = useState('');
  const [newIntl, setNewIntl] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    getSettings()
      .then(data => setProjects(data.projects ?? []))
      .catch(() => {});
  }, []);

  const addProject = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const duplicate = projects.some(p => p.name.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      setFeedback({ type: 'error', message: 'Já existe um projeto com esse nome.' });
      return;
    }
    setProjects(prev => [...prev, { id: crypto.randomUUID(), name: trimmed, international: newIntl }]);
    setNewName('');
    setNewIntl(false);
    setFeedback(null);
  };

  const removeProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  const toggleInactive = (id: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id === id) {
        if (p.inactiveDate) {
          return { ...p, inactiveDate: undefined };
        } else {
          const today = new Date();
          const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
          return { ...p, inactiveDate: dateStr };
        }
      }
      return p;
    }));
  };

  const toggleIntl = (id: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, international: !p.international } : p));
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const data = await saveSettings({ projects });
      if (data.error) throw new Error(data.error);
      setFeedback({ type: 'success', message: 'Projetos salvos com sucesso!' });
    } catch (e: unknown) {
      setFeedback({ type: 'error', message: e instanceof Error ? e.message : 'Erro desconhecido.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>Projetos</h2>
      <p className={styles.sectionDesc}>
        Cadastre os projetos exatamente como aparecem no portal MOVE. Ative o interruptor para projetos internacionais (sem limite de R$ 40,00 para alimentação).
      </p>

      <div className={styles.addRow}>
        <input
          type="text"
          className={styles.nameInput}
          placeholder="Nome exato do projeto no MOVE"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addProject()}
        />
        <label className={styles.toggleLabel}>
          <span className={styles.toggleText}>Internacional</span>
          <button
            type="button"
            role="switch"
            aria-checked={newIntl}
            className={`${styles.toggle} ${newIntl ? styles.toggleOn : ''}`}
            onClick={() => setNewIntl(v => !v)}
          />
        </label>
        <button className={styles.addBtn} onClick={addProject}>
          + Adicionar
        </button>
      </div>

      {projects.length === 0 ? (
        <p className={styles.empty}>Nenhum projeto cadastrado ainda.</p>
      ) : (
        <ul className={styles.list}>
          {projects.map(project => (
            <li key={project.id} className={`${styles.item} ${project.inactiveDate ? styles.itemInactive : ''}`}>
              <div className={styles.projectInfo}>
                <span className={styles.projectName}>{project.name}</span>
                {project.inactiveDate && (
                  <span className={styles.inactiveDate}>Inativado em {project.inactiveDate}</span>
                )}
              </div>
              <div className={styles.itemActions}>
                <button
                  className={styles.inactiveBtn}
                  onClick={() => toggleInactive(project.id)}
                  title={project.inactiveDate ? "Reativar projeto" : "Inativar projeto"}
                >
                  {project.inactiveDate ? "Reativar" : "Inativar"}
                </button>
                <label className={styles.toggleLabel}>
                  <span className={`${styles.toggleText} ${project.international ? styles.intlActive : ''}`}>
                    {project.international ? 'Internacional' : 'Nacional'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={project.international}
                    className={`${styles.toggle} ${project.international ? styles.toggleOn : ''}`}
                    onClick={() => toggleIntl(project.id)}
                  />
                </label>
                <button
                  className={styles.removeBtn}
                  onClick={() => removeProject(project.id)}
                  title="Remover projeto"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {feedback && (
        <p className={feedback.type === 'success' ? styles.successMsg : styles.errorMsg}>
          {feedback.message}
        </p>
      )}

      <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar projetos'}
      </button>
    </div>
  );
}
