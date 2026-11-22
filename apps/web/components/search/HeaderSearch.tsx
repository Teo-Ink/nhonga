'use client';
import { useEffect, useState } from 'react';
import { SearchBox, type SearchTools } from './SearchBox';

// Compact search in the sticky header, so search is one tap away on every page
// (product, category, account…), not only in the home hero. On the results
// page it is prefilled with the current query. Hidden on phones, where the
// bottom tab bar carries search.
export function HeaderSearch({
  placeholder,
  categories,
  tools,
}: {
  placeholder: string;
  categories: { slug: string; label: string }[];
  tools: SearchTools;
}) {
  const [q, setQ] = useState('');
  useEffect(() => {
    if (window.location.pathname.startsWith('/pesquisa')) {
      setQ(new URLSearchParams(window.location.search).get('q') ?? '');
    }
  }, []);
  return (
    <div className="wlhdr__search">
      <SearchBox
        key={q}
        placeholder={placeholder}
        categories={categories}
        variant="header"
        initialQuery={q}
        tools={tools}
      />
    </div>
  );
}
