import { describe, expect, it } from 'vitest';
import { parseSpecs } from './banners.service.js';

const pal = { bg: '#111111', accent: '#222222', text: '#333333' };

describe('parseSpecs (untrusted model JSON)', () => {
  it('parses a valid variants array and validates fields', () => {
    const out = parseSpecs(
      JSON.stringify({
        variants: [
          {
            headline: 'Oferta',
            subheadline: 'Hoje',
            cta: 'Ver',
            bg: '#aabbcc',
            accent: '#ddeeff',
            text: '#000000',
          },
        ],
      }),
      pal,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      headline: 'Oferta',
      subheadline: 'Hoje',
      cta: 'Ver',
      bg: '#aabbcc',
      accent: '#ddeeff',
      text: '#000000',
    });
  });

  it('tolerates a ```json code fence around the JSON', () => {
    const out = parseSpecs('```json\n{"variants":[{"headline":"Oi"}]}\n```', pal);
    expect(out).toHaveLength(1);
    expect(out[0]!.headline).toBe('Oi');
  });

  it('returns [] for non-JSON', () => {
    expect(parseSpecs('definitely not json', pal)).toEqual([]);
  });

  it('returns [] when variants is missing or not an array', () => {
    expect(parseSpecs('{"foo":1}', pal)).toEqual([]);
    expect(parseSpecs('{"variants":"x"}', pal)).toEqual([]);
  });

  it('skips a variant with no headline', () => {
    const out = parseSpecs(
      JSON.stringify({ variants: [{ subheadline: 'no headline' }, { headline: 'ok' }] }),
      pal,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.headline).toBe('ok');
  });

  it('falls back to the palette for invalid colours, keeps valid ones', () => {
    const out = parseSpecs(
      JSON.stringify({ variants: [{ headline: 'h', bg: 'red', accent: '#00ff00', text: 42 }] }),
      pal,
    );
    expect(out[0]!.bg).toBe(pal.bg); // 'red' is not #rrggbb
    expect(out[0]!.accent).toBe('#00ff00'); // valid hex kept
    expect(out[0]!.text).toBe(pal.text); // number -> fallback
  });

  it('defaults an empty CTA and clamps overlong copy', () => {
    const out = parseSpecs(
      JSON.stringify({ variants: [{ headline: 'x'.repeat(60), cta: '' }] }),
      pal,
    );
    expect(out[0]!.cta).toBe('Contacta já');
    expect(out[0]!.headline.length).toBeLessThanOrEqual(40);
  });
});
