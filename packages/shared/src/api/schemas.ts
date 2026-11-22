/**
 * Request bodies of the public API (P2-01), written once and used by the API
 * (validation, OpenAPI) and available to the web and the app.
 *
 * The schemas check shape, types and sane sizes. Business rules (a known
 * category, enough balance, a valid top-up amount) stay in the services,
 * which word their errors for the person using the site.
 *
 * Unknown fields are dropped, not rejected, so an older client sending an extra
 * field keeps working.
 */
import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => z.string().trim().min(1).max(max);
/** Accepts 1500 or "1500" (forms send strings); integers only. */
const int = z.coerce.number().int().finite();
const id = required(64);
const slug = required(160);
const dataUrlImage = z
  .string()
  .max(12_000_000)
  .regex(/^data:image\/(jpeg|png|webp);base64,/, 'deve ser uma imagem JPEG, PNG ou WebP');
const paymentMethod = required(32);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const OtpRequest = z.object({ phone: required(32) });
export const OtpVerify = z.object({
  challengeId: id,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'o código tem 6 dígitos'),
  referralCode: text(32).optional(),
});

// ── Catalogue ─────────────────────────────────────────────────────────────────
export const ListingInput = z.object({
  title: required(140),
  category: required(64),
  description: text(4000).optional(),
  priceCents: int.min(0).max(100_000_000_000),
  stock: int.min(0).max(100_000).optional(),
  // New photos are data URLs; photos kept on edit are their existing URLs.
  photos: z
    .array(
      dataUrlImage.or(
        z
          .string()
          .max(2000)
          .regex(/^(\/api\/media\/|https:\/\/)/),
      ),
    )
    .max(6)
    .optional(),
  shopName: text(80).optional(),
});
export const ListingStatus = z.object({ status: z.enum(['active', 'sold', 'archived']) });
export const ListingEvent = z.object({ type: z.enum(['view', 'contact', 'share']) });
export const ListingReport = z.object({
  reason: z.enum(['fraud', 'prohibited', 'spam', 'wrong_category', 'offensive', 'other']),
  note: text(1000).optional(),
});

// ── Messaging, favourites, reviews, alerts ───────────────────────────────────
export const ConversationStart = z.object({
  vendorSlug: slug,
  productSlug: slug.optional(),
  body: required(2000),
});
export const MessageSend = z.object({ body: required(2000) });
export const FavoriteAdd = z.object({ productId: id });
export const ReviewCreate = z.object({
  rating: int.min(1).max(5),
  comment: text(1000).optional(),
  productSlug: slug.optional(),
});
export const SavedSearchCreate = z.object({
  label: required(120),
  href: required(500).startsWith('/'),
  query: z.record(z.string(), z.unknown()).optional(),
});

// ── Notifications ─────────────────────────────────────────────────────────────
export const PushTokenAdd = z.object({
  token: required(512),
  platform: z.enum(['android', 'ios', 'web', 'unknown']).optional(),
});
export const PushTokenRemove = z.object({ token: required(512) });
export const NotificationPrefs = z.object({
  contact: z.boolean().optional(),
  review: z.boolean().optional(),
});

// ── Money ─────────────────────────────────────────────────────────────────────
export const CheckoutTopup = z.object({ amountCents: int.positive(), method: paymentMethod });
export const CheckoutPackage = z.object({ packageId: id, method: paymentMethod });
export const CheckoutMockDecide = z.object({ outcome: z.enum(['paid', 'failed']).optional() });
export const CheckoutRefund = z.object({ reason: required(500) });
export const WalletBoost = z.object({ productId: id, planCode: required(32) });
export const WalletTopup = z.object({ amountCents: int.positive() });
export const WalletPurchase = z.object({ packageId: id });
export const PromotionPurchase = z.object({
  productSlug: slug,
  planCode: required(32),
  paymentMethod,
  payPhone: text(32).optional(),
});
export const SubscriptionCreate = z.object({
  vendorSlug: slug,
  planCode: required(32),
  paymentMethod,
});
export const AdBooking = z.object({
  advertiserName: required(80),
  advertiserContact: text(120).optional(),
  imageUrl: required(2000),
  clickUrl: z.string().trim().url().max(2000),
  headline: text(120).optional(),
  placement: required(32),
  categorySlug: slug.optional(),
  days: int.min(1).max(90),
  paymentMethod,
});

// ── Banners ───────────────────────────────────────────────────────────────────
export const BannerGenerate = z.object({
  productId: id,
  ratio: text(16).optional(),
  preset: text(32).optional(),
  prompt: text(500).optional(),
  /** 'ai' asks for a generated background; anything else uses the photo. */
  background: text(16).optional(),
});
export const BannerEdit = z.object({
  bannerId: id,
  headline: text(80).optional(),
  subheadline: text(120).optional(),
  cta: text(40).optional(),
  preset: text(32).optional(),
});
export const BannerApply = z.object({ bannerId: id });
export const BannerUnapply = z.object({ productId: id });

// ── Assistant (AI) ────────────────────────────────────────────────────────────
export const AssistantChat = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: required(4000) }))
    .min(1)
    .max(20),
});
export const AssistantListing = z.object({
  category: text(64).optional(),
  details: text(2000).optional(),
});
export const AssistantListingPhoto = z.object({
  image: z.string().min(1).max(12_000_000),
  mediaType: text(32).optional(),
  notes: text(1000).optional(),
});
export const AssistantSearchQuery = z.object({
  text: text(500).optional(),
  image: z.string().max(12_000_000).optional(),
  mediaType: text(32).optional(),
});

/** Every body schema, by name (used to build the OpenAPI document). */
export const API_BODIES = {
  OtpRequest,
  OtpVerify,
  ListingInput,
  ListingStatus,
  ListingEvent,
  ListingReport,
  ConversationStart,
  MessageSend,
  FavoriteAdd,
  ReviewCreate,
  SavedSearchCreate,
  PushTokenAdd,
  PushTokenRemove,
  NotificationPrefs,
  CheckoutTopup,
  CheckoutPackage,
  CheckoutMockDecide,
  CheckoutRefund,
  WalletBoost,
  WalletTopup,
  WalletPurchase,
  PromotionPurchase,
  SubscriptionCreate,
  AdBooking,
  BannerGenerate,
  BannerEdit,
  BannerApply,
  BannerUnapply,
  AssistantChat,
  AssistantListing,
  AssistantListingPhoto,
  AssistantSearchQuery,
} as const;
export type ApiBodyName = keyof typeof API_BODIES;
