import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { cents, normaliseMzMsisdn } from '@nhonga/shared';
import { DB } from '../../db/database.module.js';
import type { Db } from '../../db/types.js';
import { appUser, address as addressTable, district, province } from '../../db/schema/identity.js';
import { CheckoutError, CheckoutService } from './checkout.service.js';
import type { ProviderId } from '../payments/payment-provider.interface.js';

export const CHECKOUT_SERVICE = Symbol('CHECKOUT_SERVICE');

export interface GuestCheckoutInput {
  readonly name: string;
  readonly phone: string;
  readonly email?: string;
  readonly deliveryMethod: 'home' | 'pickup';
  readonly province?: string;
  readonly district?: string;
  readonly bairro?: string;
  readonly landmark?: string;
  readonly house?: string;
  readonly paymentMethod: ProviderId;
  readonly payPhone?: string;
  readonly cartLines: ReadonlyArray<{ variantId: string; quantity: number }>;
  readonly expectedTotalCents: number;
  readonly idempotencyKey: string;
}

export interface GuestCheckoutResult {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly paymentStatus: 'awaiting_user' | 'failed';
  readonly failure: { code: string; message: string; retryable: boolean } | null;
}

const stripAccents = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/**
 * Turns a guest checkout request into a real order.
 *
 * A guest is a first-class buyer: we create (or reuse, by phone) a lightweight
 * app_user and a delivery address, then hand off to the CheckoutService, which
 * owns the atomic order-creation + stock-reservation + payment-initiation path.
 * Nothing here is faked — the order, sub-orders, items, stock ledger and payment
 * row are all persisted in Postgres.
 */
@Injectable()
export class GuestCheckoutService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CHECKOUT_SERVICE) private readonly checkout: CheckoutService,
  ) {}

  async placeOrder(input: GuestCheckoutInput): Promise<GuestCheckoutResult> {
    const contactMsisdn = normaliseMzMsisdn(input.phone);
    if (contactMsisdn === null) {
      throw new CheckoutError('invalid_msisdn', 'O número de telemóvel de contacto é inválido.');
    }

    const userId = await this.upsertGuestUser(contactMsisdn, input.name.trim() || 'Cliente');
    const { provinceCode, districtId } = await this.resolveGeography(input.province);
    const addressId = await this.createAddress(
      userId,
      contactMsisdn,
      districtId,
      provinceCode,
      input,
    );

    // Wallet rails push to the payer's handset; COD records the contact number.
    const isCod = input.paymentMethod === 'cod';
    const payMsisdn = isCod
      ? contactMsisdn
      : (normaliseMzMsisdn(input.payPhone ?? '') ?? contactMsisdn);

    const result = await this.checkout.placeOrder({
      userId,
      cartLines: input.cartLines.map((l) => ({
        cartItemId: randomUUID(),
        variantId: l.variantId,
        quantity: l.quantity,
      })),
      addressId,
      deliveryMethod: input.deliveryMethod === 'pickup' ? 'pickup' : 'marketplace',
      paymentProvider: input.paymentMethod,
      paymentMsisdn: payMsisdn,
      expectedTotalCents: cents(input.expectedTotalCents),
      idempotencyKey: input.idempotencyKey,
    });

    return {
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      paymentStatus: result.paymentStatus,
      failure: result.failure,
    };
  }

  /** One guest account per phone number; a returning guest reuses their row. */
  private async upsertGuestUser(phoneE164: string, displayName: string): Promise<string> {
    const existing = await this.db
      .select({ id: appUser.id })
      .from(appUser)
      .where(and(eq(appUser.phoneE164, phoneE164), isNull(appUser.deletedAt)))
      .limit(1);
    if (existing[0]) return existing[0].id;

    const id = randomUUID();
    await this.db
      .insert(appUser)
      .values({ id, phoneE164, displayName, locale: 'pt-MZ', status: 'active' })
      .onConflictDoNothing({ target: appUser.phoneE164 });

    const row = await this.db
      .select({ id: appUser.id })
      .from(appUser)
      .where(eq(appUser.phoneE164, phoneE164))
      .limit(1);
    if (row[0] === undefined) {
      throw new CheckoutError('address_not_found', 'Não foi possível criar a conta de convidado.');
    }
    return row[0].id;
  }

  /**
   * Resolve the buyer's province to a real seeded district. Delivery fees key off
   * district (D-10); the fee is zero here (delivery is arranged with the seller),
   * so any active district in the chosen province is sufficient. Falls back to a
   * default province when the free-text value does not match.
   */
  private async resolveGeography(
    provinceName: string | undefined,
  ): Promise<{ provinceCode: string; districtId: string }> {
    const provinces = await this.db
      .select({ code: province.code, name: province.name })
      .from(province);
    if (provinces.length === 0) {
      throw new CheckoutError('address_not_found', 'Geografia não configurada no servidor.');
    }
    const wanted = provinceName ? stripAccents(provinceName) : '';
    const matched = provinces.find((p) => stripAccents(p.name) === wanted) ?? provinces[0]!;

    const districts = await this.db
      .select({ id: district.id })
      .from(district)
      .where(and(eq(district.provinceCode, matched.code), eq(district.isActive, true)))
      .limit(1);
    if (districts[0] === undefined) {
      // Fall back to any district so checkout can proceed.
      const any = await this.db.select({ id: district.id }).from(district).limit(1);
      if (any[0] === undefined) {
        throw new CheckoutError('address_not_found', 'Nenhum distrito configurado no servidor.');
      }
      return { provinceCode: matched.code, districtId: any[0].id };
    }
    return { provinceCode: matched.code, districtId: districts[0].id };
  }

  private async createAddress(
    userId: string,
    phoneE164: string,
    districtId: string,
    provinceCode: string,
    input: GuestCheckoutInput,
  ): Promise<string> {
    const id = randomUUID();
    const isPickup = input.deliveryMethod === 'pickup';
    const bairro = isPickup ? '(Levantamento)' : input.bairro?.trim() || '—';
    const landmark = isPickup
      ? 'Levantamento com o vendedor'
      : input.landmark?.trim() || input.bairro?.trim() || '—';
    // Preserve the free-text district the buyer typed, which may be finer-grained
    // than the seeded district row.
    const notes = input.district?.trim() ? `Distrito indicado: ${input.district.trim()}` : null;

    await this.db.insert(addressTable).values({
      id,
      userId,
      recipientName: input.name.trim() || 'Cliente',
      phoneE164,
      provinceCode,
      districtId,
      bairro,
      landmark,
      ...(input.house?.trim() ? { houseNumber: input.house.trim() } : {}),
      ...(notes ? { notes } : {}),
      isDefault: false,
    });
    return id;
  }
}
