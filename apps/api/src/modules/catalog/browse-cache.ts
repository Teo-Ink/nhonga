/**
 * Short-lived cache for public catalogue pages (PRE-05).
 *
 * The site asks the API for the same few lists on every page view (home,
 * categories, popular searches). On a 50 000-listing catalogue the unfiltered
 * list costs about 120 ms of database time, so thirty people opening the home
 * page in the same second queued for over a second each. Keeping an answer for
 * a few seconds makes that one query instead of thirty.
 *
 * - Only anonymous, read-only catalogue answers go in here.
 * - An entry holds the promise, so concurrent identical requests share one
 *   database query (no stampede).
 * - Any listing write in this process clears it; other API tasks catch up
 *   when the entry expires (CATALOG_CACHE_SECONDS, default 15; 0 turns it off).
 */
export class BrowseCache<T> {
  private readonly entries = new Map<string, { at: number; value: Promise<T> }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 300,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string, load: () => Promise<T>): Promise<T> {
    if (this.ttlMs <= 0) return load();
    const t = this.now();
    const hit = this.entries.get(key);
    if (hit && t - hit.at < this.ttlMs) return hit.value;

    const value = load();
    this.entries.set(key, { at: t, value });
    // A failed query must not be served again.
    value.catch(() => {
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
    });
    if (this.entries.size > this.maxEntries) {
      // Oldest first: Map keeps insertion order.
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    return value;
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

/** Cache lifetime from CATALOG_CACHE_SECONDS (default 15 s, capped at 5 min). */
export function browseCacheTtlMs(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return 15_000;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 300) * 1000 : 15_000;
}
