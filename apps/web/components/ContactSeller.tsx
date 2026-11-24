'use client';
import { useEffect, useState } from 'react';
import { IconWhatsApp, IconPhone, IconShare, IconChat } from './icons';
import type { Dictionary } from '../lib/i18n/index';
import { formatMsisdn, maskedNumber, openWhenReady, revealContact } from '../lib/seller-contact';

// Classifieds contact block: WhatsApp first, then "Ver número" and in-app
// messaging, with sharing demoted to small links. WhatsApp opens with a
// pre-filled message. The page only knows WHICH channels the seller offers:
// the digits are fetched when the visitor taps (PRIV-01), and the API counts
// that request as a contact for the seller.
export function ContactSeller({
  slug,
  title,
  priceLabel,
  contact,
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
  /** Channels the seller offers, without the digits. */
  contact: { whatsapp: boolean; phone: boolean; hint: string | null } | null;
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
  function track(type: 'share') {
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
  const hasWa = contact?.whatsapp === true;
  const hasPhone = contact?.phone === true;
  const [notice, setNotice] = useState<string | null>(null);

  async function numbers() {
    const r = await revealContact({ productSlug: slug });
    if (!r.ok) setNotice(r.limited ? t.reveal_limited : t.reveal_failed);
    else setNotice(null);
    return r.ok ? r.numbers : null;
  }
  function openWhatsApp() {
    void openWhenReady(
      numbers().then((n) =>
        n?.whatsapp ? `https://wa.me/${n.whatsapp}?text=${encodeURIComponent(waText)}` : null,
      ),
    );
  }

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

  const hasContact = hasWa || hasPhone;
  const msgHref = vendorSlug
    ? `/mensagens/novo?loja=${encodeURIComponent(vendorSlug)}&produto=${encodeURIComponent(slug)}${
        vendorName ? `&nome=${encodeURIComponent(vendorName)}` : ''
      }`
    : null;

  // "Ver número" (OLX pattern): the number is not in the page at all; it is
  // fetched when asked for, which also counts as a lead for the seller.
  const [phone, setPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function reveal() {
    setLoading(true);
    const n = await numbers();
    setLoading(false);
    if (n?.phone) setPhone(n.phone);
  }
  const phoneButton = (cls: string, short: boolean) =>
    hasPhone ? (
      phone ? (
        <a className={cls} href={`tel:+${phone}`} aria-label={`${t.call} ${formatMsisdn(phone)}`}>
          <IconPhone width={18} height={18} /> {short ? t.call_short : formatMsisdn(phone)}
        </a>
      ) : (
        <button type="button" className={cls} onClick={reveal} disabled={loading}>
          <IconPhone width={18} height={18} />{' '}
          {short ? t.call_short : `${t.show_number} · ${maskedNumber(contact?.hint ?? null)}`}
        </button>
      )
    ) : null;
  const waButton = (label: string, size: number) =>
    hasWa ? (
      <button type="button" className="btn contactbtn contactbtn--wa" onClick={openWhatsApp}>
        <IconWhatsApp width={size} height={size} /> {label}
      </button>
    ) : null;

  return (
    <>
      <div className="contactbox">
        {waButton(ctaLabel ?? t.whatsapp, 20)}
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
        {notice ? (
          <p className="contactbox__none" role="alert">
            {notice}
          </p>
        ) : null}
        <p className="contactbox__safe">{safetyNote ?? t.safety}</p>
      </div>

      {/* Phones: contact stays in reach while reading the listing (OLX app
          pattern). Replaces the bottom tab bar on this page via CSS :has(). */}
      {hasContact || msgHref ? (
        <div className="stickycontact" role="region" aria-label={t.whatsapp}>
          <span className="stickycontact__price">{priceLabel}</span>
          <div className="stickycontact__btns">
            {msgHref && !hasWa ? (
              <a className="btn contactbtn contactbtn--msg" href={msgHref}>
                <IconChat width={18} height={18} /> {t.send_message}
              </a>
            ) : null}
            {phoneButton('btn contactbtn contactbtn--call', true)}
            {waButton(t.whatsapp_short, 18)}
          </div>
        </div>
      ) : null}
    </>
  );
}
