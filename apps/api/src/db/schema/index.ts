/**
 * Schema barrel.
 *
 * Module ownership (architecture §2): each module owns its tables and reaches other modules'
 * data through their service interfaces, never by importing another module's tables directly.
 * The barrel exists for Drizzle Kit and for the migration tooling, not as an invitation to
 * cross-module joins.
 */

export * from './identity.js';
export * from './vendors.js';
export * from './catalog.js';
export * from './commerce.js';
export * from './platform.js';
