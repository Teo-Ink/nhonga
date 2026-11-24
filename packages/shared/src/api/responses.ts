/**
 * Response shapes of the main API endpoints (OpenAPI), as Zod schemas. The API
 * services keep their TypeScript types; tests check both ways that they match
 * (compile-time assignability and runtime parsing of real responses), so the
 * contract cannot drift silently.
 */
import { z } from 'zod';

const iso = z.string().describe('ISO 8601');
const cents = z.number().int().describe('centavos (MZN)');

export const ImageOut = z.object({
  url: z.string(),
  width: z.number(),
  height: z.number(),
  lqip: z.string().optional(),
  alt: z.string().optional(),
});

export const VendorSummaryOut = z.object({
  id: z.string(),
  slug: z.string(),
  displayName: z.string(),
  isVerified: z.boolean(),
  isPro: z.boolean(),
  ratingAvg: z.number().nullable(),
  ratingCount: z.number().int(),
  // Always null since PRIV-01: numbers are only returned by POST /catalog/contacts.
  whatsapp: z.string().nullable(),
  phone: z.string().nullable(),
  /** Which channels the seller offers, without the digits (detail and shop only). */
  contact: z
    .object({ whatsapp: z.boolean(), phone: z.boolean(), hint: z.string().nullable() })
    .optional(),
});

/** The seller's numbers, returned only when someone asks to contact (PRIV-01). */
export const ContactOut = z.object({
  whatsapp: z.string().nullable(),
  phone: z.string().nullable(),
});

export const ProductListItemOut = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  priceCents: cents,
  compareAtCents: cents.optional(),
  discountPercent: z.number().nullable(),
  image: ImageOut.optional(),
  ratingAvg: z.number().nullable(),
  ratingCount: z.number().int(),
  inStock: z.boolean(),
  freeDelivery: z.boolean(),
  location: z.string().nullable(),
  postedAt: iso.nullable(),
  featured: z.boolean(),
  views: z.number().int(),
  bannerUrl: z.string().nullable(),
  category: z.object({ slug: z.string(), name: z.string() }),
  attributes: z.record(z.string(), z.string()),
  vendor: VendorSummaryOut,
});

export const ProductListOut = z.object({
  total: z.number().int(),
  items: z.array(ProductListItemOut),
  page: z.object({ cursor: z.string().nullable(), hasMore: z.boolean() }),
  correctedQuery: z.string().nullable().optional(),
  categoryCounts: z
    .array(z.object({ slug: z.string(), name: z.string(), count: z.number().int() }))
    .optional(),
});

export const AuthUserOut = z.object({
  id: z.string(),
  phoneE164: z.string(),
  displayName: z.string(),
  email: z.string().nullable(),
  phoneVerified: z.boolean(),
});

export const OtpRequestOut = z.object({
  challengeId: z.string(),
  expiresInSeconds: z.number().int(),
  devCode: z.string().optional().describe('Só em ambientes de teste com SMS simulado'),
});

export const SessionOut = z.object({
  sessionToken: z.string(),
  expiresAt: iso,
  user: AuthUserOut,
});

export const WalletOut = z.object({
  hasShop: z.boolean(),
  shopName: z.string().nullable(),
  balanceCents: cents,
  points: z.number().int(),
  isPro: z.boolean(),
  proUntil: iso.nullable(),
  transactions: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      amountCents: cents,
      points: z.number().int(),
      description: z.string(),
      createdAt: iso,
    }),
  ),
});

export const CheckoutOut = z.object({
  id: z.string(),
  status: z.enum(['pending', 'paid', 'failed', 'expired', 'review']),
  purpose: z.string(),
  amountCents: cents,
  method: z.string(),
  gateway: z.string(),
  checkoutUrl: z.string().nullable(),
  failureReason: z.string().nullable(),
  createdAt: iso,
  paidAt: iso.nullable(),
});

export const RefundOut = z.object({
  id: z.string(),
  status: z.string(),
  amountCents: cents,
  refundStatus: z.enum(['pending', 'refunded', 'failed']).nullable(),
  refundAmountCents: cents.nullable(),
  refundReason: z.string().nullable(),
  refundedAt: iso.nullable(),
});

export const ConversationListOut = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      counterpart: z.string(),
      productTitle: z.string().nullable(),
      productSlug: z.string().nullable(),
      lastMessage: z.string().nullable(),
      lastMessageAt: iso,
      unread: z.number().int(),
      role: z.enum(['buyer', 'seller']),
    }),
  ),
  unread: z.number().int(),
});

export const ThreadOut = z.object({
  counterpart: z.string(),
  productTitle: z.string().nullable(),
  messages: z.array(
    z.object({ id: z.string(), mine: z.boolean(), body: z.string(), createdAt: iso }),
  ),
});

export const IdOut = z.object({ id: z.string() });
export const ListingCreatedOut = z.object({ id: z.string(), slug: z.string() });
export const OkOut = z.object({ ok: z.literal(true) });

/** Every response schema, by name (OpenAPI components). */
export const API_RESPONSES = {
  ProductListOut,
  ContactOut,
  AuthUserOut,
  OtpRequestOut,
  SessionOut,
  WalletOut,
  CheckoutOut,
  RefundOut,
  ConversationListOut,
  ThreadOut,
  IdOut,
  ListingCreatedOut,
  OkOut,
} as const;
