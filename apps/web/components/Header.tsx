import { IconCart, IconSearch, IconMapPin } from './icons';
import { LocaleControls } from './LocaleControls';
import { CartCount } from './cart/CartCount';
import { AccountLink } from './auth/AccountLink';
import type { Dictionary, Locale } from '../lib/i18n/index';

const CATEGORY_KEYS = [
  'moda',
  'electronica',
  'telemoveis',
  'casa',
  'alimentacao',
  'beleza',
] as const;

// Two-tier marketplace header (Amazon-structured, Nhonga's own look): a top bar
// with brand, deliver-to, a department-scoped search, locale/account/cart; and a
// secondary nav bar of categories plus deals/sell/help.
export function Header({ t, locale }: { t: Dictionary; locale: Locale }) {
  return (
    <header className="hdr">
      <div className="hdr__top">
        <a href="/" className="hdr__brand" aria-label={t.common.brand}>
          Nhonga<b>.</b>
        </a>

        <a href="/" className="hdr__deliver" aria-label={t.common.deliver_to}>
          <IconMapPin width={18} height={18} />
          <span className="hdr__deliver-text">
            <span className="hdr__deliver-label">{t.common.deliver_to}</span>
          </span>
        </a>

        <form className="hdr__search" role="search" action="/pesquisa" method="get">
          <label htmlFor="hdr-cat" className="sr-only">
            {t.search.category}
          </label>
          <select id="hdr-cat" name="category" className="hdr__scope" defaultValue="">
            <option value="">{t.common.search_scope_all}</option>
            {CATEGORY_KEYS.map((k) => (
              <option key={k} value={k}>
                {t.categories[k]}
              </option>
            ))}
          </select>
          <label htmlFor="q" className="sr-only">
            {t.common.search_placeholder}
          </label>
          <input id="q" name="q" placeholder={t.common.search_placeholder} autoComplete="off" />
          <button type="submit" className="hdr__search-btn" aria-label={t.common.search_button}>
            <IconSearch width={20} height={20} />
          </button>
        </form>

        <div className="hdr__actions">
          <LocaleControls locale={locale} />
          <AccountLink label={t.common.account} hello={t.common.hello} signIn={t.common.sign_in} />
          <a className="iconbtn" href="/carrinho" aria-label={t.common.cart}>
            <IconCart />
            <CartCount />
          </a>
        </div>
      </div>

      <nav className="hdr__nav" aria-label={t.home.categories}>
        <a className="hdr__nav-link hdr__nav-link--all" href="/pesquisa">
          {t.common.nav_all}
        </a>
        {CATEGORY_KEYS.map((k) => (
          <a className="hdr__nav-link" key={k} href={`/categoria/${k}`}>
            {t.categories[k]}
          </a>
        ))}
        <a className="hdr__nav-link hdr__nav-link--accent" href="/pesquisa?sort=price_asc">
          {t.common.nav_deals}
        </a>
        <a className="hdr__nav-link" href="/vender/comecar">
          {t.common.nav_sell}
        </a>
        <a className="hdr__nav-link" href="/ajuda">
          {t.common.nav_help}
        </a>
      </nav>
    </header>
  );
}
