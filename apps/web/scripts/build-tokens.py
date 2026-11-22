#!/usr/bin/env python3
"""Generates app/tokens.css. Edit the palette HERE, then run:
    python3 scripts/build-tokens.py && node scripts/check-contrast.mjs
The dark set is emitted twice (explicit [data-theme] + prefers-color-scheme)
from one dict, so the two can never drift apart."""
import re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'app' / 'tokens.css'

# Ramps: OKLCH-stepped, anchored on the logo (green-600 = #007A5E, yellow-400 = #F5C518).
GREEN = {50:'#e8fbf3',100:'#d2f4e7',200:'#aae7d0',300:'#73d0b0',400:'#3caf8d',500:'#149171',600:'#007a5e',700:'#015e48',800:'#034635',900:'#042e22',950:'#031b13'}
YELLOW = {50:'#fffaec',100:'#fff1cc',200:'#ffe6a2',300:'#ffd65f',400:'#f5c518',500:'#e2b50a',600:'#c09900',700:'#8e7105',800:'#685205',900:'#4b3b05'}
SAND = {0:'#ffffff',25:'#fcf9f4',50:'#f7f3ed',100:'#eee9e1',200:'#e1d9cf',300:'#c5bcb0',400:'#a79d90',500:'#887f72',600:'#6d655a',700:'#534c43',800:'#3c3730',900:'#2a2621',950:'#181612'}
RED = {50:'#fff2f1',100:'#ffe2e0',300:'#f28885',500:'#d02a3a',600:'#b51c2f',700:'#921926'}
AMBER = {50:'#fff5ea',300:'#fec076',500:'#e19000',600:'#c27e00',700:'#915c05'}
BLUE = {50:'#ecf7fe',100:'#d2ecfc',300:'#78b3d6',500:'#0975a2',700:'#035476'}

LIGHT = {
  # surfaces (60%: warm sand, not stark white — easier on eyes, local warmth)
  'bg':'var(--sand-25)','bg-subtle':'var(--sand-50)','surface':'var(--sand-0)','surface-raised':'var(--sand-0)','surface-sunken':'var(--sand-100)',
  'border':'var(--sand-200)','border-strong':'var(--sand-300)',
  'border-input':'var(--sand-500)',            # WCAG 1.4.11: field edges ≥ 3:1
  'text':'var(--sand-900)','text-muted':'var(--sand-600)',
  # brand (30%): one green, three roles
  'brand':'var(--green-700)',                  # brand TEXT / icons / links
  'brand-500':'var(--green-600)',              # mid green for tints, toggles, small marks
  'brand-solid':'var(--green-600)',            # brand FILL behind --on-brand (the logo green)
  'brand-solid-hover':'var(--green-700)',
  'on-brand':'#ffffff',
  'brand-subtle':'var(--green-50)','brand-subtle-strong':'var(--green-100)',
  'header-bg':'var(--green-700)','header-text':'#ffffff',
  'link':'var(--green-700)',
  'text-on-primary':'#ffffff',
  # action (10%): the logo yellow, only for the main call to action
  'cta':'var(--yellow-400)','cta-hover':'var(--yellow-500)','cta-text':'#1a1712','text-on-accent':'#1a1712',
  'rating':'var(--amber-600)','rating-text':'var(--amber-700)',
  # feedback — never colour alone: always paired with an icon or text
  'success':'var(--green-700)','success-bg':'var(--green-50)','success-border':'var(--green-200)',
  'warning':'var(--amber-700)','warning-bg':'var(--amber-50)','warning-border':'var(--amber-300)',
  'danger':'var(--red-600)','danger-bg':'var(--red-50)','danger-border':'var(--red-300)','danger-solid':'var(--red-600)','on-danger':'#ffffff',
  'info':'var(--blue-700)','info-bg':'var(--blue-50)','info-border':'var(--blue-300)',
  'focus-ring':'var(--green-600)',
  'overlay':'rgba(24, 22, 18, 0.55)',
  # legacy names kept so existing components keep working
  'logo-green':'var(--brand-solid)','logo-green-hover':'var(--brand-solid-hover)',
}
DARK = {
  'bg':'#15120f','bg-subtle':'#1a1713','surface':'#1f1b17','surface-raised':'#27231e','surface-sunken':'#181612',
  'border':'#39352f','border-strong':'#524c45','border-input':'#7a736a',
  'text':'#eee9e1','text-muted':'#b7b0a5',
  'brand':'#59c9a5','brand-500':'#44bd98',
  'brand-solid':'var(--green-600)','brand-solid-hover':'var(--green-700)','on-brand':'#ffffff',
  'brand-subtle':'#13352a','brand-subtle-strong':'#1a4335',
  'header-bg':'var(--green-900)','header-text':'#ffffff','link':'#59c9a5','text-on-primary':'#ffffff',
  'cta':'var(--yellow-400)','cta-hover':'var(--yellow-300)','cta-text':'#1a1712','text-on-accent':'#1a1712',
  'rating':'#f0b135','rating-text':'#f0b135',
  'success':'#6bcf9d','success-bg':'#153223','success-border':'#22573b',
  'warning':'#f3ae58','warning-bg':'#3b260c','warning-border':'#6b4612',
  'danger':'#f28885','danger-bg':'#421b1b','danger-border':'#7a2a2a','danger-solid':'var(--red-600)','on-danger':'#ffffff',
  'info':'#76bbe2','info-bg':'#132c3a','info-border':'#22506a',
  'focus-ring':'#59c9a5','overlay':'rgba(0, 0, 0, 0.65)',
  'logo-green':'var(--brand-solid)','logo-green-hover':'var(--brand-solid-hover)',
}
DARK_SHADOWS = """  --shadow-xs: 0 1px 1px rgba(0, 0, 0, 0.35);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.5);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.6);
  --shadow-hover: 0 2px 4px rgba(0, 0, 0, 0.4), 0 12px 28px rgba(0, 0, 0, 0.6);"""

# Legacy primitive names → new ramps (old components reference these).
LEGACY = {}
for k in GREEN: LEGACY[f'color-primary-{k}'] = f'var(--green-{k})'
for old,new in {50:50,100:100,200:200,300:300,400:400,500:400,600:500,700:700}.items(): LEGACY[f'color-accent-{old}'] = f'var(--yellow-{new})'
LEGACY.update({'color-amber-400':'var(--amber-500)','color-amber-500':'var(--amber-600)','color-amber-700':'var(--amber-700)'})
for k in SAND: LEGACY[f'color-neutral-{k}'] = f'var(--sand-{k})'
LEGACY.update({'color-success-50':'var(--green-50)','color-success-500':'var(--green-600)','color-success-700':'var(--green-700)',
  'color-warning-50':'var(--amber-50)','color-warning-500':'var(--amber-700)','color-warning-700':'var(--amber-700)',
  'color-error-50':'var(--red-50)','color-error-500':'var(--red-600)','color-error-700':'var(--red-700)',
  'color-info-50':'var(--blue-50)','color-info-500':'var(--blue-500)'})

def block(d, indent='  '):
    return '\n'.join(f'{indent}--{k}: {v};' for k,v in d.items())

old = OUT.read_text()
start = old.index('  /* ── Typography')
end = old.index('}', old.index('--tap-min'))
rest = old[start:end].rstrip() + '\n'

ramps = ''
for name,r in [('green',GREEN),('yellow',YELLOW),('sand',SAND),('red',RED),('amber',AMBER),('blue',BLUE)]:
    ramps += f'  /* {name} */\n' + '\n'.join(f'  --{name}-{k}: {v};' for k,v in r.items()) + '\n'

css = f"""/**
 * Nhonga design tokens. GENERATED by scripts/build-tokens.py — edit there.
 * Verified by scripts/check-contrast.mjs (WCAG 2.2 AA: 4.5:1 text, 3:1 UI).
 *
 * Palette — "think global, act local":
 *  · Green and yellow come straight from the Nhonga logo (#007A5E, #F5C518),
 *    which are also the green and yellow of the Mozambican flag's family.
 *  · Warm sand neutrals (Indian Ocean beach, not clinical grey) for surfaces.
 *  · Flag red only for errors/destructive actions; ocean blue only for info.
 *  · 60 / 30 / 10: sand surfaces / green brand / yellow for the one main action.
 *  · High contrast by default for outdoor, in-sunlight use on budget phones.
 *  · Ramps are stepped in OKLCH so 50→950 are perceptually even.
 *
 * Use SEMANTIC tokens in components (--brand, --brand-solid, --danger, …),
 * never the ramps or hex directly. --brand is for text; --brand-solid is for
 * fills behind --on-brand. Dark mode is a deliberate set, not an inversion.
 */

:root {{
  /* ── Primitive ramps ───────────────────────────────────────── */
{ramps}
  /* ── Semantic: light ───────────────────────────────────────── */
{block(LIGHT)}

  /* ── Legacy aliases (prefer the semantic tokens above) ─────── */
{block(LEGACY)}

{rest}}}

/* ── Dark mode: explicit, deliberate ─────────────────────────── */
:root[data-theme='dark'] {{
{block(DARK)}
{DARK_SHADOWS}
}}

@media (prefers-color-scheme: dark) {{
  :root:not([data-theme='light']) {{
{block(DARK, '    ')}
{DARK_SHADOWS.replace('  --', '    --')}
  }}
}}
"""
OUT.write_text(css)
print('wrote', OUT, len(css.splitlines()), 'lines')

# Palette data for the /estilo style guide, so it can never show stale colours.
def ts_ramp(name, r):
    return f"  {{ name: '{name}', swatches: [" + ', '.join(f"{{ token: '--{name}-{k}', hex: '{v}' }}" for k,v in r.items()) + '] },'
SEM = ['bg','surface','surface-sunken','border','border-input','text','text-muted','brand','brand-solid','brand-subtle','header-bg','cta','rating','success','warning','danger','info','focus-ring']
ts = ('// GENERATED by scripts/build-tokens.py — do not edit.\n'
      'export interface Swatch { token: string; hex?: string }\n'
      'export const RAMPS: { name: string; swatches: Swatch[] }[] = [\n'
      + '\n'.join(ts_ramp(n, r) for n, r in [('green',GREEN),('yellow',YELLOW),('sand',SAND),('red',RED),('amber',AMBER),('blue',BLUE)])
      + '\n];\n'
      'export const SEMANTIC: Swatch[] = [' + ', '.join(f"{{ token: '--{t}' }}" for t in SEM) + '];\n')
(ROOT / 'lib' / 'palette.ts').write_text(ts)
print('wrote lib/palette.ts')
