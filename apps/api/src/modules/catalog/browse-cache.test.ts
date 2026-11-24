import { describe, expect, it } from 'vitest';
import { BrowseCache, browseCacheTtlMs } from './browse-cache.js';

describe('BrowseCache (PRE-05)', () => {
  it('shares one load between identical requests and expires', async () => {
    let now = 0;
    let loads = 0;
    const cache = new BrowseCache<number>(1000, 10, () => now);
    const load = () => Promise.resolve(++loads);
    expect(await Promise.all([cache.get('a', load), cache.get('a', load)])).toEqual([1, 1]);
    now = 999;
    expect(await cache.get('a', load)).toBe(1);
    now = 1000;
    expect(await cache.get('a', load)).toBe(2);
    expect(await cache.get('b', load)).toBe(3);
  });

  it('forgets everything on a write and never keeps a failure', async () => {
    const cache = new BrowseCache<number>(1000);
    await cache.get('a', () => Promise.resolve(1));
    cache.clear();
    expect(await cache.get('a', () => Promise.resolve(2))).toBe(2);
    await expect(cache.get('x', () => Promise.reject(new Error('db')))).rejects.toThrow('db');
    await Promise.resolve();
    expect(await cache.get('x', () => Promise.resolve(7))).toBe(7);
  });

  it('is bounded and can be switched off', async () => {
    const cache = new BrowseCache<number>(1000, 2);
    for (const k of ['a', 'b', 'c']) await cache.get(k, () => Promise.resolve(1));
    expect(cache.size).toBe(2);
    let loads = 0;
    const off = new BrowseCache<number>(0);
    await off.get('a', () => Promise.resolve(++loads));
    await off.get('a', () => Promise.resolve(++loads));
    expect(loads).toBe(2);
  });

  it('reads the lifetime from the environment', () => {
    expect(browseCacheTtlMs(undefined)).toBe(15_000);
    expect(browseCacheTtlMs('0')).toBe(0);
    expect(browseCacheTtlMs('30')).toBe(30_000);
    expect(browseCacheTtlMs('9999')).toBe(300_000);
    expect(browseCacheTtlMs('abc')).toBe(15_000);
  });
});
