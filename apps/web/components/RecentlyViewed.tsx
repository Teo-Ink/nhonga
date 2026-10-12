'use client';
import { useEffect, useState } from 'react';
import { cents, formatMZN } from '@nhonga/shared';

const KEY = 'nhonga_recent';
const MAX = 12;

export interface RecentItem {
  slug: string;
  title: string;
  image: string | null;
  priceCents: number;
}

function read(): RecentItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as RecentItem[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// Invisible recorder: dropped on a product page, it prepends that listing to the
// per-device "recently viewed" list (deduped, capped), kept in localStorage.
export function RecordRecentView({ item }: { item: RecentItem }) {
  useEffect(() => {
    try {
      const next = [item, ...read().filter((r) => r.slug !== item.slug)].slice(0, MAX);
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode / storage blocked */
    }
  }, [item.slug]);
  return null;
}

// Home rail of the listings this device looked at — a re-engagement nudge.
// Renders nothing until hydrated and only when there is something to show.
export function RecentlyViewed({ title }: { title: string }) {
  const [items, setItems] = useState<RecentItem[] | null>(null);
  useEffect(() => setItems(read()), []);
  if (!items || items.length === 0) return null;

  return (
    <section className="section recentview" aria-label={title}>
      <h2 className="section__title">{title}</h2>
      <div className="recentview__rail">
        {items.map((p) => (
          <a className="recentcard" href={`/produto/${p.slug}`} key={p.slug}>
            <span
              className="recentcard__media"
              style={
                p.image ? { backgroundImage: `url("${p.image.replace(/["\\]/g, '')}")` } : undefined
              }
              aria-hidden="true"
            />
            <span className="recentcard__title">{p.title}</span>
            <span className="recentcard__price">{formatMZN(cents(p.priceCents))}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
