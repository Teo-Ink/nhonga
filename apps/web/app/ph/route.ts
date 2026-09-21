// Branded product-image placeholder generator. Returns a clean gradient tile
// with a monogram — consistent and on-brand, and honestly a placeholder (no
// misleading stock photo). Used by the demo catalogue via /ph?c=<category>&t=<title>.
//
// Per-category palettes keep the storefront varied while staying warm/on-brand.
const PALETTES: Record<string, [string, string]> = {
  moda: ['#d5734a', '#a8421c'],
  electronica: ['#1f8f8a', '#0d5a56'],
  telemoveis: ['#5563d8', '#2c3795'],
  casa: ['#c98a2e', '#875712'],
  alimentacao: ['#2f9a68', '#0e6b4a'],
  beleza: ['#b5548f', '#742f60'],
  default: ['#12855c', '#0b5138'],
};

function monogram(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'N';
  const a = words[0]![0] ?? '';
  const b = words.length > 1 ? (words[1]![0] ?? '') : '';
  return (a + b).toUpperCase();
}

function esc(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function GET(req: Request): Response {
  const url = new URL(req.url);
  const cat = url.searchParams.get('c') ?? 'default';
  const title = url.searchParams.get('t') ?? '';
  const [c1, c2] = PALETTES[cat] ?? PALETTES.default!;
  const mono = esc(monogram(title));
  const id = Math.random().toString(36).slice(2, 8);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600" role="img" aria-label="${esc(title)}">
  <defs>
    <linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#g${id})"/>
  <circle cx="500" cy="90" r="220" fill="#ffffff" opacity="0.08"/>
  <circle cx="90" cy="520" r="160" fill="#000000" opacity="0.08"/>
  <text x="300" y="300" text-anchor="middle" dominant-baseline="central"
    font-family="Inter, system-ui, sans-serif" font-size="220" font-weight="800"
    fill="#ffffff" opacity="0.92">${mono}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
