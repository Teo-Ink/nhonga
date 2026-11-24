import { randomUUID } from 'node:crypto';
import {
  AuthUserOut,
  CheckoutOut,
  ConversationListOut,
  ProductListOut,
  RefundOut,
  SessionOut,
  WalletOut,
  type z,
} from '@nhonga/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../db/types.js';
import { hasTestDb, migrateTestDb, openTestDb } from '../test/pg.js';
import { signIn } from '../test/session.js';
import type { AuthUser, VerifyResult } from '../modules/auth/auth.service.js';
import { AuthService } from '../modules/auth/auth.service.js';
import { CatalogService } from '../modules/catalog/catalog.service.js';
import type { ProductListResponse } from '../modules/catalog/catalog.types.js';
import type { CheckoutView, RefundView } from '../modules/checkout/checkout.service.js';
import type { ConversationDto } from '../modules/messaging/messaging.service.js';
import { MessagingService } from '../modules/messaging/messaging.service.js';
import type { WalletView } from '../modules/wallet/wallet.service.js';
import { apiDocument } from './document.js';

// API-05: the response schemas in openapi.yaml describe what the services
// really return. Compile time: every service type fits its schema. Run time:
// real responses parse.
type Fits<A, B> = A extends B ? true : never;
const _compile: [
  Fits<ProductListResponse, z.input<typeof ProductListOut>>,
  Fits<AuthUser, z.input<typeof AuthUserOut>>,
  Fits<VerifyResult, z.input<typeof SessionOut>>,
  Fits<WalletView, z.input<typeof WalletOut>>,
  Fits<CheckoutView, z.input<typeof CheckoutOut>>,
  Fits<RefundView, z.input<typeof RefundOut>>,
  Fits<{ items: ConversationDto[]; unread: number }, z.input<typeof ConversationListOut>>,
] = [true, true, true, true, true, true, true];

describe('response schemas', () => {
  it('are referenced by the documented routes', async () => {
    const doc = JSON.stringify(await apiDocument());
    for (const n of ['ProductListOut', 'SessionOut', 'WalletOut', 'CheckoutOut', 'RefundOut']) {
      expect(doc).toContain(`#/components/schemas/${n}`);
    }
    expect(_compile).toHaveLength(7);
  }, 60_000);
});

describe.skipIf(!hasTestDb)('response schemas against real responses (Postgres)', () => {
  let db: Db;
  let close: () => Promise<void>;
  beforeAll(() => {
    migrateTestDb();
    ({ db, close } = openTestDb());
  });
  afterAll(async () => close());

  it('catalogue, session and inbox responses parse', async () => {
    const auth = new AuthService(db);
    const session = await signIn(auth);
    expect(() => SessionOut.parse(session)).not.toThrow();
    expect(() => AuthUserOut.parse(session.user)).not.toThrow();

    const catalog = new CatalogService(db, {} as never, auth, {} as never, {} as never);
    const list = await catalog.listProducts('pt', { limit: 10 });
    expect(() => ProductListOut.parse(list)).not.toThrow();
    const searched = await catalog.listProducts('pt', { q: `x${randomUUID().slice(0, 4)}` });
    expect(() => ProductListOut.parse(searched)).not.toThrow();

    const messaging = new MessagingService(db, auth, {} as never);
    const inbox = await messaging.list(session.sessionToken);
    expect(() => ConversationListOut.parse(inbox)).not.toThrow();
  });
});
