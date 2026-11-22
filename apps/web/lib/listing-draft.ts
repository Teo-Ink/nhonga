// Local draft of the new-listing form (P1-11). A connection that drops, a page
// reload, or the sign-in step in the middle of publishing (P0-02) must not
// throw away what the seller typed and the photos they picked.
//
// Kept in localStorage on this device only. Photos are compressed data URLs
// and can exceed the storage quota; when they do, the text is still saved.

export interface ListingDraft {
  title: string;
  category: string;
  description: string;
  price: string;
  stock: string;
  plan: 'free' | 'destaque' | 'turbo';
  shopName: string;
  photos: string[];
}

export const DRAFT_KEY = 'nhonga.listing-draft.v1';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function store(): Store | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function isEmptyDraft(d: ListingDraft): boolean {
  return (
    d.title.trim() === '' &&
    d.description.trim() === '' &&
    d.price.trim() === '' &&
    d.category === '' &&
    d.photos.length === 0
  );
}

export function saveDraft(d: ListingDraft, s: Store | null = store()): void {
  if (!s) return;
  if (isEmptyDraft(d)) {
    s.removeItem(DRAFT_KEY);
    return;
  }
  try {
    s.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    // Quota exceeded: keep the words, drop the photos.
    try {
      s.setItem(DRAFT_KEY, JSON.stringify({ ...d, photos: [] }));
    } catch {
      /* storage unavailable; nothing else to do */
    }
  }
}

export function loadDraft(s: Store | null = store()): ListingDraft | null {
  if (!s) return null;
  try {
    const raw = s.getItem(DRAFT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<ListingDraft>;
    const str = (x: unknown): string => (typeof x === 'string' ? x : '');
    const plan = v.plan === 'destaque' || v.plan === 'turbo' ? v.plan : 'free';
    return {
      title: str(v.title),
      category: str(v.category),
      description: str(v.description),
      price: str(v.price),
      stock: str(v.stock),
      plan,
      shopName: str(v.shopName),
      photos: Array.isArray(v.photos)
        ? v.photos.filter((p): p is string => typeof p === 'string' && p.startsWith('data:image/'))
        : [],
    };
  } catch {
    return null;
  }
}

export function clearDraft(s: Store | null = store()): void {
  try {
    s?.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
