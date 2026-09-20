import { EmptyState } from '../../components/ui';
import { IconUser } from '../../components/icons';
import { getDictionary } from '../../lib/i18n/index';

export const dynamic = 'force-dynamic';

// Messages inbox. Messaging is not wired and there are no real conversations to
// show — inventing seller threads would be fake data — so this is an honest
// empty state. Real conversations start from a seller's "Contact seller"
// button, which opens the compose screen.
export default async function MessagesPage() {
  const { t } = await getDictionary();

  return (
    <section className="section" style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 className="section__title">{t.messages.title}</h1>
      <p className="demo-banner" role="note" style={{ marginTop: 'var(--space-3)' }}>
        {t.messages.demo_note}
      </p>

      <div style={{ marginTop: 'var(--space-4)' }}>
        <EmptyState icon={<IconUser />}>
          <strong style={{ display: 'block', marginBottom: 4 }}>{t.messages.empty_title}</strong>
          {t.messages.empty_body}
        </EmptyState>
        <div style={{ display: 'grid', placeItems: 'center', marginTop: 'var(--space-3)' }}>
          <a className="btn btn--cta" href="/" style={{ maxWidth: 220 }}>
            {t.messages.browse}
          </a>
        </div>
      </div>
    </section>
  );
}
