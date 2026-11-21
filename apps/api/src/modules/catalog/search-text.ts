/**
 * Search text helpers: normalisation, query expansion and typo correction.
 *
 * Pure functions (no DB) so they are unit-tested in isolation. The SQL side
 * normalises the haystack the same way (see SQL_NORMALISE_* below), so a
 * query typed with or without accents, in singular or plural, or with a common
 * synonym ("carro" for "viatura") finds the same listings.
 *
 * At real scale this moves to OpenSearch (D-09) with a Portuguese analyser and
 * a synonym filter; the behaviour users see is meant to stay the same.
 */

/** Accented characters and their plain equivalents, for SQL translate(). */
export const SQL_ACCENTS_FROM = 'áàâãäåéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ';
export const SQL_ACCENTS_TO = 'aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn';

/** Lower-case, strip accents, and collapse anything that is not a-z/0-9 to one space. */
export function normalise(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Words that carry no meaning on their own in a marketplace query. */
const STOPWORDS = new Set([
  'a',
  'o',
  'as',
  'os',
  'um',
  'uma',
  'uns',
  'umas',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'para',
  'pra',
  'com',
  'por',
  'ao',
  'aos',
  'the',
  'and',
  'for',
  'of',
  'in',
  'with',
  'vendo',
  'vende',
  'venda',
  'compro',
  'procuro',
]);

/** Split a query into meaningful, normalised tokens (stopwords removed, de-duplicated). */
export function tokenize(query: string): string[] {
  const out: string[] = [];
  for (const t of normalise(query).split(' ')) {
    if (t === '' || STOPWORDS.has(t)) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out.slice(0, 8);
}

/**
 * Groups of interchangeable terms (already normalised). A query word in a group
 * also matches every other word in it. Includes the category slugs/names so a
 * generic word ("carro") finds the whole vertical, not just titles with it.
 */
const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['carro', 'viatura', 'automovel', 'veiculo', 'viaturas', 'vehicle', 'carros'],
  ['mota', 'motorizada', 'moto', 'motocicleta', 'motorbike', 'scooter'],
  ['camiao', 'camioes', 'truck', 'chapa', 'minibus'],
  ['apartamento', 'flat', 'imovel', 'imoveis', 'moradia', 'vivenda', 'property', 'apartment'],
  ['terreno', 'talhao', 'lote', 'land', 'plot'],
  ['arrendamento', 'arrendar', 'aluguer', 'alugar', 'renda', 'rent', 'rental'],
  ['telemovel', 'celular', 'smartphone', 'telefone', 'phone', 'telemoveis'],
  ['portatil', 'laptop', 'computador', 'notebook', 'pc'],
  ['televisor', 'televisao', 'tv', 'television'],
  ['frigorifico', 'geleira', 'congelador', 'fridge', 'freezer'],
  ['emprego', 'vaga', 'trabalho', 'job', 'empregos', 'jobs', 'recrutamento'],
  ['servico', 'servicos', 'service', 'services'],
  ['evento', 'eventos', 'festa', 'concerto', 'bilhete', 'event', 'ticket'],
  ['roupa', 'vestuario', 'moda', 'clothes', 'fashion'],
  ['sapato', 'calcado', 'sandalia', 'tenis', 'shoes', 'sneakers'],
  ['electronica', 'eletronica', 'electronics', 'eletronico', 'electronico'],
  ['canalizador', 'picheleiro', 'plumber'],
  ['electricista', 'eletricista', 'electrician'],
  ['explicador', 'explicacao', 'aulas', 'professor', 'tutor', 'lessons'],
];

const SYNONYMS: ReadonlyMap<string, readonly string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const group of SYNONYM_GROUPS) {
    for (const w of group) {
      const cur = m.get(w) ?? [];
      for (const other of group) if (other !== w && !cur.includes(other)) cur.push(other);
      m.set(w, cur);
    }
  }
  return m;
})();

/**
 * Singular/plural forms of a Portuguese (or English) word. Prefix matching in
 * SQL already covers singular → plural for most words ("carro" finds
 * "carros"), so this mainly handles irregular endings in both directions.
 */
export function inflections(word: string): string[] {
  const forms = new Set<string>([word]);
  if (word.length < 3) return [...forms];
  const add = (f: string): void => {
    if (f.length >= 2) forms.add(f);
  };
  // plural → singular
  if (word.endsWith('oes')) add(`${word.slice(0, -3)}ao`);
  if (word.endsWith('aes')) add(`${word.slice(0, -3)}ao`);
  if (word.endsWith('eis')) {
    add(`${word.slice(0, -3)}el`);
    add(`${word.slice(0, -3)}il`);
  }
  if (word.endsWith('ais')) add(`${word.slice(0, -3)}al`);
  if (word.endsWith('ois')) add(`${word.slice(0, -3)}ol`);
  if (word.endsWith('ns')) add(`${word.slice(0, -2)}m`);
  if (word.endsWith('res') || word.endsWith('zes') || word.endsWith('ses')) add(word.slice(0, -2));
  if (word.endsWith('s') && word.length > 3) add(word.slice(0, -1));
  // singular → plural (only the irregular ones; regular "+s" is a prefix match)
  if (word.endsWith('el')) add(`${word.slice(0, -2)}eis`);
  if (word.endsWith('al')) add(`${word.slice(0, -2)}ais`);
  if (word.endsWith('ao')) {
    add(`${word.slice(0, -2)}oes`);
    add(`${word.slice(0, -2)}aes`);
  }
  if (word.endsWith('m')) add(`${word.slice(0, -1)}ns`);
  return [...forms];
}

/**
 * Every normalised term a single query token should match: the token, its
 * inflections, and synonyms of each. Order puts the literal token first.
 */
export function expandToken(token: string): string[] {
  const out = new Set<string>();
  for (const f of inflections(token)) {
    out.add(f);
    for (const s of SYNONYMS.get(f) ?? []) for (const g of inflections(s)) out.add(g);
  }
  return [...out].slice(0, 24);
}

/**
 * Terms shorter than this must match a whole word (plus an optional plural
 * ending): "casa" finds "casas" but not "casamentos", "tv" finds "tvs" but not
 * "tvbox". Longer terms match as a word prefix, so "telemov" or "frigorif" work.
 */
export const WHOLE_WORD_BELOW = 6;

/** Postgres regex (ARE) for a normalised term, mirroring matchesTerm(). */
export function termRegex(term: string): string {
  return term.length < WHOLE_WORD_BELOW ? `\\m${term}(s|es)?\\M` : `\\m${term}`;
}

/** True when `term` matches a word in the normalised `haystack` (see WHOLE_WORD_BELOW). */
export function matchesTerm(haystack: string, term: string): boolean {
  if (term === '') return false;
  const re =
    term.length < WHOLE_WORD_BELOW
      ? new RegExp(`(^| )${term}(s|es)?( |$)`)
      : new RegExp(`(^| )${term}`);
  return re.test(haystack);
}

/** Fields of a listing used for relevance scoring, each already normalised. */
export interface ScoringFields {
  readonly title: string;
  readonly category: string;
  readonly attributes: string;
  readonly location: string;
  readonly vendor: string;
  readonly description: string;
}

const FIELD_WEIGHTS: ReadonlyArray<[keyof ScoringFields, number]> = [
  ['title', 6],
  ['category', 5],
  ['attributes', 3],
  ['location', 2],
  ['vendor', 1],
  ['description', 1],
];

/**
 * Relevance score: for each query token, the weight of the best field it hits,
 * plus a bonus when the literal token is in the title. A synonym hit counts
 * fully on the category (that is what synonyms are for: "carro" → Viaturas)
 * but only half elsewhere, so a job titled "Heavy-vehicle driver" does not
 * outrank actual cars for "carro".
 */
export function scoreListing(tokens: readonly string[], f: ScoringFields): number {
  let score = 0;
  for (const token of tokens) {
    const alts = expandToken(token);
    let best = 0;
    for (const [field, weight] of FIELD_WEIGHTS) {
      const hay = f[field];
      if (matchesTerm(hay, token)) best = Math.max(best, weight);
      else if (alts.some((a) => matchesTerm(hay, a))) {
        best = Math.max(best, field === 'category' ? weight : weight * 0.5);
      }
    }
    if (matchesTerm(f.title, token)) best += 2;
    score += best;
  }
  return score;
}

/** Optimal-string-alignment distance (Levenshtein plus adjacent swaps). */
export function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = new Array<number>(b.length + 1).fill(0);
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2]! + 1);
      }
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev2[j] = prev[j]!;
    prev = cur;
  }
  return prev[b.length]!;
}

/**
 * Correct misspelt tokens against a vocabulary of words that actually occur in
 * listings. Tokens shorter than 4 characters, numbers, and words already in the
 * vocabulary (or one of their expansions) are left alone. Returns null when
 * nothing changed.
 */
export function correctTokens(
  tokens: readonly string[],
  vocabulary: ReadonlyMap<string, number>,
): string[] | null {
  let changed = false;
  const out = tokens.map((t) => {
    if (t.length < 4 || /^\d+$/.test(t)) return t;
    if (expandToken(t).some((a) => vocabulary.has(a))) return t;
    const maxDist = t.length <= 5 ? 1 : 2;
    let best: string | null = null;
    let bestDist = maxDist + 1;
    let bestFreq = -1;
    for (const [w, freq] of vocabulary) {
      if (Math.abs(w.length - t.length) > maxDist) continue;
      const d = editDistance(t, w, maxDist);
      if (d < bestDist || (d === bestDist && freq > bestFreq)) {
        best = w;
        bestDist = d;
        bestFreq = freq;
      }
    }
    if (best !== null && bestDist <= maxDist) {
      changed = true;
      return best;
    }
    return t;
  });
  return changed ? out : null;
}

/** Count normalised words (3+ letters) across texts, for the typo vocabulary. */
export function buildVocabulary(texts: Iterable<string | null | undefined>): Map<string, number> {
  const vocab = new Map<string, number>();
  for (const text of texts) {
    if (!text) continue;
    for (const w of normalise(text).split(' ')) {
      if (w.length < 3 || /^\d+$/.test(w)) continue;
      vocab.set(w, (vocab.get(w) ?? 0) + 1);
    }
  }
  // Synonym words are valid queries too, even if no listing uses them yet.
  for (const group of SYNONYM_GROUPS) for (const w of group) if (!vocab.has(w)) vocab.set(w, 0);
  return vocab;
}
