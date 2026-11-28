// Which sign-in providers are configured, so the page shows only buttons that work.
import { NextResponse } from 'next/server';
import { apiFetch, readJson } from '../../../../../lib/bff';

export async function GET(): Promise<Response> {
  try {
    const res = await apiFetch('/auth/social/providers', { cache: 'no-store', timeoutMs: 3000 });
    const data = (await readJson<{ providers?: string[] }>(res)) ?? {};
    return NextResponse.json({ providers: res.ok ? (data.providers ?? []) : [] });
  } catch {
    // Without the API the phone form still shows; just no extra buttons.
    return NextResponse.json({ providers: [] });
  }
}
