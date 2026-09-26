'use client';
import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { IconBell } from './icons';

const KEY = 'nhonga_saved_searches';

export interface SavedSearch {
  href: string;
  label: string;
  createdAt: number;
}

function read(): SavedSearch[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as SavedSearch[];
  } catch {
    return [];
  }
}
function write(list: SavedSearch[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event('nhonga-saved'));
}

// "Guardar pesquisa" — saves the current search (path + filters) to localStorage
// so the visitor can re-run it from /pesquisas. Per-device, no backend; alerts
// (push/SMS) are intentionally not wired and that is stated on the list page.
export function SaveSearch({
  title,
  saveLabel,
  savedLabel,
}: {
  title: string;
  saveLabel: string;
  savedLabel: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const qs = params.toString();
  const href = qs ? `${pathname}?${qs}` : pathname;
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(read().some((s) => s.href === href));
  }, [href]);

  function toggle() {
    const list = read();
    const exists = list.some((s) => s.href === href);
    const next = exists
      ? list.filter((s) => s.href !== href)
      : [{ href, label: labelFor(title, qs), createdAt: Date.now() }, ...list];
    write(next);
    setSaved(!exists);
  }

  return (
    <button
      type="button"
      className={`savesearch ${saved ? 'is-on' : ''}`}
      aria-pressed={saved}
      onClick={toggle}
    >
      <IconBell width={16} height={16} />
      {saved ? savedLabel : saveLabel}
    </button>
  );
}

// A readable label: the page title plus how many filters are active.
function labelFor(title: string, qs: string): string {
  const n = qs ? new URLSearchParams(qs).size : 0;
  return n > 0 ? `${title} (${n})` : title;
}
