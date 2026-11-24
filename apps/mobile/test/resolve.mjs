import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const STUBS = {
  'expo-secure-store': new URL('./stubs/secure-store.ts', import.meta.url).href,
};

function withExtension(url) {
  for (const ext of ['', '.ts', '.tsx', '/index.ts']) {
    const candidate = url + ext;
    try {
      if (existsSync(fileURLToPath(candidate)) && !candidate.endsWith('/')) return candidate;
    } catch {
      /* not a file URL */
    }
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  if (specifier.startsWith('@/')) {
    const url = withExtension(new URL(`src/${specifier.slice(2)}`, root).href);
    if (url) return { url, shortCircuit: true };
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    const url = withExtension(new URL(specifier, context.parentURL).href);
    if (url) return { url, shortCircuit: true };
  }
  return next(specifier, context);
}

export { pathToFileURL };
