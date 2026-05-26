import React, { useState, useEffect, useRef } from 'react';
import { getSettings, listTriageFiles, processTriageFile, openFolder, openDirectoryDialog } from '@/lib/api-client';
import styles from './TriageForm.module.css';

export default function TriageForm() {
  const [files, setFiles] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [formData, setFormData] = useState({
    type: 'AL',
    date: '',
    value: ''
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [baseFolder, setBaseFolder] = useState('');
  const datePickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSettings()
      .then(data => setBaseFolder(data.folders?.baseFolder ?? ''))
      .catch(() => {});
  }, []);

  const handleSelectFolder = async () => {
    const res = await openDirectoryDialog();
    if (!res.canceled && res.path) {
      setBaseFolder(res.path);
      // Automagicamente carrega após selecionar
      try {
        const data = await listTriageFiles();
        if (data.files) {
          setFiles(data.files);
          const today = new Date();
          const dd = String(today.getDate()).padStart(2, '0');
          const mm = String(today.getMonth() + 1).padStart(2, '0');
          const yyyy = today.getFullYear();
          setFormData(prev => ({ ...prev, date: `${dd}/${mm}/${yyyy}` }));
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const loadFiles = async () => {
    try {
      const data = await listTriageFiles();
      if (data.error) throw new Error(data.error);
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

  const handleCalendarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [yyyy, mm, dd] = e.target.value.split('-');
    if (yyyy && mm && dd) {
      setFormData(prev => ({ ...prev, date: `${dd}/${mm}/${yyyy}` }));
    }
  };

  // Converte DD/MM/AAAA → AAAA-MM-DD para o input[type=date]
  const toIsoDate = (dmy: string) => {
    const parts = dmy.split('/');
    if (parts.length === 3 && parts[2].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return '';
  };

  const numericValue = parseFloat(formData.value.replace(/\./g, '').replace(',', '.')) || 0;
  const isOverLimit = formData.type === 'AL' && numericValue > 40;
  const isLavanderiaOverLimit = formData.type === 'LV' && numericValue > 250;
  const hasLimitError = isOverLimit || isLavanderiaOverLimit;

  const checkFutureDate = () => {
    if (formData.date.length === 10) {
      const [dd, mm, yyyy] = formData.date.split('/');
      const selected = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return selected > today;
    }
    return false;
  };
  const isFutureDate = checkFutureDate();

  const checkPast60Days = () => {
    if (formData.date.length === 10) {
      const [dd, mm, yyyy] = formData.date.split('/');
      const selected = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      const limit = new Date();
      limit.setHours(0, 0, 0, 0);
      limit.setDate(limit.getDate() - 60);
      return selected < limit;
    }
    return false;
  };
  const isPast60Days = checkPast60Days();

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (!value) {
      setFormData(prev => ({ ...prev, value: '' }));
      return;
    }
    if (value.length > 5) value = value.slice(0, 5);
    const numValue = (parseInt(value, 10) / 100).toFixed(2);
    const formattedValue = numValue.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    setFormData(prev => ({ ...prev, value: formattedValue }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFile || hasLimitError || isFutureDate) return;

    if (isPast60Days) {
      const proceed = window.confirm("A data informada é inferior a 60 dias da data atual. Isso foge à política da MV.\n\nDeseja realmente prosseguir com o lançamento?");
      if (!proceed) return;
    }

    setStatus('saving');
    try {
      const data = await processTriageFile({
        originalName: currentFile.name,
        ...formData
      });

      if (data.success) {
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
        setMessage(data.error || 'Erro ao salvar arquivo.');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Falha na comunicação.');
    }
  };

  const openBaseFolder = async () => {
    if (!baseFolder) return;
    await openFolder(baseFolder);
  };

  if (files.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>📂</span>
        <h3>Nenhum arquivo encontrado</h3>
        <p>Selecione a sua <strong>Pasta Base</strong> de recibos. Nós criaremos automaticamente as subpastas necessárias.</p>
        
        {baseFolder ? (
          <code className={styles.pathHint}>Pasta Atual: {baseFolder}</code>
        ) : (
          <code className={styles.pathHint}>Nenhuma pasta selecionada</code>
        )}

        <div className={styles.emptyActions}>
          <button onClick={handleSelectFolder} className={styles.openButton}>
            Selecionar Pasta Base
          </button>

          {baseFolder && (
            <>
              <button onClick={openBaseFolder} className={styles.openButton}>
                Abrir Pasta Atual
              </button>
              <button onClick={loadFiles} className={styles.refreshButton}>
                Recarregar
              </button>
            </>
          )}
        </div>
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
              <option value="AL">Alimentação</option>
              <option value="BG">Bagagem</option>
              <option value="CB">Combustível</option>
              <option value="ES">Estacionamento</option>
              <option value="LV">Lavanderia</option>
              <option value="PG">Pedágio</option>
              <option value="TA">Taxi APP</option>
              <option value="TU">Transportes Urbanos</option>
            </select>
          </div>

          <div className={styles.field}>
            <label>Data</label>
            <div className={styles.dateRow}>
              <input
                type="text"
                placeholder="DD/MM/AAAA"
                value={formData.date}
                onChange={handleDateChange}
                className={`${styles.input} ${isFutureDate ? styles.inputError : ''}`}
                required
              />
              <button
                type="button"
                className={styles.calendarBtn}
                onClick={() => datePickerRef.current?.showPicker()}
                title="Abrir calendário"
              >
                📅
              </button>
              <input
                ref={datePickerRef}
                type="date"
                value={toIsoDate(formData.date)}
                onChange={handleCalendarChange}
                className={styles.hiddenDatePicker}
                tabIndex={-1}
              />
            </div>
            {isFutureDate && (
              <span className={styles.errorHint}>A data da despesa não pode ser superior à data atual.</span>
            )}
            {isPast60Days && !isFutureDate && (
              <span className={styles.errorHint} style={{ color: '#fbbf24', marginTop: '4px' }}>
                Atenção: A data informada é inferior a 60 dias da data atual.
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label>Valor (R$)</label>
            <input 
              type="text" 
              placeholder="Ex: 38,50" 
              value={formData.value}
              onChange={handleValueChange}
              className={`${styles.input} ${hasLimitError ? styles.inputError : ''}`}
              required
            />
            {isOverLimit && (
              <span className={styles.errorHint}>O limite máximo para alimentação é R$ 40,00</span>
            )}
            {isLavanderiaOverLimit && (
              <span className={styles.errorHint}>O limite máximo mensal para lavanderia é R$ 250,00</span>
            )}
          </div>

          <div className={styles.actions}>
            <button 
              type="submit" 
              className={styles.saveButton}
              disabled={status === 'saving' || hasLimitError || isFutureDate}
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
