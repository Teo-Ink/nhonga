'use client';
import { useEffect, useState } from 'react';
import { IconHeart, IconHeartFilled } from './icons';
import { useSession } from './auth/SessionProvider';

const KEY = 'nhonga_favs';

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

// Real local favourite toggle (stored per-device in localStorage), matching the
// classifieds heart pattern. No backend needed; the /favoritos page reads the
// same list. Rendered as a sibling of the card link, not nested in it.
export function FavoriteButton({ id, label }: { id: string; label: string }) {
  const [on, setOn] = useState(false);
  const { user } = useSession();

  useEffect(() => {
    setOn(read().includes(id));
  }, [id]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const list = read();
    const adding = !list.includes(id);
    const next = adding ? [...list, id] : list.filter((x) => x !== id);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
    setOn(adding);
    window.dispatchEvent(new Event('nhonga-favs'));

    // Signed-in: mirror to the server too (cross-device + price-drop alerts).
    if (user) {
      if (adding) {
        void fetch('/api/favorites', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ productId: id }),
        }).catch(() => undefined);
      } else {
        void fetch(`/api/favorites/${id}`, { method: 'DELETE' }).catch(() => undefined);
      }
    }
  }

  return (
    <button
      type="button"
      className={`favbtn ${on ? 'is-on' : ''}`}
      aria-pressed={on}
      aria-label={label}
      onClick={toggle}
    >
      {on ? <IconHeartFilled width={18} height={18} /> : <IconHeart width={18} height={18} />}
    </button>
  );
}
