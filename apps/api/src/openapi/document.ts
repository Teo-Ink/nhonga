import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { API_BODIES, API_RESPONSES } from '@nhonga/shared';
import { buildOpenApi, collectRoutes, nameSchemas } from './build.js';

/** Finds every *.controller.(ts|js) under src/modules (or dist/modules). */
function controllerFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...controllerFiles(p));
    else if (/\.controller\.(ts|js)$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out.sort();
}

export async function apiDocument(): Promise<Record<string, unknown>> {
  const here = dirname(fileURLToPath(import.meta.url));
  const controllers: Array<new (...a: never[]) => unknown> = [];
  for (const f of controllerFiles(join(here, '..'))) {
    const mod = (await import(pathToFileURL(f).href)) as Record<string, unknown>;
    for (const v of Object.values(mod)) {
      if (typeof v === 'function' && v.name.endsWith('Controller')) {
        controllers.push(v as new (...a: never[]) => unknown);
      }
    }
  }
  nameSchemas(API_BODIES);
  nameSchemas(API_RESPONSES);
  return buildOpenApi(collectRoutes(controllers), API_BODIES, API_RESPONSES);
}
