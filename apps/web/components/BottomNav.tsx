'use client';
import { usePathname } from 'next/navigation';
import { IconHome, IconSearch, IconPlus, IconChat, IconUser } from './icons';
import { useSession } from './auth/SessionProvider';
import type { Dictionary } from '../lib/i18n/index';

// Mobile bottom tab bar (Wallapop-structured UX, Nhonga's brand): five tabs with
// a raised central "Vender" action. Fixed to the viewport bottom on phones only;
// the desktop header carries the same destinations.
export function BottomNav({ t }: { t: Dictionary }) {
  const path = usePathname();
  const { user } = useSession();
  const active = (href: string): boolean => (href === '/' ? path === '/' : path.startsWith(href));
  // Selling needs an account: authenticated → onboarding, otherwise sign in /
  // create account first, then continue to selling.
  const sellHref = user ? '/vender/comecar' : '/entrar?next=/vender/comecar';

  const tab = (href: string, label: string, Icon: typeof IconHome) => (
    <a
      href={href}
      className={`btab ${active(href) ? 'is-active' : ''}`}
      aria-current={active(href) ? 'page' : undefined}
    >
      <Icon width={22} height={22} />
      <span>{label}</span>
    </a>
  );

  return (
    <nav className="bottomnav" aria-label={t.common.menu}>
      {tab('/', t.common.tab_home, IconHome)}
      {tab('/pesquisa', t.common.tab_search, IconSearch)}
      <a href={sellHref} className="btab btab--sell" aria-label={t.common.tab_sell}>
        <span className="btab__plus">
          <IconPlus width={24} height={24} />
        </span>
        <span>{t.common.tab_sell}</span>
      </a>
      {tab('/mensagens', t.common.messages, IconChat)}
      {tab('/conta', t.common.tab_account, IconUser)}
    </nav>
  );
}
