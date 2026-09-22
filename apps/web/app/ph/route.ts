// Branded product-image placeholder generator. Returns a clean gradient tile
// with a monogram — consistent and on-brand, and honestly a placeholder (no
// misleading stock photo). Used by the demo catalogue via /ph?c=<category>&t=<title>.
//
// Per-category palettes in the brand's green / black / yellow scheme. Third
// value is the monogram colour (dark on yellow, light on green/black).
const PALETTES: Record<string, [string, string, string]> = {
  moda: ['#f2b705', '#c99700', '#171717'],
  electronica: ['#12855c', '#0b5138', '#ffffff'],
  telemoveis: ['#2a2a2a', '#0d0d0d', '#f2b705'],
  casa: ['#2f9a68', '#12855c', '#ffffff'],
  alimentacao: ['#f5c518', '#d9a300', '#171717'],
  beleza: ['#1f1f1f', '#0b5138', '#ffffff'],
  default: ['#12855c', '#0b5138', '#ffffff'],
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
  const [c1, c2, fg] = PALETTES[cat] ?? PALETTES.default!;
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
    fill="${fg}" opacity="0.95">${mono}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}
