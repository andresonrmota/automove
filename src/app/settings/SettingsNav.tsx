'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './settings.module.css';

const NAV_ITEMS = [
  { href: '/settings/projetos', label: 'Projetos',           icon: '🗂️' },
  { href: '/settings/acesso',   label: 'Acesso ao MOVE',     icon: '🔐' },
  { href: '/settings/telegram', label: 'Telegram',           icon: '🤖' },
];

export default function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav}>
      {NAV_ITEMS.map(item => (
        <Link
          key={item.href}
          href={item.href}
          className={styles.navItem}
          aria-current={pathname === item.href ? 'page' : undefined}
        >
          <span className={styles.navIcon}>{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
