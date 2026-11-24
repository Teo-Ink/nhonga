'use client';
import { useState } from 'react';
import { openWhenReady, revealContact } from '../lib/seller-contact';

// Shop page WhatsApp button. The number is fetched when the visitor taps
// (PRIV-01), not shipped in the page.
export function ShopWhatsApp({
  vendorSlug,
  label,
  failed,
  limited,
}: {
  vendorSlug: string;
  label: string;
  failed: string;
  limited: string;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  function open() {
    void openWhenReady(
      revealContact({ vendorSlug }).then((r) => {
        if (!r.ok) {
          setNotice(r.limited ? limited : failed);
          return null;
        }
        setNotice(null);
        return r.numbers.whatsapp ? `https://wa.me/${r.numbers.whatsapp.replace(/\D/g, '')}` : null;
      }),
    );
  }
  return (
    <>
      <button type="button" className="btn btn--cta store__contact" onClick={open}>
        {label}
      </button>
      {notice ? <p role="alert">{notice}</p> : null}
    </>
  );
}
