'use client';
import { useEffect, useState } from 'react';
import { useSession } from '../../components/auth/SessionProvider';
import { IconGift, IconWhatsApp } from '../../components/icons';
import { pt } from '../../lib/i18n/pt';

// Invite friends (H). A signed-in user gets a shareable invite link built from
// their account (a short code from their id). Sharing and copying work; reward
// tracking is intentionally not wired and that is stated on the page.
export default function InvitePage() {
  const t = pt.refer;
  const { user } = useSession();
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  if (!user) {
    return (
      <section className="section">
        <div className="section__head">
          <h1 className="section__title">{t.title}</h1>
        </div>
        <div className="reviews__signin">
          <span>{t.signin_prompt}</span>
          <a className="btn btn--ghost" href="/entrar?next=/convidar">
            {t.signin_cta}
          </a>
        </div>
      </section>
    );
  }

  const code = user.id.replace(/-/g, '').slice(0, 8).toUpperCase();
  const link = `${origin}/convite/${code}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${t.wa_text} ${link}`)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="section adpage">
      <div className="section__head">
        <h1 className="section__title">{t.title}</h1>
      </div>
      <p className="adpage__lead">{t.subtitle}</p>
      <p className="notice" role="note">
        {t.demo_note}
      </p>

      <div className="refer">
        <span className="refer__badge" aria-hidden="true">
          <IconGift width={28} height={28} />
        </span>
        <label className="refer__label" htmlFor="referlink">
          {t.your_link}
        </label>
        <div className="refer__linkrow">
          <input id="referlink" className="field__input" readOnly value={link} />
          <button type="button" className="btn btn--ghost" onClick={copy}>
            {copied ? t.copied : t.copy}
          </button>
        </div>
        <a className="btn btn--primary refer__wa" href={waHref} target="_blank" rel="noopener noreferrer">
          <IconWhatsApp width={18} height={18} /> {t.share_wa}
        </a>
      </div>

      <h2 className="adpage__h2">{t.how_title}</h2>
      <ol className="refer__steps">
        <li>{t.step1}</li>
        <li>{t.step2}</li>
        <li>{t.step3}</li>
      </ol>
    </section>
  );
}
