import { describe, expect, it } from 'vitest';
import { pt } from './pt';

// P1-10: the site speaks to people as "você" (Mozambican Portuguese in a
// commercial setting), never "tu". This catches the common slips.
const TU =
  /\b(teu|tua|teus|tuas|tens|podes|queres|estás|Inicia sessão|Escreve|Escolhe|Experimenta|Confirmas|contactar-te|Junta-te)\b/;

function strings(v: unknown, path = ''): Array<[string, string]> {
  if (typeof v === 'string') return [[path, v]];
  if (v && typeof v === 'object') {
    return Object.entries(v).flatMap(([k, x]) => strings(x, path ? `${path}.${k}` : k));
  }
  return [];
}

describe('pt dictionary register', () => {
  it('uses "você" throughout', () => {
    const slips = strings(pt).filter(([, s]) => TU.test(s));
    expect(slips).toEqual([]);
  });
});
