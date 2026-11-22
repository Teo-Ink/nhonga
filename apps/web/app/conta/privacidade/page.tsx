'use client';
import { useState } from 'react';
import { useSession } from '../../../components/auth/SessionProvider';
import { useDict } from '../../../components/i18n/DictProvider';

// Privacy and account (P0-06): download my data, delete my account. The app
// stores require deletion to be possible from inside the product, without
// writing to support.
export default function PrivacyAccountPage() {
  const d = useDict();
  const t = d.privacyAccount;
  const { user, loading, signOut } = useSession();
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState<'idle' | 'deleting' | 'error'>('idle');
  const word = t.confirm_word;

  if (loading) {
    return (
      <section className="account">
        <p role="status">{d.common.loading}</p>
      </section>
    );
  }
  if (!user) {
    return (
      <section className="account">
        <h1 className="section__title">{t.title}</h1>
        <a className="btn btn--cta" href="/entrar?next=/conta/privacidade">
          {d.account.sign_in}
        </a>
      </section>
    );
  }

  async function onDelete(e: React.FormEvent) {
    e.preventDefault();
    if (confirm.trim().toUpperCase() !== word) return;
    setState('deleting');
    const res = await fetch('/api/auth/me', { method: 'DELETE' }).catch(() => null);
    if (!res?.ok) {
      setState('error');
      return;
    }
    await signOut().catch(() => undefined);
    window.location.href = '/?conta=eliminada';
  }

  return (
    <section className="account">
      <a className="pdp__back" href="/conta">
        ← {d.account.title}
      </a>
      <h1 className="section__title">{t.title}</h1>

      <div className="card">
        <h2 className="card__title">{t.export_title}</h2>
        <p className="account__muted">{t.export_body}</p>
        <a className="btn btn--ghost" href="/api/auth/me/export" download>
          {t.export_cta}
        </a>
      </div>

      <form className="card" onSubmit={onDelete} aria-labelledby="del-title">
        <h2 className="card__title" id="del-title">
          {t.delete_title}
        </h2>
        <p className="account__muted">{t.delete_body}</p>
        <ul className="account__muted">
          <li>{t.delete_item_listings}</li>
          <li>{t.delete_item_sessions}</li>
          <li>{t.delete_item_kept}</li>
        </ul>
        <label className="field">
          <span className="field__label">{t.confirm_label.replace('{word}', word)}</span>
          <input
            className="field__input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            aria-describedby={state === 'error' ? 'del-error' : undefined}
          />
        </label>
        <button
          type="submit"
          className="btn btn--danger"
          disabled={confirm.trim().toUpperCase() !== word || state === 'deleting'}
        >
          {state === 'deleting' ? t.deleting : t.delete_cta}
        </button>
        {state === 'error' ? (
          <p className="field__error" role="alert" id="del-error">
            {t.delete_error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
