'use client';
import { IconWhatsApp, IconPhone, IconShare } from './icons';
import type { Dictionary } from '../lib/i18n/index';

// Classifieds contact block: WhatsApp + call + share, replacing the old
// add-to-cart box. Each action records an engagement event (fire-and-forget)
// so sellers see contacts/shares. WhatsApp opens with a pre-filled message.
export function ContactSeller({
  slug,
  title,
  priceLabel,
  whatsapp,
  phone,
  t,
  ctaLabel,
  waMessage,
}: {
  slug: string;
  title: string;
  priceLabel: string;
  whatsapp: string | null;
  phone: string | null;
  t: Dictionary['contact'];
  /** Overrides the WhatsApp button label (e.g. "Candidatar-me" for jobs). */
  ctaLabel?: string;
  /** Overrides the pre-filled WhatsApp message template ({title}/{price}). */
  waMessage?: string;
}) {
  function track(type: 'contact' | 'share') {
    void fetch('/api/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, type }),
      keepalive: true,
    }).catch(() => {});
  }

  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
  const messageTpl = waMessage ?? t.wa_message;
  const waHref = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(
        `${messageTpl.replace('{title}', title).replace('{price}', priceLabel)} ${pageUrl}`,
      )}`
    : null;

  async function share() {
    track('share');
    const data = { title, text: title, url: pageUrl };
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch {
        /* cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(pageUrl);
    } catch {
      /* ignore */
    }
  }

  const hasContact = Boolean(waHref || phone);

  return (
    <div className="contactbox">
      {waHref ? (
        <a
          className="btn contactbtn contactbtn--wa"
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('contact')}
        >
          <IconWhatsApp width={20} height={20} /> {ctaLabel ?? t.whatsapp}
        </a>
      ) : null}
      {phone ? (
        <a
          className="btn contactbtn contactbtn--call"
          href={`tel:+${phone}`}
          onClick={() => track('contact')}
        >
          <IconPhone width={18} height={18} /> {t.call}
        </a>
      ) : null}
      <button type="button" className="btn contactbtn contactbtn--share" onClick={share}>
        <IconShare width={18} height={18} /> {t.share}
      </button>
      {!hasContact ? <p className="contactbox__none">{t.no_contact}</p> : null}
      <p className="contactbox__safe">{t.safety}</p>
    </div>
  );
}
