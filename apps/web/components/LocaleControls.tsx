'use client';
import { IconGlobe, IconSun } from './icons';

// Language and theme controls. Both persist in a cookie/localStorage and reload
// the current route so the server re-renders with the chosen locale/theme.
export function LocaleControls({ locale }: { locale: 'pt' | 'en' }) {
  function setLocale(next: 'pt' | 'en') {
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
    location.reload();
  }
  function toggleTheme() {
    const root = document.documentElement;
    const current =
      root.getAttribute('data-theme') ??
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* private mode */
    }
  }
  return (
    <>
      <button
        className="iconbtn"
        onClick={() => setLocale(locale === 'pt' ? 'en' : 'pt')}
        aria-label={locale === 'pt' ? 'Mudar para Inglês' : 'Switch to Portuguese'}
        title={locale.toUpperCase()}
      >
        <IconGlobe />
        <span style={{ position: 'absolute', bottom: 3, fontSize: '0.55rem', fontWeight: 700 }}>
          {locale.toUpperCase()}
        </span>
      </button>
      <button className="iconbtn" onClick={toggleTheme} aria-label="Alternar tema claro/escuro">
        <IconSun />
      </button>
    </>
  );
}
