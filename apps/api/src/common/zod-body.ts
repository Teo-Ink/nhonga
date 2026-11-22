import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { z } from '@nhonga/shared';

/**
 * Validates a request body against a shared Zod schema (P2-01):
 *   @Body(new ZodBody(ListingInput)) body: z.infer<typeof ListingInput>
 *
 * A bad body answers 400 problem+json with one entry per problem, worded for
 * people ("title: obrigatório"), and never reaches the service.
 */
export class ZodBody<S extends z.ZodType> implements PipeTransform<unknown, z.infer<S>> {
  constructor(readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    const r = this.schema.safeParse(value ?? {});
    if (r.success) return r.data;
    const errors = r.error.issues.map((i) => ({
      field: i.path.join('.') || '(corpo)',
      message: humanise(i),
    }));
    throw new BadRequestException({
      error: 'Validation',
      message: `Pedido inválido: ${errors.map((e) => `${e.field}: ${e.message}`).join('; ')}`,
      code: 'invalid_body',
      errors,
    });
  }
}

function humanise(i: z.core.$ZodIssue): string {
  switch (i.code) {
    case 'invalid_type':
      return i.input === undefined ? 'obrigatório' : `tipo inválido (esperado ${i.expected})`;
    case 'too_small':
      return i.origin === 'string'
        ? `mínimo ${String(i.minimum)} caracteres`
        : `mínimo ${String(i.minimum)}`;
    case 'too_big':
      return i.origin === 'string'
        ? `máximo ${String(i.maximum)} caracteres`
        : `máximo ${String(i.maximum)}`;
    case 'invalid_value':
      return `valor não permitido (${i.values.map(String).join(', ')})`;
    default:
      return i.message;
  }
}
