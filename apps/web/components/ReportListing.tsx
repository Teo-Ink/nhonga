'use client';
import { useState } from 'react';
import type { Dictionary } from '../lib/i18n/index';

const REASONS = ['fraud', 'prohibited', 'spam', 'wrong_category', 'offensive', 'other'] as const;

// Report-a-listing (trust & safety). A subtle toggle reveals a small form
// (reason + optional note) that posts anonymously to the reports endpoint.
export function ReportListing({ slug, t }: { slug: string; t: Dictionary['report'] }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');

  const label: Record<(typeof REASONS)[number], string> = {
    fraud: t.r_fraud,
    prohibited: t.r_prohibited,
    spam: t.r_spam,
    wrong_category: t.r_wrong_category,
    offensive: t.r_offensive,
    other: t.r_other,
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reason === '') {
      setState('error');
      return;
    }
    setState('saving');
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, reason, note: note.trim() || undefined }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState('done');
    } catch {
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <p className="reportbox__done" role="status">
        {t.success}
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" className="reportbox__toggle" onClick={() => setOpen(true)}>
        ⚑ {t.button}
      </button>
    );
  }

  return (
    <form className="reportbox" onSubmit={submit}>
      <strong className="reportbox__title">{t.title}</strong>
      <p className="reportbox__sub">{t.subtitle}</p>
      <label className="field">
        <span className="field__label">{t.reason_label}</span>
        <select className="field__input" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">—</option>
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {label[r]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field__label">{t.note_label}</span>
        <textarea
          className="field__input"
          rows={2}
          value={note}
          maxLength={1000}
          placeholder={t.note_ph}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <div className="reportbox__foot">
        <button type="submit" className="btn btn--ghost" disabled={state === 'saving'}>
          {state === 'saving' ? t.submitting : t.submit}
        </button>
        <button
          type="button"
          className="reportbox__cancel"
          onClick={() => {
            setOpen(false);
            setState('idle');
          }}
        >
          {t.cancel}
        </button>
      </div>
      {state === 'error' ? (
        <span className="reportbox__err" role="alert">
          {reason === '' ? t.pick_reason : t.error}
        </span>
      ) : null}
    </form>
  );
}
