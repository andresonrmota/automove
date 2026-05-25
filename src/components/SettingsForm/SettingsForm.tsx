'use client';

import styles from './SettingsForm.module.css';

export default function SettingsForm() {
  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>Pastas de trabalho</h2>
      <p className={styles.sectionDesc}>
        A configuração de pastas foi simplificada! 
        <br/><br/>
        Agora, você seleciona apenas a <b>Pasta Base</b> diretamente na tela de <strong>Triagem</strong>, e o AutoMove criará automaticamente as subpastas necessárias (/Triados e /Processados) para organizar seus recibos.
      </p>
    </div>
  );
}
