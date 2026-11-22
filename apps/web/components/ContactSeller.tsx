'use client';
import { useEffect, useState } from 'react';
import { IconWhatsApp, IconPhone, IconShare, IconChat } from './icons';
import type { Dictionary } from '../lib/i18n/index';

// Classifieds contact block: WhatsApp first, then "Ver número" and in-app
// messaging, with sharing demoted to small links. Each action records an engagement event (fire-and-forget)
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
  vendorSlug,
  vendorName,
  safetyNote,
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
  /** Shop slug + name — enables the in-app "Message" button. */
  vendorSlug?: string | null;
  vendorName?: string | null;
  /** Vertical-specific safety line; falls back to the generic one. */
  safetyNote?: string;
}) {
  function track(type: 'contact' | 'share') {
    void fetch('/api/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, type }),
      keepalive: true,
    }).catch(() => {});
  }

  // Read the page URL only after mount: using window.location during render
  // makes the server (empty) and client (full URL) markup differ, which React
  // reports as a hydration mismatch. Starting empty keeps SSR and the first
  // client render identical; the link is enriched with the URL right after.
  const [pageUrl, setPageUrl] = useState('');
  useEffect(() => {
    setPageUrl(window.location.href);
  }, []);

  const messageTpl = waMessage ?? t.wa_message;
  const message = messageTpl.replace('{title}', title).replace('{price}', priceLabel);
  const waText = pageUrl ? `${message} ${pageUrl}` : message;
  const waHref = whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(waText)}` : null;

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

  // Dedicated "share to WhatsApp" — the dominant sharing channel in Mozambique.
  // No phone number means wa.me opens the contact/group picker. Distinct from the
  // contact-seller button above (which targets the seller's own number).
  const shareText = t.share_wa_text.replace('{title}', title).replace('{price}', priceLabel);
  const shareWaHref = pageUrl
    ? `https://wa.me/?text=${encodeURIComponent(`${shareText} ${pageUrl}`)}`
    : '';

  const hasContact = Boolean(waHref || phone);
  const msgHref = vendorSlug
    ? `/mensagens/novo?loja=${encodeURIComponent(vendorSlug)}&produto=${encodeURIComponent(slug)}${
        vendorName ? `&nome=${encodeURIComponent(vendorName)}` : ''
      }`
    : null;

  // "Ver número" (OLX pattern): the number stays masked on screen until asked
  // for, and revealing it counts as a lead. Note the digits still travel in the
  // page payload; full anti-scraping needs a server endpoint that returns the
  // number on reveal (follow-up).
  const [revealed, setRevealed] = useState(false);
  function reveal() {
    if (!revealed) track('contact');
    setRevealed(true);
  }
  const phoneButton = (cls: string, short: boolean) =>
    phone ? (
      revealed ? (
        <a
          className={cls}
          href={`tel:+${phone}`}
          onClick={() => track('contact')}
          aria-label={`${t.call} ${formatMsisdn(phone)}`}
        >
          <IconPhone width={18} height={18} /> {short ? t.call_short : formatMsisdn(phone)}
        </a>
      ) : (
        <button type="button" className={cls} onClick={reveal}>
          <IconPhone width={18} height={18} />{' '}
          {short ? t.call_short : `${t.show_number} · ${maskMsisdn(phone)}`}
        </button>
      )
    ) : null;

  return (
    <>
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
        {phoneButton('btn contactbtn contactbtn--call', false)}
        {msgHref ? (
          <a className="btn contactbtn contactbtn--msg" href={msgHref}>
            <IconChat width={18} height={18} /> {t.send_message}
          </a>
        ) : null}
        <div className="contactbox__share" aria-label={t.share_label}>
          {shareWaHref ? (
            <a
              className="sharelink"
              href={shareWaHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('share')}
            >
              <IconWhatsApp width={16} height={16} /> {t.share_wa}
            </a>
          ) : null}
          <button type="button" className="sharelink" onClick={share}>
            <IconShare width={16} height={16} /> {t.share}
          </button>
        </div>
        {!hasContact ? <p className="contactbox__none">{t.no_contact}</p> : null}
        <p className="contactbox__safe">{safetyNote ?? t.safety}</p>
      </div>

      {/* Phones: contact stays in reach while reading the listing (OLX app
          pattern). Replaces the bottom tab bar on this page via CSS :has(). */}
      {hasContact || msgHref ? (
        <div className="stickycontact" role="region" aria-label={t.whatsapp}>
          <span className="stickycontact__price">{priceLabel}</span>
          <div className="stickycontact__btns">
            {msgHref && !waHref ? (
              <a className="btn contactbtn contactbtn--msg" href={msgHref}>
                <IconChat width={18} height={18} /> {t.send_message}
              </a>
            ) : null}
            {phoneButton('btn contactbtn contactbtn--call', true)}
            {waHref ? (
              <a
                className="btn contactbtn contactbtn--wa"
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('contact')}
              >
                <IconWhatsApp width={18} height={18} /> {t.whatsapp_short}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

// Display a Mozambican MSISDN (E.164 "258841234567") as "+258 84 123 4567".
// Falls back to a plain "+<digits>" for anything unexpected.
function formatMsisdn(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  const m = /^258(\d{2})(\d{3})(\d{4})$/.exec(digits);
  return m ? `+258 ${m[1]} ${m[2]} ${m[3]}` : `+${digits}`;
}

// "+258 84 ••• ••••": enough to recognise the network, not enough to scrape.
function maskMsisdn(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  const m = /^258(\d{2})\d{7}$/.exec(digits);
  return m ? `+258 ${m[1]} ••• ••••` : '••• ••• •••';
}
