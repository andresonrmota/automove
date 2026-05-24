import Link from 'next/link';
import SettingsNav from './SettingsNav';
import styles from './settings.module.css';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <Link href="/" className={styles.backLink}>← Voltar</Link>
          <h1 className={styles.pageTitle}>Configurações</h1>
        </div>
        <SettingsNav />
      </aside>
      <main className={styles.content}>
        {children}
      </main>
    </div>
  );
}
