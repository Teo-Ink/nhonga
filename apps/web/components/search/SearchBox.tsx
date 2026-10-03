'use client';
import { useEffect, useRef, useState } from 'react';
import { IconSearch } from '../icons';

interface Cat {
  slug: string;
  label: string;
}
interface Sug {
  slug: string;
  title: string;
}
type Item = { kind: 'cat'; slug: string; label: string } | { kind: 'prod'; slug: string; title: string };

// Search input with an autocomplete dropdown: matching categories (filtered
// from the known list) + live listing-title suggestions from the API. Enter
// with nothing highlighted runs a normal /pesquisa search; arrows + Enter pick a
// suggestion. Works as the header search and the hero search.
export function SearchBox({
  placeholder,
  categories,
  variant = 'header',
  initialQuery = '',
  submitLabel,
}: {
  placeholder: string;
  categories: Cat[];
  variant?: 'header' | 'hero';
  initialQuery?: string;
  submitLabel?: string;
}) {
  const [q, setQ] = useState(initialQuery);
  const [sugs, setSugs] = useState<Sug[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  const term = q.trim();
  const catMatches: Cat[] =
    term.length >= 2
      ? categories.filter((c) => c.label.toLowerCase().includes(term.toLowerCase())).slice(0, 4)
      : [];
  const items: Item[] = [
    ...catMatches.map((c) => ({ kind: 'cat' as const, slug: c.slug, label: c.label })),
    ...sugs.map((s) => ({ kind: 'prod' as const, slug: s.slug, title: s.title })),
  ];

  useEffect(() => {
    if (term.length < 2) {
      setSugs([]);
      return;
    }
    const ctrl = new AbortController();
    const id = window.setTimeout(() => {
      void fetch(`/api/suggest?q=${encodeURIComponent(term)}`, {
        signal: ctrl.signal,
        cache: 'no-store',
      })
        .then((r) => r.json())
        .then((d: Sug[]) => setSugs(Array.isArray(d) ? d : []))
        .catch(() => undefined);
    }, 220);
    return () => {
      ctrl.abort();
      window.clearTimeout(id);
    };
  }, [term]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function go(item: Item) {
    window.location.href =
      item.kind === 'cat' ? `/categoria/${item.slug}` : `/produto/${item.slug}`;
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      go(items[active]!);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showDrop = open && term.length >= 2 && items.length > 0;

  return (
    <div className={`searchbox searchbox--${variant}`} ref={boxRef}>
      <form
        className={variant === 'hero' ? 'herofind__search' : 'wlsearch'}
        role="search"
        action="/pesquisa"
        method="get"
        autoComplete="off"
      >
        <IconSearch width={variant === 'hero' ? 22 : 20} height={variant === 'hero' ? 22 : 20} aria-hidden />
        <label htmlFor={`sb-${variant}`} className="sr-only">
          {placeholder}
        </label>
        <input
          id={`sb-${variant}`}
          name="q"
          placeholder={placeholder}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showDrop}
          aria-controls={`sbdrop-${variant}`}
        />
        {variant === 'hero' && submitLabel ? (
          <button type="submit" className="btn btn--cta herofind__btn">
            {submitLabel}
          </button>
        ) : null}
      </form>

      {showDrop ? (
        <ul className="searchbox__drop" id={`sbdrop-${variant}`} role="listbox">
          {items.map((it, i) => (
            <li key={`${it.kind}-${it.slug}`}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                className={`searchbox__opt ${i === active ? 'is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(it);
                }}
              >
                <IconSearch width={15} height={15} aria-hidden />
                <span className="searchbox__optlabel">
                  {it.kind === 'cat' ? it.label : it.title}
                </span>
                {it.kind === 'cat' ? <span className="searchbox__opttag">categoria</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
