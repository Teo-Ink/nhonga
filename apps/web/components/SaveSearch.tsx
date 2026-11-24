'use client';
import { IS_DEMO } from '../lib/demo';
import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { IconBell } from './icons';

const KEY = 'nhonga_saved_searches';

export interface SavedSearch {
  href: string;
  label: string;
  createdAt: number;
}

interface AlertLabels {
  title: string;
  sub: string;
  phonePh: string;
  cta: string;
  sending: string;
  demo: string;
  done: string;
  smsPreview: string;
  none: string;
  error: string;
  /** Shown when the visitor is not signed in (alerts need an account). */
  login?: string;
}

function read(): SavedSearch[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as SavedSearch[];
  } catch {
    return [];
  }
}
function write(list: SavedSearch[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event('nhonga-saved'));
}

// Turn the current path + query into the catalogue filter shape the API matches
// saved searches against (category from /categoria/<slug> or ?category).
function buildQuery(pathname: string, qs: string): Record<string, unknown> {
  const p = new URLSearchParams(qs);
  const q: Record<string, unknown> = {};
  const catFromPath = pathname.startsWith('/categoria/') ? pathname.split('/')[2] : undefined;
  const cat = p.get('category') ?? catFromPath;
  if (p.get('q')) q.q = p.get('q');
  if (cat) q.categorySlug = cat;
  if (p.get('minPrice')) q.minPriceCents = Number(p.get('minPrice'));
  if (p.get('maxPrice')) q.maxPriceCents = Number(p.get('maxPrice'));
  if (p.get('sort')) q.sort = p.get('sort');
  return q;
}

// "Guardar pesquisa" — saves the current search to localStorage (per-device),
// and offers optional SMS alerts: a phone opt-in that registers the search
// server-side and shows the alert SMS it would send (mocked in the demo).
export function SaveSearch({
  title,
  saveLabel,
  savedLabel,
  alerts,
}: {
  title: string;
  saveLabel: string;
  savedLabel: string;
  alerts: AlertLabels;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const qs = params.toString();
  const href = qs ? `${pathname}?${qs}` : pathname;
  const [saved, setSaved] = useState(false);
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error' | 'login'>('idle');
  const [sms, setSms] = useState<string | null>(null);

  useEffect(() => {
    setSaved(read().some((s) => s.href === href));
  }, [href]);

  function toggle() {
    const list = read();
    const exists = list.some((s) => s.href === href);
    const label = labelFor(title, qs);
    const next = exists
      ? list.filter((s) => s.href !== href)
      : [{ href, label, createdAt: Date.now() }, ...list];
    write(next);
    setSaved(!exists);
    if (exists) {
      setState('idle');
      setSms(null);
    }
  }

  async function activateAlerts(e: React.FormEvent) {
    e.preventDefault();
    if (phone.trim().length < 6) {
      setState('error');
      return;
    }
    setState('sending');
    try {
      const created = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          label: labelFor(title, qs),
          href,
          query: buildQuery(pathname, qs),
        }),
      });
      if (created.status === 401) {
        setState('login');
        return;
      }
      const { id } = (await created.json().catch(() => ({}))) as { id?: string };
      if (!created.ok || !id) {
        setState('error');
        return;
      }
      // Run it once so the demo shows the SMS the alert would send.
      const ran = await fetch(`/api/saved-searches/run?id=${encodeURIComponent(id)}`, {
        method: 'POST',
      });
      const results = (await ran.json().catch(() => [])) as { sms: string | null }[];
      setSms(results[0]?.sms ?? null);
      setState('done');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="savesearch-wrap">
      <button
        type="button"
        className={`savesearch ${saved ? 'is-on' : ''}`}
        aria-pressed={saved}
        onClick={toggle}
      >
        <IconBell width={16} height={16} />
        {saved ? savedLabel : saveLabel}
      </button>

      {saved ? (
        <div className="savealert">
          {state === 'done' ? (
            <div className="savealert__done" role="status">
              <strong>{alerts.done}</strong>
              {sms ? (
                <p className="savealert__sms">
                  <span className="savealert__smslabel">{alerts.smsPreview}</span> {sms}
                </p>
              ) : (
                <p className="savealert__sms">{alerts.none}</p>
              )}
            </div>
          ) : (
            <form className="savealert__form" onSubmit={activateAlerts}>
              <div className="savealert__head">
                <strong>{alerts.title}</strong>
                <span className="savealert__sub">{alerts.sub}</span>
              </div>
              <div className="savealert__row">
                <input
                  type="tel"
                  inputMode="tel"
                  className="field__input"
                  placeholder={alerts.phonePh}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-label={alerts.title}
                />
                <button type="submit" className="btn btn--cta" disabled={state === 'sending'}>
                  {state === 'sending' ? alerts.sending : alerts.cta}
                </button>
              </div>
              {state === 'login' ? (
                <span className="field__error" role="alert">
                  <a href={`/entrar?next=${encodeURIComponent(href)}`}>
                    {alerts.login ?? 'Inicie sessão para receber alertas.'}
                  </a>
                </span>
              ) : null}
              {state === 'error' ? (
                <span className="field__error" role="alert">
                  {alerts.error}
                </span>
              ) : null}
              {IS_DEMO ? <span className="savealert__demo">{alerts.demo}</span> : null}
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}

// A readable label: the page title plus how many filters are active.
function labelFor(title: string, qs: string): string {
  const n = qs ? new URLSearchParams(qs).size : 0;
  return n > 0 ? `${title} (${n})` : title;
}
