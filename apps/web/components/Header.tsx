import { IconSearch, IconHeart, IconChat, IconGrid } from './icons';
import { Logo } from './Logo';
import { LocaleControls } from './LocaleControls';
import { AccountLink } from './auth/AccountLink';
import { SellButton } from './auth/SellButton';
import type { Dictionary, Locale } from '../lib/i18n/index';

const CATEGORY_KEYS = [
  'viaturas',
  'imoveis',
  'empregos',
  'servicos',
  'agro',
  'moda',
  'electronica',
  'telemoveis',
  'casa',
  'alimentacao',
  'beleza',
] as const;

// Clean, modern marketplace header (Wallapop-structured UX, Nhonga's own brand):
// a rounded pill search front and centre, compact action icons, a prominent
// yellow "Vender" button, and a text category nav below. The mobile experience
// is carried by the bottom tab bar, so this collapses gracefully on phones.
export function Header({ t, locale }: { t: Dictionary; locale: Locale }) {
  return (
    <header className="wlhdr">
      <div className="wlhdr__bar">
        <a href="/" className="wlhdr__brand">
          <Logo variant="auto" label={t.common.brand} />
        </a>

        <form className="wlsearch" role="search" action="/pesquisa" method="get">
          <IconSearch width={20} height={20} aria-hidden />
          <label htmlFor="q" className="sr-only">
            {t.common.search_placeholder}
          </label>
          <input id="q" name="q" placeholder={t.common.search_placeholder} autoComplete="off" />
        </form>

        <div className="wlhdr__actions">
          <LocaleControls locale={locale} />
          <a className="wlact wlact--hide-sm" href="/favoritos" aria-label={t.common.favorites}>
            <IconHeart width={22} height={22} />
            <span className="wlact__label">{t.common.favorites}</span>
          </a>
          <a className="wlact wlact--hide-sm" href="/mensagens" aria-label={t.common.messages}>
            <IconChat width={22} height={22} />
            <span className="wlact__label">{t.common.messages}</span>
          </a>
          <AccountLink label={t.common.account} hello={t.common.hello} signIn={t.common.sign_in} />
          <SellButton label={t.common.sell} />
        </div>
      </div>

      <nav className="wlnav" aria-label={t.home.categories}>
        <a className="wlnav__all" href="/pesquisa">
          <IconGrid width={16} height={16} aria-hidden />
          {t.common.nav_all}
        </a>
        {CATEGORY_KEYS.map((k) => (
          <a className="wlnav__link" key={k} href={`/categoria/${k}`}>
            {t.categories[k]}
          </a>
        ))}
        <a className="wlnav__link wlnav__link--accent" href="/pesquisa?sort=price_asc">
          {t.common.nav_deals}
        </a>
      </nav>
    </header>
  );
}
