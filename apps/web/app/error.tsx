'use client';
// Shown when a page fails to render (OPS-06). Without it visitors saw the
// framework's bare English error screen. The failure is reported, and the
// visitor can retry without losing the header and navigation.
import { useEffect } from 'react';
import { reportClientError } from '../components/ErrorReporter';
import { useDict } from '../components/i18n/DictProvider';

export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useDict();
  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <section role="alert" style={{ padding: '48px 0', textAlign: 'center' }}>
      <h1>{t.common.page_error_title}</h1>
      <p>{t.common.page_error_body}</p>
      <button type="button" className="btn btn--primary" onClick={reset}>
        {t.common.retry}
      </button>
    </section>
  );
}
