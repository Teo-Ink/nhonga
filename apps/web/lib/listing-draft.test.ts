import { describe, expect, it } from 'vitest';
import { DRAFT_KEY, clearDraft, loadDraft, saveDraft, type ListingDraft } from './listing-draft';

function memory(quota = Infinity) {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (v.length > quota) throw new Error('QuotaExceededError');
      m.set(k, v);
    },
    removeItem: (k: string) => void m.delete(k),
  };
}

const draft: ListingDraft = {
  title: 'Toyota Hilux 2015',
  category: 'viaturas',
  description: 'Bom estado',
  price: '850000',
  stock: '1',
  plan: 'free',
  shopName: '',
  photos: ['data:image/webp;base64,AAAA'],
};

describe('listing draft', () => {
  it('round-trips the form', () => {
    const s = memory();
    saveDraft(draft, s);
    expect(loadDraft(s)).toEqual(draft);
  });

  it('keeps the text when the photos do not fit', () => {
    const s = memory(200);
    saveDraft({ ...draft, photos: ['data:image/webp;base64,' + 'A'.repeat(500)] }, s);
    expect(loadDraft(s)?.title).toBe(draft.title);
    expect(loadDraft(s)?.photos).toEqual([]);
  });

  it('does not store an empty form and clears on publish', () => {
    const s = memory();
    saveDraft({ ...draft, title: '', description: '', price: '', category: '', photos: [] }, s);
    expect(s.m.has(DRAFT_KEY)).toBe(false);
    saveDraft(draft, s);
    clearDraft(s);
    expect(loadDraft(s)).toBeNull();
  });

  it('ignores corrupt or hostile stored values', () => {
    const s = memory();
    s.setItem(DRAFT_KEY, '{not json');
    expect(loadDraft(s)).toBeNull();
    s.setItem(DRAFT_KEY, JSON.stringify({ title: 5, plan: 'x', photos: ['javascript:alert(1)'] }));
    expect(loadDraft(s)).toMatchObject({ title: '', plan: 'free', photos: [] });
  });
});
