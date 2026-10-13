import { IconHeart, IconGrid } from './icons';
import { Logo } from './Logo';
import { LocaleControls } from './LocaleControls';
import { AccountMenu } from './auth/AccountMenu';
import { SellButton } from './auth/SellButton';
import { NotificationBell } from './notifications/NotificationBell';
import { MessagesLink } from './messaging/MessagesLink';
import type { Dictionary, Locale } from '../lib/i18n/index';

// Gumtree-style pillars: the verticals stand alone, everyday goods live under a
// single "Compra e Vendas" (For Sale) section at /compra-e-vendas.
const PILLARS = [
  { href: '/categoria/viaturas', key: 'viaturas' as const },
  { href: '/compra-e-vendas', key: 'compra_vendas' as const },
  { href: '/categoria/servicos', key: 'servicos' as const },
  { href: '/categoria/empregos', key: 'empregos' as const },
  { href: '/categoria/eventos', key: 'eventos' as const },
];

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

        <div className="wlhdr__actions">
          <LocaleControls locale={locale} />
          <span className="wlhdr__sep" aria-hidden="true" />
          <a className="wlact wlact--hide-sm" href="/favoritos" aria-label={t.common.favorites}>
            <IconHeart width={22} height={22} />
          </a>
          <MessagesLink label={t.common.messages} />
          <NotificationBell label={t.common.notifications} />
          <AccountMenu t={t.account} label={t.common.account} signInLabel={t.common.sign_in} />
          <SellButton label={t.common.sell} />
        </div>
      </div>

      <nav className="wlnav" aria-label={t.home.categories}>
        <a className="wlnav__all" href="/pesquisa">
          <IconGrid width={16} height={16} aria-hidden />
          {t.common.nav_all}
        </a>
        {PILLARS.map((p) => (
          <a className="wlnav__link" key={p.key} href={p.href}>
            {t.categories[p.key]}
          </a>
        ))}
        <a className="wlnav__link wlnav__link--accent" href="/pesquisa?sort=price_asc">
          {t.common.nav_deals}
        </a>
      </nav>
    </header>
  );
}
