/**
 * Verifies PawaPay's signed callbacks (PAY-07).
 *
 * PawaPay signs callbacks with HTTP Message Signatures (RFC 9421) when "signed
 * callbacks" is enabled in its dashboard:
 *
 *   Content-Digest:  sha-512=:<base64 of SHA-512(body)>:
 *   Signature-Input: sig-pp=("@method" "@authority" "@path" "signature-date"
 *                    "content-digest" "content-type");alg="ecdsa-p256-sha256";
 *                    keyid="HTTP_EC_P256_KEY:1";created=…;expires=…
 *   Signature:       sig-pp=:<base64 DER ECDSA signature>:
 *
 * The public keys come from GET {baseUrl}/v2/public-key/http. Derived
 * components (@method, @authority, @path, @query) are taken from the callback
 * URL configured on our side, never from the incoming Host header.
 *
 * Docs: https://docs.pawapay.io/v2/docs/signatures
 */
import { createHash, createPublicKey, timingSafeEqual, verify, type KeyObject } from 'node:crypto';
import type { FetchLike } from '../checkout.types.js';

export type SignatureCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | 'unsigned'
        | 'malformed'
        | 'digest_mismatch'
        | 'expired'
        | 'unsupported_alg'
        | 'missing_components'
        | 'unknown_key'
        | 'bad_signature';
    };

const ALG = 'ecdsa-p256-sha256';
const REQUIRED = ['@method', '@authority', '@path', 'content-digest'];
/** Tolerated clock difference between PawaPay and this server. */
const SKEW_S = 30;

interface SignatureInput {
  readonly label: string;
  readonly components: readonly string[];
  /** Everything after `label=`, exactly as received: it is part of the base. */
  readonly params: string;
  readonly alg: string | undefined;
  readonly keyid: string | undefined;
  readonly expires: number | undefined;
}

export function parseSignatureInput(header: string): SignatureInput | null {
  const m = /^\s*([a-zA-Z0-9_-]+)=(\(([^)]*)\)(.*))\s*$/s.exec(header);
  if (!m) return null;
  const [, label, params, list, rest] = m as unknown as [string, string, string, string, string];
  const components = [...list.matchAll(/"([^"]+)"/g)].map((c) => c[1]!.toLowerCase());
  if (components.length === 0) return null;
  const str = (name: string) => new RegExp(`;${name}="([^"]*)"`).exec(rest)?.[1];
  const num = (name: string) => {
    const v = new RegExp(`;${name}=(\\d+)`).exec(rest)?.[1];
    return v === undefined ? undefined : Number(v);
  };
  return {
    label,
    components,
    params: params.trim(),
    alg: str('alg'),
    keyid: str('keyid'),
    expires: num('expires'),
  };
}

function dictionaryBytes(header: string, label: string): Buffer | null {
  const m = new RegExp(`(?:^|,)\\s*${label}=:([A-Za-z0-9+/=]+):`).exec(header);
  return m ? Buffer.from(m[1]!, 'base64') : null;
}

export interface CallbackToVerify {
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly rawBody: string;
  /** The callback URL as configured in the PawaPay dashboard. */
  readonly callbackUrl: string;
  readonly key: (keyid: string) => Promise<KeyObject | null>;
  readonly nowMs: number;
}

export async function verifyCallback(input: CallbackToVerify): Promise<SignatureCheck> {
  const h = input.headers;
  const sigInput = h['signature-input'];
  const sig = h['signature'];
  const digest = h['content-digest'];
  if (!sigInput && !sig) return { ok: false, reason: 'unsigned' };
  if (!sigInput || !sig || !digest) return { ok: false, reason: 'malformed' };

  const parsed = parseSignatureInput(sigInput);
  if (!parsed) return { ok: false, reason: 'malformed' };

  const claimed = dictionaryBytes(digest, 'sha-512');
  const actual = createHash('sha512').update(input.rawBody, 'utf8').digest();
  if (!claimed || claimed.length !== actual.length || !timingSafeEqual(claimed, actual))
    return { ok: false, reason: 'digest_mismatch' };

  if (parsed.expires === undefined || input.nowMs / 1000 > parsed.expires + SKEW_S)
    return { ok: false, reason: 'expired' };
  if (parsed.alg !== ALG) return { ok: false, reason: 'unsupported_alg' };
  if (!REQUIRED.every((c) => parsed.components.includes(c)))
    return { ok: false, reason: 'missing_components' };

  let url: URL;
  try {
    url = new URL(input.callbackUrl);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (url.search && !parsed.components.includes('@query'))
    return { ok: false, reason: 'missing_components' };

  const lines: string[] = [];
  for (const c of parsed.components) {
    let value: string | undefined;
    if (c === '@method') value = 'POST';
    else if (c === '@authority') value = url.host.toLowerCase();
    else if (c === '@path') value = url.pathname;
    else if (c === '@query') value = url.search || '?';
    else if (c.startsWith('@')) return { ok: false, reason: 'missing_components' };
    else value = h[c]?.trim();
    if (value === undefined) return { ok: false, reason: 'missing_components' };
    lines.push(`"${c}": ${value}`);
  }
  lines.push(`"@signature-params": ${parsed.params}`);
  const base = lines.join('\n');

  const signature = dictionaryBytes(sig, parsed.label);
  if (!signature || !parsed.keyid) return { ok: false, reason: 'malformed' };
  const key = await input.key(parsed.keyid);
  if (!key) return { ok: false, reason: 'unknown_key' };
  try {
    // PawaPay sends ECDSA signatures DER-encoded (Node's default), not r||s.
    return verify('sha256', Buffer.from(base, 'utf8'), key, signature)
      ? { ok: true }
      : { ok: false, reason: 'bad_signature' };
  } catch {
    return { ok: false, reason: 'bad_signature' };
  }
}

const DAY_MS = 24 * 60 * 60_000;
const MIN_REFRESH_MS = 5 * 60_000;

/** PawaPay's callback keys: refreshed daily and when an unknown id appears,
 *  but never more often than every five minutes. */
export class PawaPayKeys {
  private keys = new Map<string, KeyObject>();
  private fetchedAt = 0;
  private attemptedAt = 0;

  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: FetchLike,
    private readonly now: () => number = Date.now,
  ) {}

  async get(keyid: string): Promise<KeyObject | null> {
    const t = this.now();
    const stale = t - this.fetchedAt > DAY_MS;
    if ((stale || !this.keys.has(keyid)) && t - this.attemptedAt > MIN_REFRESH_MS) {
      this.attemptedAt = t;
      try {
        const res = await this.fetchImpl(`${this.baseUrl}/v2/public-key/http`, {
          method: 'GET',
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(5000),
        });
        if (res.status === 200) {
          const list = JSON.parse(await res.text()) as { id?: unknown; key?: unknown }[];
          const next = new Map<string, KeyObject>();
          for (const k of Array.isArray(list) ? list : []) {
            if (typeof k.id !== 'string' || typeof k.key !== 'string') continue;
            try {
              next.set(k.id, createPublicKey(k.key));
            } catch {
              /* skip a key this runtime cannot read */
            }
          }
          if (next.size > 0) {
            this.keys = next;
            this.fetchedAt = t;
          }
        }
      } catch {
        /* keep the keys we have; the callback is rejected if its key is unknown */
      }
    }
    return this.keys.get(keyid) ?? null;
  }
}
