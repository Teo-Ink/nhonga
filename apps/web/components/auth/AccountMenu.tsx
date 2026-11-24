'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconUser, IconChevronLeft } from '../icons';
import { accountGroups } from '../account/items';
import { useSession } from './SessionProvider';
import type { Dictionary } from '../../lib/i18n/index';

// Header "A tua conta" control: a dropdown menu (MyOLX-structured) whose items
// adapt to buyer vs seller. Signed out → a sign-in prompt + the public links.
export function AccountMenu({
  t,
  label,
  signInLabel,
}: {
  t: Dictionary['account'];
  label: string;
  signInLabel: string;
}) {
  const { user, shop, isSeller, signOut } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<{ fav: number; saved: number }>({ fav: 0, saved: 0 });
  const ref = useRef<HTMLDivElement>(null);

  // Live favourite + saved-search counts (per-device), like the OLX menu.
  useEffect(() => {
    if (!open) return;
    const read = (k: string): number => {
      try {
        const v = JSON.parse(localStorage.getItem(k) ?? '[]') as unknown[];
        return Array.isArray(v) ? v.length : 0;
      } catch {
        return 0;
      }
    };
    setCounts({ fav: read('nhonga_favs'), saved: read('nhonga_saved_searches') });
  }, [open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const firstName = user ? (user.displayName.split(' ')[0] ?? '') : '';
  const groups = accountGroups(t, isSeller);
  const countFor = (href: string): number | null =>
    href === '/favoritos' ? counts.fav : href === '/pesquisas' ? counts.saved : null;

  return (
    <div className="acctmenu" ref={ref}>
      <button
        type="button"
        className="wlact acctmenu__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.account_label}
        onClick={() => setOpen((o) => !o)}
      >
        <IconUser width={22} height={22} />
        <span className="wlact__label acctmenu__name">{firstName || label}</span>
        <span className={`acctmenu__caret ${open ? 'is-open' : ''}`} aria-hidden="true">
          <IconChevronLeft width={14} height={14} />
        </span>
      </button>

      {open ? (
        <div className="acctmenu__panel" role="menu">
          {user ? (
            <a className="acctmenu__head" href="/conta" role="menuitem">
              <span className="acctmenu__avatar" aria-hidden="true">
                {(firstName[0] ?? 'U').toUpperCase()}
              </span>
              <span className="acctmenu__who">
                <strong>{firstName || t.menu_account}</strong>
                <span className="acctmenu__sub">
                  {isSeller ? (shop?.displayName ?? t.seller_badge) : t.buyer_badge}
                </span>
              </span>
            </a>
          ) : (
            <div className="acctmenu__guest">
              <p className="acctmenu__guesttitle">{t.guest_title}</p>
              <a className="btn btn--cta btn--sm" href="/entrar">
                {signInLabel}
              </a>
            </div>
          )}

          {groups.map((g) => (
            <div className="acctmenu__group" key={g.title}>
              <p className="acctmenu__gtitle">{g.title}</p>
              {g.items.map((it) => {
                const n = countFor(it.href);
                return (
                  <a className="acctmenu__item" href={it.href} key={it.href} role="menuitem">
                    {it.icon}
                    <span className="acctmenu__itemlabel">{it.label}</span>
                    {n !== null ? <span className="acctmenu__count">{n}</span> : null}
                  </a>
                );
              })}
            </div>
          ))}

          {user ? (
            <a className="acctmenu__item" href="/conta/privacidade" role="menuitem">
              <span className="acctmenu__itemlabel">{t.privacy_link}</span>
            </a>
          ) : null}
          {user ? (
            <button
              type="button"
              className="acctmenu__signout"
              role="menuitem"
              onClick={async () => {
                setOpen(false);
                await signOut();
                router.refresh();
              }}
            >
              {t.sign_out}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
