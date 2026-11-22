import { afterEach, describe, expect, it, vi } from 'vitest';

// Phrases that promise a transactional marketplace the platform does not run.
const PROMISES = [
  /reembolso/i,
  /prote[çc][ãa]o ao comprador/i,
  /entrega em todo o pa[ií]s/i,
  /acompanhe o seu pedido/i,
  /na entrega/i,
  /dinheiro na entrega/i,
  /encomendas em tempo real/i,
  /acompanhe as suas encomendas/i,
  /track your orders/i,
  /refund/i,
  /buyer protection/i,
  /track your order/i,
  /on delivery/i,
];

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) strings(x, out);
  return out;
}

async function load() {
  vi.resetModules();
  const { pt } = await import('./pt');
  const { en } = await import('./en');
  return [...strings(pt), ...strings(en)];
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('marketplace promises (CONT-01)', () => {
  it('are absent from every page string when the flag is off', async () => {
    const all = await load();
    const hits = all.filter((s) => PROMISES.some((re) => re.test(s)));
    expect(hits).toEqual([]);
  });

  it('come back when NEXT_PUBLIC_MARKETPLACE_PROMISES=1', async () => {
    vi.stubEnv('NEXT_PUBLIC_MARKETPLACE_PROMISES', '1');
    const all = await load();
    expect(all.some((s) => /Reembolso/.test(s))).toBe(true);
  });
});
