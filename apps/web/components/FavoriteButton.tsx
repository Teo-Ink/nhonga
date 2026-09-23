'use client';
import { useEffect, useState } from 'react';
import { IconHeart, IconHeartFilled } from './icons';

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

  useEffect(() => {
    setOn(read().includes(id));
  }, [id]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const list = read();
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
    setOn(next.includes(id));
    window.dispatchEvent(new Event('nhonga-favs'));
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
