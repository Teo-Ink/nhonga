import { cookies } from 'next/headers';
import { pt, type Dictionary } from './pt';
import { en } from './en';

export type Locale = 'pt' | 'en';
export const LOCALES: Locale[] = ['pt', 'en'];
export const DEFAULT_LOCALE: Locale = 'pt';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

const DICTS: Record<Locale, Dictionary> = { pt, en };

/** Current locale from the cookie, defaulting to Portuguese. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const v = store.get(LOCALE_COOKIE)?.value;
  return v === 'en' ? 'en' : DEFAULT_LOCALE;
}

export async function getDictionary(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await getLocale();
  return { locale, t: DICTS[locale] };
}

/** Interpolate {name} placeholders. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export type { Dictionary };
