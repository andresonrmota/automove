import React, { useState, useEffect } from 'react';
import styles from './TriageForm.module.css';

export default function TriageForm() {
  const [files, setFiles] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [formData, setFormData] = useState({
    type: 'A',
    date: '',
    value: ''
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const response = await fetch('/api/triage');
      const data = await response.json();
      if (data.files) {
        setFiles(data.files);
        // Resetar formulário com data atual
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        setFormData(prev => ({ ...prev, date: `${dd}/${mm}/${yyyy}` }));
      }
    } catch (err) {
      console.error('Erro ao carregar arquivos:', err);
    }
  };

  const currentFile = files[currentIndex];

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    
    let formatted = value;
    if (value.length > 2) formatted = `${value.slice(0, 2)}/${value.slice(2)}`;
    if (value.length > 4) formatted = `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`;
    
    setFormData(prev => ({ ...prev, date: formatted }));
  };

  const isOverLimit = (formData.type === 'A' || formData.type === 'S') && 
                     parseFloat(formData.value.replace(',', '.')) > 40;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFile || isOverLimit) return;

    setStatus('saving');
    try {
      const response = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalName: currentFile.name,
          ...formData
        })
      });

      if (response.ok) {
        setStatus('success');
        setMessage('Arquivo preparado com sucesso!');
        setTimeout(() => {
          setStatus('idle');
          setMessage('');
          // Remover o arquivo da lista e ir para o próximo ou recarregar
          const newFiles = [...files];
          newFiles.splice(currentIndex, 1);
          setFiles(newFiles);
          if (currentIndex >= newFiles.length && newFiles.length > 0) {
            setCurrentIndex(newFiles.length - 1);
          }
        }, 1000);
      } else {
        setStatus('error');
        setMessage('Erro ao salvar arquivo.');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Falha na comunicação.');
    }
  };

  if (files.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>📂</span>
        <h3>Tudo limpo por aqui!</h3>
        <p>Jogue seus arquivos na pasta <code>pending-uploads</code> para começar a triagem.</p>
        <button onClick={loadFiles} className={styles.refreshButton}>Atualizar Pasta</button>
      </div>
    );
  }

  return (
    <div className={styles.triageContainer}>
      <div className={styles.viewerSection}>
        <div className={styles.viewerHeader}>
          <span>Arquivo {currentIndex + 1} de {files.length}</span>
          <span className={styles.fileName}>{currentFile.name}</span>
        </div>
        <div className={styles.imageWrapper}>
          {currentFile.name.toLowerCase().endsWith('.pdf') ? (
            <iframe src={currentFile.path} className={styles.pdfViewer} title="PDF Preview" />
          ) : (
            <img src={currentFile.path} alt="Recibo" className={styles.receiptImage} />
          )}
        </div>
      </div>

      <div className={styles.formSection}>
        <h3 className={styles.formTitle}>Preparar Lançamento</h3>
        <form onSubmit={handleSave} className={styles.form}>
          <div className={styles.field}>
            <label>Tipo de Despesa</label>
            <select 
              value={formData.type} 
              onChange={e => setFormData({...formData, type: e.target.value})}
              className={styles.select}
            >
              <option value="A">Alimentação</option>
              <option value="T">Transporte Urbano</option>
              <option value="E">Estacionamento</option>
              <option value="H">Hospedagem</option>
              <option value="L">Lavanderia</option>
            </select>
          </div>

          <div className={styles.field}>
            <label>Data (DD/MM/AAAA)</label>
            <input 
              type="text" 
              placeholder="Ex: 30/04/2026" 
              value={formData.date}
              onChange={handleDateChange}
              className={styles.input}
              required
            />
          </div>

          <div className={styles.field}>
            <label>Valor (R$)</label>
            <input 
              type="text" 
              placeholder="Ex: 38,50" 
              value={formData.value}
              onChange={e => setFormData({...formData, value: e.target.value})}
              className={`${styles.input} ${isOverLimit ? styles.inputError : ''}`}
              required
            />
            {isOverLimit && (
              <span className={styles.errorHint}>O limite máximo para alimentação é R$ 40,00</span>
            )}
          </div>

          <div className={styles.actions}>
            <button 
              type="submit" 
              className={styles.saveButton}
              disabled={status === 'saving' || isOverLimit}
            >
              {status === 'saving' ? 'Salvando...' : 'Salvar e Próximo'}
            </button>
          </div>
          
          {message && (
            <div className={`${styles.status} ${styles[status]}`}>
              {message}
            </div>
          )}
        </form>

        <div className={styles.navigation}>
          <button 
            disabled={currentIndex === 0} 
            onClick={() => setCurrentIndex(currentIndex - 1)}
            className={styles.navButton}
          >
            ← Anterior
          </button>
          <button 
            disabled={currentIndex === files.length - 1} 
            onClick={() => setCurrentIndex(currentIndex + 1)}
            className={styles.navButton}
          >
            Próximo →
          </button>
        </div>
      </div>
    </div>
  );
}
