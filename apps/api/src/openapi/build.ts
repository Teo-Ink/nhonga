/**
 * Builds the OpenAPI document from the code itself (P2-11): the routes, path
 * and query parameters, authentication and status codes come from the Nest
 * decorators on the controllers, and the request bodies from the shared Zod
 * schemas the API validates with. The document cannot drift from the code:
 * openapi.test.ts fails when openapi.yaml is out of date
 * (`pnpm --filter @nhonga/api openapi:write` regenerates it).
 */
import 'reflect-metadata';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants.js';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum.js';
import { z } from '@nhonga/shared';
import { ZodBody } from '../common/zod-body.js';
import { ADMIN_HEADER } from '../common/admin.js';
import { IDEMPOTENT_ROUTES } from '../common/idempotency.js';
import { RETURNS_METADATA } from '../common/returns.js';

type Json = Record<string, unknown>;
const VERBS = ['get', 'post', 'put', 'delete', 'patch'] as const;

interface ArgMeta {
  index: number;
  data?: unknown;
  pipes?: unknown[];
}

export interface RouteInfo {
  readonly tag: string;
  readonly method: (typeof VERBS)[number];
  readonly path: string;
  readonly operationId: string;
  readonly params: string[];
  readonly query: string[];
  readonly auth: 'none' | 'session' | 'admin';
  readonly body: { name: string; schema: z.ZodType } | null;
  /** Named response schema (@Returns), when declared. */
  readonly returns: string | null;
  readonly status: number;
}

/** Reads every route of the given controller classes from Nest's metadata. */
export function collectRoutes(
  controllers: ReadonlyArray<new (...a: never[]) => unknown>,
): RouteInfo[] {
  const out: RouteInfo[] = [];
  for (const ctrl of controllers) {
    const base = String(Reflect.getMetadata(PATH_METADATA, ctrl) ?? '');
    const proto = ctrl.prototype as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(proto)) {
      const handler = proto[name];
      if (name === 'constructor' || typeof handler !== 'function') continue;
      const verb = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
      const sub = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
      if (verb === undefined || sub === undefined) continue;
      const method = VERBS[verb];
      if (!method) continue;
      const args = (Reflect.getMetadata(ROUTE_ARGS_METADATA, ctrl, name) ?? {}) as Record<
        string,
        ArgMeta
      >;
      const params: string[] = [];
      const query: string[] = [];
      let auth: RouteInfo['auth'] = 'none';
      let body: RouteInfo['body'] = null;
      for (const [k, a] of Object.entries(args)) {
        const type = Number(k.split(':')[0]);
        const data = typeof a.data === 'string' ? a.data.toLowerCase() : '';
        if (type === RouteParamtypes.PARAM && data) params.push(String(a.data));
        if (type === RouteParamtypes.QUERY && data) query.push(String(a.data));
        if (type === RouteParamtypes.HEADERS && data === 'authorization' && auth === 'none')
          auth = 'session';
        if (type === RouteParamtypes.HEADERS && data === ADMIN_HEADER) auth = 'admin';
        if (type === RouteParamtypes.BODY) {
          const pipe = (a.pipes ?? []).find((p): p is ZodBody<z.ZodType> => p instanceof ZodBody);
          if (pipe) body = { name: schemaName(pipe.schema), schema: pipe.schema };
        }
      }
      const path = `/${[base, sub].filter(Boolean).join('/')}`
        .replace(/\/+/g, '/')
        .replace(/:(\w+)/g, '{$1}')
        .replace(/(.)\/$/, '$1');
      const explicit = Reflect.getMetadata(HTTP_CODE_METADATA, handler) as number | undefined;
      const ret = Reflect.getMetadata(RETURNS_METADATA, handler) as z.ZodType | undefined;
      out.push({
        tag: base.split('/')[0] || 'root',
        method,
        path,
        operationId: `${ctrl.name.replace(/Controller$/, '')}_${name}`,
        params: [...new Set(params)].sort(),
        query: [...new Set(query)].sort(),
        auth,
        body,
        returns: ret ? schemaName(ret) : null,
        status: explicit ?? (method === 'post' ? 201 : 200),
      });
    }
  }
  return unifyParamNames(out).sort(
    (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
  );
}

/** /products/{id} and /products/{idOrSlug} are one path to OpenAPI: give
 *  every route on the same template the first name seen. */
function unifyParamNames(routes: RouteInfo[]): RouteInfo[] {
  const names = new Map<string, string[]>();
  const shape = (p: string) => p.replace(/\{[^}]+\}/g, '{}');
  const params = (p: string) => [...p.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]!);
  for (const r of [...routes].sort(
    (a, b) => a.path.length - b.path.length || a.path.localeCompare(b.path),
  )) {
    if (!names.has(shape(r.path))) names.set(shape(r.path), params(r.path));
  }
  return routes.map((r) => {
    const want = names.get(shape(r.path))!;
    const have = params(r.path);
    if (want.join() === have.join()) return r;
    let i = 0;
    const path = r.path.replace(/\{[^}]+\}/g, () => `{${want[i++]}}`);
    const rename = new Map(have.map((h, j) => [h, want[j]!]));
    return { ...r, path, params: r.params.map((p) => rename.get(p) ?? p).sort() };
  });
}

const NAMES = new Map<z.ZodType, string>();
export function nameSchemas(bodies: Record<string, z.ZodType>): void {
  for (const [n, s] of Object.entries(bodies)) NAMES.set(s, n);
}
function schemaName(s: z.ZodType): string {
  return NAMES.get(s) ?? 'AnonymousBody';
}

const problemRef = { $ref: '#/components/responses/Problem' };

export function buildOpenApi(
  routes: RouteInfo[],
  bodies: Record<string, z.ZodType>,
  outputs: Record<string, z.ZodType> = {},
): Json {
  const paths: Record<string, Json> = {};
  const schemas: Record<string, Json> = {
    Problem: {
      type: 'object',
      description: 'RFC 9457 problem details. 5xx answers carry requestId for support.',
      required: ['type', 'title', 'status'],
      properties: {
        type: { type: 'string' },
        title: { type: 'string' },
        status: { type: 'integer' },
        detail: { type: 'string' },
        instance: { type: 'string' },
        code: {
          type: 'string',
          description: 'Stable machine code, e.g. invalid_body, rate_limited',
        },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: { field: { type: 'string' }, message: { type: 'string' } },
          },
        },
        requestId: { type: 'string' },
      },
    },
  };
  for (const [name, s] of Object.entries(bodies)) {
    const js = z.toJSONSchema(s, { io: 'input', unrepresentable: 'any' }) as Json;
    delete js['$schema'];
    schemas[name] = js;
  }
  for (const [name, s] of Object.entries(outputs)) {
    const js = z.toJSONSchema(s, { io: 'output', unrepresentable: 'any' }) as Json;
    delete js['$schema'];
    schemas[name] = js;
  }

  for (const r of routes) {
    const op: Json = {
      tags: [r.tag],
      operationId: r.operationId,
      summary: `${r.method.toUpperCase()} ${r.path}`,
    };
    const parameters: Json[] = [
      ...r.params.map((p) => ({ name: p, in: 'path', required: true, schema: { type: 'string' } })),
      ...r.query.map((q) => ({
        name: q,
        in: 'query',
        required: false,
        schema: { type: 'string' },
      })),
    ];
    if (r.auth === 'admin') {
      parameters.push({
        name: ADMIN_HEADER,
        in: 'header',
        required: true,
        schema: { type: 'string' },
      });
    }
    const idempotent = r.method === 'post' && IDEMPOTENT_ROUTES.some((x) => x.test(r.path));
    if (idempotent) parameters.push({ $ref: '#/components/parameters/IdempotencyKey' });
    if (parameters.length > 0) op['parameters'] = parameters;
    if (r.auth === 'session') op['security'] = [{ bearerAuth: [] }, {}];
    if (r.auth === 'none' || r.auth === 'admin') op['security'] = [];
    if (r.body) {
      op['requestBody'] = {
        required: true,
        content: {
          'application/json': { schema: { $ref: `#/components/schemas/${r.body.name}` } },
        },
      };
    }
    const content = r.returns
      ? { 'application/json': { schema: { $ref: `#/components/schemas/${r.returns}` } } }
      : { 'application/json': { schema: {} } };
    const responses: Json = {
      [String(r.status)]:
        r.status === 204 ? { description: 'Sem conteúdo' } : { description: 'Sucesso', content },
    };
    if (r.body || r.params.length > 0 || r.query.length > 0) responses['400'] = problemRef;
    if (r.auth === 'session') responses['401'] = problemRef;
    if (r.auth === 'admin' || r.params.length > 0) responses['404'] = problemRef;
    if (idempotent) {
      responses['409'] = problemRef;
      responses['422'] = problemRef;
    }
    responses['429'] = problemRef;
    responses['default'] = problemRef;
    op['responses'] = responses;
    (paths[r.path] ??= {})[r.method] = op;
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Nhonga API',
      version: '1.0.0',
      description: [
        'API dos classificados Nhonga (Moçambique). Gerado a partir do código',
        '(`apps/api/src/openapi/build.ts`): rotas, parâmetros, autenticação e corpos',
        'são os que a API aplica.',
        '',
        '- Endereço: `/v1/…` (o mesmo caminho sem prefixo continua a funcionar).',
        '- Dinheiro em centavos inteiros (MZN).',
        '- Erros em `application/problem+json` (RFC 9457) com `code` estável.',
        '- Sessão: `Authorization: Bearer <token>` obtido em `/auth/otp/verify`.',
        '- Pagamentos: enviar `Idempotency-Key` (uma por acção).',
        '- Listas: `page.cursor` para a página seguinte.',
      ].join('\n'),
      contact: { name: 'Nhonga' },
      license: {
        name: 'Proprietário — todos os direitos reservados',
        identifier: 'LicenseRef-Proprietary',
      },
    },
    servers: [{ url: 'https://api.nhonga.co.mz/v1', description: 'Produção' }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', description: 'Token de sessão (7 dias).' },
      },
      parameters: {
        IdempotencyKey: {
          name: 'Idempotency-Key',
          in: 'header',
          required: false,
          description: 'Uma por acção de pagamento; a repetição devolve a primeira resposta.',
          schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{8,128}$' },
        },
      },
      responses: {
        Problem: {
          description: 'Erro (problem+json)',
          content: {
            'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } },
          },
        },
      },
      schemas,
    },
  };
}
