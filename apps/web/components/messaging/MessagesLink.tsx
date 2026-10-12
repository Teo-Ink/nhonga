'use client';
import { useEffect, useState } from 'react';
import { IconChat } from '../icons';
import { useSession } from '../auth/SessionProvider';

// Header "Mensagens" action with an unread-conversations badge for signed-in
// users. Mirrors NotificationBell: refreshes on mount and on tab focus. Signed-
// out visitors still get the plain link (no badge, no fetch).
export function MessagesLink({ label }: { label: string }) {
  const { user, loading } = useSession();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (loading || !user) {
      setUnread(0);
      return;
    }
    let on = true;
    const load = () =>
      fetch('/api/conversations', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d: { unread?: number }) => on && setUnread(d.unread ?? 0))
        .catch(() => undefined);
    void load();
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      on = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [user, loading]);

  return (
    <a className="wlact wlact--hide-sm" href="/mensagens" aria-label={label} title={label}>
      <span className="notifbell-hdr__icon">
        <IconChat width={22} height={22} />
        {unread > 0 ? <span className="notifbell__badge">{unread > 9 ? '9+' : unread}</span> : null}
      </span>
    </a>
  );
}
