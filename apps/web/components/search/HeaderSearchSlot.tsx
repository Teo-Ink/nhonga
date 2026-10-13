'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SearchBox, type SearchTools } from './SearchBox';

// The header search is redundant on the home page, where the hero already has a
// big search. So on the home page it stays hidden until the hero scrolls out of
// view, then fades in — one search visible at a time, but quick search is still
// there once you scroll. On every other page it shows normally.
export function HeaderSearchSlot({
  placeholder,
  categories,
  tools,
}: {
  placeholder: string;
  categories: { slug: string; label: string }[];
  tools: SearchTools;
}) {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!isHome) return;
    const onScroll = () => setScrolled(window.scrollY > 340);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHome]);

  const hidden = isHome && !scrolled;
  return (
    <div className={`wlhdr__searchslot ${hidden ? 'is-hidden' : ''}`} aria-hidden={hidden}>
      <SearchBox placeholder={placeholder} categories={categories} variant="header" tools={tools} />
    </div>
  );
}
