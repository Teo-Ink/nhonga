import { IconCart, IconSearch, IconUser } from './icons';
import { LocaleControls } from './LocaleControls';
import type { Dictionary, Locale } from '../lib/i18n/index';

const CATEGORY_KEYS = [
  'moda',
  'electronica',
  'telemoveis',
  'casa',
  'alimentacao',
  'beleza',
] as const;

export function Header({ t, locale }: { t: Dictionary; locale: Locale }) {
  return (
    <header className="hdr">
      <div className="hdr__top">
        <a href="/" className="hdr__brand" aria-label={t.common.brand}>
          Nhonga<b>.</b>
        </a>

        <form className="hdr__search" role="search" action="/" method="get">
          <IconSearch width={18} height={18} aria-hidden />
          <label htmlFor="q" className="sr-only" style={{ position: 'absolute', left: -9999 }}>
            {t.common.search_placeholder}
          </label>
          <input id="q" name="q" placeholder={t.common.search_placeholder} autoComplete="off" />
        </form>

        <div className="hdr__actions">
          <LocaleControls locale={locale} />
          <a className="iconbtn" href="/conta" aria-label={t.common.account}>
            <IconUser />
          </a>
          <a className="iconbtn" href="/carrinho" aria-label={t.common.cart}>
            <IconCart />
            <span className="badge-count" aria-hidden>
              0
            </span>
          </a>
        </div>
      </div>

      <nav className="catrow" aria-label={t.home.categories}>
        {CATEGORY_KEYS.map((k) => (
          <a className="catchip" key={k} href={`/categoria/${k}`}>
            {t.categories[k]}
          </a>
        ))}
      </nav>
    </header>
  );
}
