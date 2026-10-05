'use client';
import { useEffect, useState } from 'react';
import { IconBell } from '../icons';
import { useSession } from '../auth/SessionProvider';

// Global header bell: for a signed-in seller it shows the unread notification
// count and links to the notifications page. Refreshes on mount and whenever the
// tab regains focus, so a new contact/review shows up without a reload. Renders
// nothing for signed-out visitors.
export function NotificationBell({ label }: { label: string }) {
  const { user, loading } = useSession();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (loading || !user) {
      setUnread(0);
      return;
    }
    let active = true;
    const load = () =>
      fetch('/api/notifications', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d: { unread?: number }) => active && setUnread(d.unread ?? 0))
        .catch(() => undefined);
    void load();
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [user, loading]);

  if (!user) return null;

  return (
    <a className="wlact wlact--hide-sm notifbell-hdr" href="/conta/notificacoes" aria-label={label}>
      <span className="notifbell-hdr__icon">
        <IconBell width={22} height={22} />
        {unread > 0 ? (
          <span className="notifbell__badge">{unread > 9 ? '9+' : unread}</span>
        ) : null}
      </span>
    </a>
  );
}
