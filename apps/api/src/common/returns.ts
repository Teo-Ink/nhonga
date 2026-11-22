import { SetMetadata } from '@nestjs/common';
import type { z } from '@nhonga/shared';

/** Declares the response schema of a route for the OpenAPI document (API-05). */
export const RETURNS_METADATA = 'nhonga:returns';
export const Returns = (schema: z.ZodType) => SetMetadata(RETURNS_METADATA, schema);
