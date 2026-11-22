// Display formatting shared by cards, rows and the listing page.
//
// Prices follow how Mozambicans write them on classifieds: thousands with a
// dot and no centavos unless there actually are some ("750.000 MT", not
// "750.000,00 MT"). Key facts follow OLX's card pattern: the 2–4 attributes a
// buyer scans for in that category, in a fixed order, already formatted.

const groupInt = (n: number): string =>
  Math.trunc(Math.abs(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** "120.000" — dot-grouped integer (pt-MZ style, locale-independent output). */
export function formatNumber(n: number): string {
  return `${n < 0 ? '-' : ''}${groupInt(n)}`;
}

/** "750.000 MT", or "1.234,50 MT" when there are centavos. */
export function formatPrice(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const body = frac === 0 ? groupInt(whole) : `${groupInt(whole)},${String(frac).padStart(2, '0')}`;
  return `${sign}${body} MT`;
}

/** Categories whose price is a monthly amount (salaries). */
const MONTHLY = new Set(['empregos']);

/** Price with the unit buyers expect for the category ("25.000 MT/mês" for jobs). */
export function formatListingPrice(
  cents: number,
  categorySlug: string | undefined,
  lang: 'pt' | 'en' = 'pt',
): string {
  const base = formatPrice(cents);
  if (categorySlug && MONTHLY.has(categorySlug))
    return `${base}${lang === 'pt' ? '/mês' : '/month'}`;
  return base;
}

/** A purely numeric attribute value ("120000", "4", "85.5"); anything else → null. */
const num = (v: string | undefined): number | null => {
  if (v === undefined) return null;
  const t = String(v).trim();
  if (!/^\d+([.,]\d+)?$/.test(t)) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function formatDate(v: string, lang: 'pt' | 'en'): string {
  if (!ISO_DATE.test(v)) return v;
  const d = new Date(`${v}T12:00:00`);
  return d.toLocaleDateString(lang === 'pt' ? 'pt-PT' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a single attribute value for display, by key. Units are only added to
 * numeric values: jobs reuse the key "area" for the field of work
 * ("Transporte"), which must not become "0 m²".
 */
export function formatAttribute(key: string, value: string, lang: 'pt' | 'en' = 'pt'): string {
  const k = key.toLowerCase();
  if (k === 'km') {
    const n = num(value);
    return n === null ? value : `${formatNumber(n)} km`;
  }
  if (k === 'area') {
    const n = num(value);
    return n === null ? value : `${formatNumber(n)} m²`;
  }
  if (k === 'quartos') {
    const n = num(value);
    if (n === null) return value;
    return n === 0 ? (lang === 'pt' ? 'Estúdio' : 'Studio') : `T${n}`;
  }
  if (k === 'data') return formatDate(value, lang);
  return value;
}

/** Ordered keys that matter most per category (OLX-style card summary). */
const KEY_ORDER: Record<string, string[]> = {
  viaturas: ['ano', 'km', 'combustivel', 'caixa'],
  imoveis: ['quartos', 'area', 'negocio'],
  empregos: ['tipo_contrato', 'area'],
  eventos: ['tipo', 'data'],
  servicos: ['categoria_servico', 'zona'],
};

/**
 * The 2–4 facts a buyer scans first, formatted: "2016 · 120.000 km · Gasolina".
 * Categories without a fixed order show condition first, then up to 3 values.
 */
export function keyFacts(
  attributes: Record<string, string> | null | undefined,
  categorySlug: string | undefined,
  lang: 'pt' | 'en' = 'pt',
  max = 4,
): string[] {
  const attrs = attributes ?? {};
  const order = categorySlug ? KEY_ORDER[categorySlug] : undefined;
  const keys = order
    ? order.filter((k) => attrs[k] !== undefined && String(attrs[k]).trim() !== '')
    : [
        ...Object.keys(attrs).filter((k) => k.toLowerCase() === 'estado'),
        ...Object.keys(attrs).filter((k) => k.toLowerCase() !== 'estado'),
      ];
  return keys
    .map((k) => formatAttribute(k, String(attrs[k]), lang))
    .filter((v) => v.trim() !== '' && v.length <= 28)
    .slice(0, order ? max : Math.min(max, 3));
}
