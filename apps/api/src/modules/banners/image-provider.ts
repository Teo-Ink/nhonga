import type { BannerRatio } from './banner-render.js';

// Swappable AI image provider for banner backgrounds. Only backgrounds are
// generated this way — the headline, price and brand are composited on top as
// crisp SVG — so the model never has to render text, and the cheapest tier
// (FLUX schnell) is plenty. Any failure returns null so the caller falls back
// to the listing photo / brand gradient; the studio never hard-depends on it.
export interface ImageProvider {
  readonly configured: boolean;
  /** A background as a data URI, or null if generation is unavailable. */
  background(prompt: string, ratio: BannerRatio): Promise<string | null>;
}

/** No-op provider used when no key is set. */
export const NullImageProvider: ImageProvider = {
  configured: false,
  background: async () => null,
};

interface FalImage {
  url?: string;
  content_type?: string;
}
interface FalResponse {
  images?: FalImage[];
}

// fal.ai FLUX-schnell provider. Uses the synchronous `fal.run` endpoint (schnell
// renders in ~1-2s). No SDK dependency — plain fetch.
export class FalImageProvider implements ImageProvider {
  readonly configured = true;
  private static readonly SIZE: Record<BannerRatio, string> = {
    square: 'square_hd',
    landscape: 'landscape_16_9',
    portrait: 'portrait_16_9',
  };

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async background(prompt: string, ratio: BannerRatio): Promise<string | null> {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25_000);
      const res = await fetch(`https://fal.run/${this.model}`, {
        method: 'POST',
        headers: { authorization: `Key ${this.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt,
          image_size: FalImageProvider.SIZE[ratio],
          num_inference_steps: 4,
          num_images: 1,
          enable_safety_checker: true,
        }),
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer));
      if (!res.ok) {
        // e.g. 4xx "User is locked. Reason: TOP_UP." when the account is unfunded.
        return null;
      }
      const data = (await res.json()) as FalResponse;
      const url = data.images?.[0]?.url;
      if (!url) return null;
      return await fetchAsDataUri(url);
    } catch {
      return null;
    }
  }
}

/** Fetch a generated image URL and inline it as a base64 data URI (null on fail). */
async function fetchAsDataUri(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    const res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const type = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0]!.trim();
    if (!/^image\//.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 6_000_000) return null;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// Background prompt templates. We bake "no text" in because stray glyphs behind
// the overlaid copy look broken, and keep it to a clean backdrop (no people).
const PRESET_MOOD: Record<string, string> = {
  moderno: 'modern minimalist gradient with soft geometric shapes',
  minimal: 'clean minimal studio backdrop, lots of empty space, subtle',
  promocao: 'vibrant energetic sale backdrop, bold dynamic colours',
  luxo: 'luxurious premium dark backdrop with subtle gold accents, elegant',
  alegre: 'cheerful bright playful backdrop, colourful',
  mercado: 'warm vibrant local African marketplace ambiance, soft bokeh',
};

export function backgroundPrompt(preset: string, categoryLabel: string): string {
  const mood = PRESET_MOOD[preset] ?? PRESET_MOOD['moderno']!;
  return `${mood}, themed around ${categoryLabel}, abstract background, no text, no words, no letters, no logos, no people, clean composition, high quality, 4k`;
}
