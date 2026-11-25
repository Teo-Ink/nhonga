'use client';
import { useEffect } from 'react';
import { buildReport, createReportGate, type ClientErrorBody } from '../lib/client-errors';

let gate: ((body: ClientErrorBody) => boolean) | null = null;

/** Sends one crash report to our own backend. Never throws. */
export function reportClientError(error: unknown): void {
  try {
    gate ??= createReportGate();
    const body = buildReport(error, window.location.pathname, navigator.userAgent);
    if (!gate(body)) return;
    void fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* reporting must never break the page */
  }
}

/** Reports unhandled errors and rejected promises of this page (OPS-06). */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportClientError(e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => reportClientError(e.reason);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
