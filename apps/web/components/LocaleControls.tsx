'use client';
import { IconSun } from './icons';

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
      <div className="langsel" role="group" aria-label="Idioma / Language">
        <button
          type="button"
          className={`langsel__opt ${locale === 'pt' ? 'is-on' : ''}`}
          aria-pressed={locale === 'pt'}
          onClick={() => locale !== 'pt' && setLocale('pt')}
        >
          PT
        </button>
        <span className="langsel__sep" aria-hidden="true">
          |
        </span>
        <button
          type="button"
          className={`langsel__opt ${locale === 'en' ? 'is-on' : ''}`}
          aria-pressed={locale === 'en'}
          onClick={() => locale !== 'en' && setLocale('en')}
        >
          EN
        </button>
      </div>
      <button className="iconbtn" onClick={toggleTheme} aria-label="Alternar tema claro/escuro">
        <IconSun />
      </button>
    </>
  );
}
