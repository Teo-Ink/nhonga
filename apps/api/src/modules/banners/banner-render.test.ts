import { describe, expect, it } from 'vitest';
import {
  PRESETS,
  PRESET_PALETTE,
  RATIOS,
  renderBanner,
  type RenderInput,
} from './banner-render.js';

const base: RenderInput = {
  spec: {
    headline: 'Camisola da Selecção',
    subheadline: 'Disponível em Maputo',
    cta: 'Contacta já',
    bg: '#111111',
    accent: '#f5c518',
    text: '#ffffff',
  },
  preset: 'moderno',
  ratio: 'square',
  photoDataUri: null,
  priceLabel: '1.300,00 MT',
  categoryLabel: 'Moda',
  location: 'Maputo Cidade',
  watermarked: true,
};

const render = (over: Partial<RenderInput> = {}): string => renderBanner({ ...base, ...over });

describe('renderBanner', () => {
  it('produces a well-formed SVG sized to the chosen ratio', () => {
    for (const ratio of ['square', 'landscape', 'portrait'] as const) {
      const { w, h } = RATIOS[ratio];
      const svg = render({ ratio });
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
      expect(svg).toContain(`width="${w}" height="${h}"`);
      expect(svg).toContain(`viewBox="0 0 ${w} ${h}"`);
    }
  });

  it('renders the exact price, category and copy', () => {
    const svg = render();
    expect(svg).toContain('1.300,00 MT');
    expect(svg).toContain('Moda');
    expect(svg).toContain('Camisola da Selecção');
    expect(svg).toContain('Contacta já');
    expect(svg).toContain('Maputo Cidade');
    expect(svg).toContain('class="location"');
    expect(svg).not.toContain('📍');
  });

  it('XML-escapes model-provided text so it cannot inject markup', () => {
    const svg = render({
      spec: { ...base.spec, headline: 'A <b> & "x" \'y\'' },
    });
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('A &lt;b&gt; &amp; &quot;x&quot; &apos;y&apos;');
  });

  it('shows the full watermark on the free tier and the brand-only mark on Pro', () => {
    expect(render({ watermarked: true })).toContain('Nhonga · nhonga.co.mz');
    const pro = render({ watermarked: false });
    expect(pro).not.toContain('nhonga.co.mz');
    expect(pro).toContain('>Nhonga</text>');
  });

  it('uses the brand gradient with no photo, and composites the photo when present', () => {
    const noPhoto = render({ photoDataUri: null });
    expect(noPhoto).toContain('fill="url(#grad)"');
    expect(noPhoto).not.toContain('<image href');

    const uri = 'data:image/png;base64,AAAA';
    const withPhoto = render({ photoDataUri: uri });
    expect(withPhoto).toContain(`<image href="${uri}"`);
    expect(withPhoto).toContain('fill="url(#scrim)"'); // legibility scrim over the photo
  });

  it('adds the PROMOÇÃO ribbon only for the promoção preset', () => {
    expect(render({ preset: 'promocao' })).toContain('PROMOÇÃO');
    expect(render({ preset: 'moderno' })).not.toContain('PROMOÇÃO');
  });

  it('falls back to the preset palette when the model returns an invalid colour', () => {
    const svg = render({
      preset: 'moderno',
      spec: { ...base.spec, bg: 'not-a-colour', accent: 'blue', text: '123' },
    });
    expect(svg).toContain(`stop-color="${PRESET_PALETTE.moderno.bg}"`);
    expect(svg).toContain(PRESET_PALETTE.moderno.accent);
  });

  it('accepts a valid #rrggbb override from the spec', () => {
    const svg = render({ spec: { ...base.spec, bg: '#0a0b0c' } });
    expect(svg).toContain('stop-color="#0a0b0c"');
  });

  it('clamps an overlong headline with an ellipsis', () => {
    const long = 'x'.repeat(60);
    const svg = render({ spec: { ...base.spec, headline: long } });
    expect(svg).toContain('…');
    expect(svg).not.toContain(long);
  });

  it('defaults a missing CTA to a safe label', () => {
    const svg = render({ spec: { ...base.spec, cta: '' } });
    expect(svg).toContain('Contacta já');
  });

  it('omits the location line when there is no location', () => {
    const svg = render({ location: '' });
    expect(svg).not.toContain('class="location"');
  });

  it('exposes six presets with a palette each', () => {
    expect(PRESETS).toHaveLength(6);
    for (const p of PRESETS) {
      expect(PRESET_PALETTE[p].bg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(PRESET_PALETTE[p].accent).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
