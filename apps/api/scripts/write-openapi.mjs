// Regenerates openapi.yaml from the built API (dist): routes from the Nest
// decorators, bodies from the shared Zod schemas. Run after `pnpm build`:
//   pnpm --filter @nhonga/api openapi:write
import { writeFileSync } from 'node:fs';
import { stringify } from 'yaml';
import { apiDocument } from '../dist/openapi/document.js';

const doc = await apiDocument();
const header =
  '# GERADO a partir do código (src/openapi/build.ts). Não editar à mão:\n' +
  '#   pnpm --filter @nhonga/api openapi:write\n';
writeFileSync(
  new URL('../openapi.yaml', import.meta.url),
  header + stringify(doc, { lineWidth: 100, aliasDuplicateObjects: false }),
);
console.log(`openapi.yaml: ${Object.keys(doc.paths).length} paths`);
