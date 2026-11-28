'use client';
import { useEffect, useState } from 'react';
import { useDict } from '../i18n/DictProvider';
import { PhoneConfirm } from './PhoneConfirm';
import { useSession } from './SessionProvider';

const NAMES: Record<string, string> = { google: 'Google', facebook: 'Facebook' };

/** Account page: the ways into this account (phone, Google, Facebook), with
 *  link and unlink (AUTH-10). */
export function SignInMethods() {
  const t = useDict().signInMethods;
  const { user, refresh } = useSession();
  const [available, setAvailable] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('ligado')) setNotice(t.linked_ok);
    if (q.get('erro') === 'em-uso') setError(t.in_use);
    else if (q.get('erro')) setError(t.link_failed);
    fetch('/api/auth/social/providers')
      .then((r) => r.json())
      .then((d: { providers?: string[] }) => setAvailable(d.providers ?? []))
      .catch(() => setAvailable([]));
  }, []);

  if (!user) return null;
  const linked = user.providers ?? [];
  const shown = [...new Set([...available, ...linked])].filter((p) => NAMES[p]);

  async function unlink(provider: string) {
    setError('');
    setNotice('');
    setBusy(provider);
    try {
      const res = await fetch(`/api/auth/social/${provider}/unlink`, { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) setError(data.message ?? t.link_failed);
      else await refresh();
    } catch {
      setError(t.link_failed);
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <div className="card">
        <h2 className="card__title">{t.title}</h2>
        <p className="account__muted">{t.body}</p>
        {notice ? (
          <p className="auth__notice" role="status">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}
        <ul className="signin-methods">
          <li>
            <span>
              <strong>{t.phone}</strong>
              <br />
              <span className="account__muted">
                {user.phoneVerified && user.phoneE164 ? user.phoneE164 : t.phone_missing}
              </span>
            </span>
          </li>
          {shown.map((p) => (
            <li key={p}>
              <span>
                <strong>{NAMES[p]}</strong>
                <br />
                <span className="account__muted">
                  {linked.includes(p) ? t.linked : t.not_linked}
                </span>
              </span>
              {linked.includes(p) ? (
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={busy === p}
                  onClick={() => void unlink(p)}
                >
                  {t.unlink}
                </button>
              ) : (
                <a
                  className="btn btn--ghost"
                  href={`/api/auth/social/${p}/start?mode=link&next=/conta/privacidade`}
                >
                  {t.link}
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>
      {!user.phoneVerified ? <PhoneConfirm /> : null}
    </>
  );
}
