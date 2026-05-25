'use client';

import { useState, useEffect, useCallback } from 'react';
import { browseDirs } from '@/lib/api-client';
import styles from './FolderPicker.module.css';

interface BrowseResult {
  current: string;
  parent: string | null;
  dirs: string[];
}

interface FolderPickerProps {
  initialPath?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

export default function FolderPicker({ initialPath, onSelect, onClose }: FolderPickerProps) {
  const [browse, setBrowse] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const navigate = useCallback(async (targetPath?: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await browseDirs(targetPath);
      if (data.error) throw new Error(data.error);
      setBrowse(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    navigate(initialPath);
  }, [initialPath, navigate]);

  const isWindows = browse ? browse.current.includes('\\') || browse.current.includes(':') : false;
  const sep = isWindows ? '\\' : '/';

  const breadcrumbs = browse
    ? browse.current.split(/[/\\]/).filter(Boolean).reduce<{ label: string; path: string }[]>(
        (acc, segment, index) => {
          if (index === 0 && isWindows) {
            acc.push({ label: segment, path: segment + sep });
          } else {
            const prev = acc[acc.length - 1]?.path || '';
            const nextPath = prev.endsWith(sep) ? prev + segment : prev + sep + segment;
            acc.push({ label: segment, path: nextPath });
          }
          return acc;
        },
        browse.current.startsWith('/') ? [{ label: '/', path: '/' }] : []
      )
    : [];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Selecionar pasta</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.breadcrumb}>
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.path}>
              {i > 0 && <span className={styles.separator}>/</span>}
              <button
                className={styles.crumbBtn}
                onClick={() => navigate(crumb.path)}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </div>

        <div className={styles.body}>
          {loading && <p className={styles.info}>Carregando...</p>}
          {error && <p className={styles.errorMsg}>{error}</p>}

          {!loading && !error && browse && (
            <>
              {browse.parent && (
                <button
                  className={styles.dirItem}
                  onClick={() => navigate(browse.parent!)}
                >
                  <span className={styles.icon}>←</span>
                  <span>..</span>
                </button>
              )}
              {browse.dirs.length === 0 && (
                <p className={styles.info}>Nenhuma subpasta encontrada.</p>
              )}
              {browse.dirs.map(dir => (
                <button
                  key={dir}
                  className={styles.dirItem}
                  onClick={() => {
                    const next = browse.current.endsWith(sep)
                      ? browse.current + dir
                      : browse.current + sep + dir;
                    navigate(next);
                  }}
                >
                  <span className={styles.icon}>📁</span>
                  <span>{dir}</span>
                </button>
              ))}
            </>
          )}
        </div>

        <div className={styles.footer}>
          {browse && (
            <span className={styles.currentPath}>{browse.current}</span>
          )}
          <button
            className={styles.selectBtn}
            disabled={!browse}
            onClick={() => browse && onSelect(browse.current)}
          >
            Selecionar esta pasta
          </button>
        </div>
      </div>
    </div>
  );
}
