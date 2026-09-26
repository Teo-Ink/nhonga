import type { Metadata } from 'next';
import { IconGift } from '../../../components/icons';
import { getDictionary } from '../../../lib/i18n/index';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: `${t.refer.landing_title} — ${t.common.brand}` };
}

// Invite landing (H). A friendly welcome for a referred visitor, with the code
// shown and a create-account CTA. Attribution is not wired (honest demo).
export default async function InviteLanding({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { t } = await getDictionary();
  const safeCode = code.replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase();

  return (
    <section className="section invite">
      <span className="invite__badge" aria-hidden="true">
        <IconGift width={40} height={40} />
      </span>
      <h1 className="section__title">{t.refer.landing_title}</h1>
      <p className="invite__body">{t.refer.landing_body}</p>
      {safeCode ? (
        <p className="invite__code">
          {t.refer.landing_code}: <strong>{safeCode}</strong>
        </p>
      ) : null}
      <a className="btn btn--cta invite__cta" href="/entrar?next=/">
        {t.refer.landing_cta}
      </a>
      <p className="notice" role="note">
        {t.refer.landing_note}
      </p>
    </section>
  );
}
