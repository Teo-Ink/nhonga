'use client';
import { createContext, useContext } from 'react';
import { pt, type Dictionary } from '../../lib/i18n/pt';
import { en } from '../../lib/i18n/en';
import type { Locale } from '../../lib/i18n/index';

// Makes the active locale available to client components so they render the
// right dictionary without a hydration mismatch: the server layout seeds the
// locale (from the NEXT_LOCALE cookie), so SSR and the client agree. Both
// dictionaries ship in the client bundle; we select by locale.
const DICTS: Record<Locale, Dictionary> = { pt, en };
const LocaleCtx = createContext<Locale>('pt');

export function DictProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleCtx.Provider value={locale}>{children}</LocaleCtx.Provider>;
}

/** The dictionary for the active locale (for client components). */
export function useDict(): Dictionary {
  return DICTS[useContext(LocaleCtx)];
}
