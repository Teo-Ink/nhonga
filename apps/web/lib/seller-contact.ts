// Client helper: ask for a seller's numbers when the visitor wants to contact
// (PRIV-01). One request per page: the answer is remembered.

export interface SellerNumbers {
  whatsapp: string | null;
  phone: string | null;
}
export type RevealResult = { ok: true; numbers: SellerNumbers } | { ok: false; limited: boolean };

const cache = new Map<string, Promise<RevealResult>>();

export function revealContact(
  target: { productSlug: string } | { vendorSlug: string },
): Promise<RevealResult> {
  const key = JSON.stringify(target);
  const hit = cache.get(key);
  if (hit) return hit;
  const p = fetch('/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: key,
  })
    .then(async (res): Promise<RevealResult> => {
      if (!res.ok) return { ok: false, limited: res.status === 429 };
      return { ok: true, numbers: (await res.json()) as SellerNumbers };
    })
    .catch((): RevealResult => ({ ok: false, limited: false }));
  cache.set(key, p);
  // A failure is not remembered: the visitor can try again.
  void p.then((r) => {
    if (!r.ok) cache.delete(key);
  });
  return p;
}

/**
 * Opens a link that is only known after a request. The tab is opened during
 * the tap (so the browser does not block it as a pop-up) and pointed at the
 * link when it arrives; if the tab could not be opened, this one navigates.
 */
export async function openWhenReady(href: Promise<string | null>): Promise<boolean> {
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;
  const url = await href;
  if (!url) {
    tab?.close();
    return false;
  }
  if (tab) tab.location.href = url;
  else window.location.href = url;
  return true;
}

// Display a Mozambican MSISDN (E.164 "258841234567") as "+258 84 123 4567".
export function formatMsisdn(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  const m = /^258(\d{2})(\d{3})(\d{4})$/.exec(digits);
  return m ? `+258 ${m[1]} ${m[2]} ${m[3]}` : `+${digits}`;
}

// "+258 84 ••• ••••" from the operator prefix the page is given ("25884").
export function maskedNumber(hint: string | null): string {
  const m = /^258(\d{2})$/.exec(hint ?? '');
  return m ? `+258 ${m[1]} ••• ••••` : '••• ••• •••';
}
