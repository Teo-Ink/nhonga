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

// Wrap long text onto up to `maxLines` lines of ~`perLine` chars, escaped.
function wrap(text: string, perLine: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > perLine && cur !== '') {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

export function GET(req: Request): Response {
  const url = new URL(req.url);
  const cat = url.searchParams.get('c') ?? 'default';
  const title = url.searchParams.get('t') ?? '';
  const sub = url.searchParams.get('s'); // subtitle → ad-banner mode
  const [c1, c2, fg] = PALETTES[cat] ?? PALETTES.default!;
  const id = Math.random().toString(36).slice(2, 8);

  const grad = `<linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>`;

  let svg: string;
  if (sub !== null) {
    // Ad-banner creative: advertiser name + tagline + a faux CTA, centred so it
    // survives object-fit:cover at any slot aspect. 2:1 canvas.
    const nameLines = wrap(title, 22, 2).map(esc);
    const nameY = nameLines.length > 1 ? 150 : 175;
    const nameSvg = nameLines
      .map(
        (l, i) =>
          `<text x="400" y="${nameY + i * 58}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="52" font-weight="800" fill="${fg}">${l}</text>`,
      )
      .join('');
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400" role="img" aria-label="${esc(title)}">
  <defs>${grad}</defs>
  <rect width="800" height="400" fill="url(#g${id})"/>
  <circle cx="720" cy="60" r="150" fill="#ffffff" opacity="0.08"/>
  <circle cx="90" cy="360" r="120" fill="#000000" opacity="0.08"/>
  ${nameSvg}
  <text x="400" y="${nameY + nameLines.length * 46 + 8}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="27" font-weight="500" fill="${fg}" opacity="0.85">${esc(wrap(sub, 40, 1)[0] ?? '')}</text>
  <rect x="320" y="300" width="160" height="46" rx="23" fill="${fg}" opacity="0.95"/>
  <text x="400" y="330" text-anchor="middle" dominant-baseline="central" font-family="Inter, system-ui, sans-serif" font-size="22" font-weight="700" fill="${c2}">Ver mais →</text>
</svg>`;
  } else {
    // Product tile: 4:3 gradient with a monogram (honest placeholder, no stock photo).
    const mono = esc(monogram(title));
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480" role="img" aria-label="${esc(title)}">
  <defs>${grad}</defs>
  <rect width="640" height="480" fill="url(#g${id})"/>
  <circle cx="560" cy="70" r="170" fill="#ffffff" opacity="0.08"/>
  <circle cx="80" cy="430" r="130" fill="#000000" opacity="0.08"/>
  <text x="320" y="240" text-anchor="middle" dominant-baseline="central"
    font-family="Inter, system-ui, sans-serif" font-size="150" font-weight="800"
    fill="${fg}" opacity="0.95">${mono}</text>
</svg>`;
  }

  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}
