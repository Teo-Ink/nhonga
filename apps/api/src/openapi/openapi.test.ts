import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { apiDocument } from './document.js';

// The committed contract must match the code. If this fails after changing a
// route or a body schema: pnpm --filter @nhonga/api openapi:write
describe('openapi.yaml', () => {
  it('is up to date with the controllers and the shared schemas', async () => {
    const committed = parse(readFileSync(new URL('../../openapi.yaml', import.meta.url), 'utf8'));
    expect(committed).toEqual(JSON.parse(JSON.stringify(await apiDocument())));
  }, 60_000);

  it('documents every route, every body and the admin and payment headers', async () => {
    const doc = (await apiDocument()) as {
      paths: Record<
        string,
        Record<
          string,
          { requestBody?: unknown; parameters?: Array<{ name?: string; $ref?: string }> }
        >
      >;
    };
    const ops = Object.values(doc.paths).flatMap((p) => Object.values(p));
    expect(ops.length).toBeGreaterThanOrEqual(88);
    expect(ops.filter((o) => o.requestBody).length).toBeGreaterThanOrEqual(32);
    expect(
      doc.paths['/ads/admin']?.['get']?.parameters?.some((p) => p.name === 'x-admin-token'),
    ).toBe(true);
    expect(
      doc.paths['/wallet/topup']?.['post']?.parameters?.some((p) =>
        p.$ref?.endsWith('IdempotencyKey'),
      ),
    ).toBe(true);
  }, 60_000);
});
