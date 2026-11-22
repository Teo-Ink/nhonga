'use client';
import { useEffect, useState } from 'react';
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
  const [unread, setUnread] = useState(0);
  const [msgUnread, setMsgUnread] = useState(0);
  const active = (href: string): boolean => (href === '/' ? path === '/' : path.startsWith(href));

  // Surface unread notifications on the Account tab and unread conversations on
  // the Messages tab, so mobile users see activity without the desktop header.
  useEffect(() => {
    if (!user) {
      setUnread(0);
      setMsgUnread(0);
      return;
    }
    let on = true;
    const load = () => {
      void fetch('/api/notifications', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d: { unread?: number }) => on && setUnread(d.unread ?? 0))
        .catch(() => undefined);
      void fetch('/api/conversations', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d: { unread?: number }) => on && setMsgUnread(d.unread ?? 0))
        .catch(() => undefined);
    };
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      on = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [user, path]);
  // Selling needs an account: authenticated → onboarding, otherwise sign in /
  // create account first, then continue to selling.
  const sellHref = user ? '/vender/novo' : '/entrar?next=/vender/novo';

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
      <a
        href="/mensagens"
        className={`btab ${active('/mensagens') ? 'is-active' : ''}`}
        aria-current={active('/mensagens') ? 'page' : undefined}
      >
        <span className="btab__iconwrap">
          <IconChat width={22} height={22} />
          {msgUnread > 0 ? (
            <span className="btab__badge" aria-label={t.common.messages}>
              {msgUnread > 9 ? '9+' : msgUnread}
            </span>
          ) : null}
        </span>
        <span>{t.common.messages}</span>
      </a>
      <a
        href="/conta"
        className={`btab ${active('/conta') ? 'is-active' : ''}`}
        aria-current={active('/conta') ? 'page' : undefined}
      >
        <span className="btab__iconwrap">
          <IconUser width={22} height={22} />
          {unread > 0 ? (
            <span className="btab__badge" aria-label={t.common.notifications}>
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </span>
        <span>{t.common.tab_account}</span>
      </a>
    </nav>
  );
}
