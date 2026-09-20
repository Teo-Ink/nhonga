import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DB } from '../../db/database.module.js';
import type { Db } from '../../db/types.js';
import {
  order as orderTable,
  orderItem,
  payment as paymentTable,
  subOrder as subOrderTable,
  type AddressSnapshot,
  type ProductSnapshot,
} from '../../db/schema/commerce.js';

export interface OrderView {
  readonly orderNumber: string;
  readonly placedAt: string;
  readonly currency: string;
  readonly itemsTotalCents: number;
  readonly grandTotalCents: number;
  readonly paymentStatus: string;
  readonly paymentProvider: string;
  readonly deliveryMethod: string;
  readonly address: AddressSnapshot;
  readonly items: ReadonlyArray<{
    readonly title: string;
    readonly optionsLabel: string;
    readonly imageUrl: string | null;
    readonly unitPriceCents: number;
    readonly quantity: number;
    readonly lineTotalCents: number;
  }>;
}

/** Read a placed order by its public order number, for the confirmation / tracking page. */
@Injectable()
export class OrderQueryService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async byNumber(orderNumber: string): Promise<OrderView> {
    const orders = await this.db
      .select({
        id: orderTable.id,
        orderNumber: orderTable.orderNumber,
        placedAt: orderTable.placedAt,
        currency: orderTable.currency,
        itemsTotalCents: orderTable.itemsTotalCents,
        grandTotalCents: orderTable.grandTotalCents,
        addressSnapshot: orderTable.addressSnapshot,
      })
      .from(orderTable)
      .where(eq(orderTable.orderNumber, orderNumber))
      .limit(1);

    const o = orders[0];
    if (o === undefined) {
      throw new NotFoundException({ error: 'Not Found', message: 'No such order' });
    }

    const payments = await this.db
      .select({ status: paymentTable.status, provider: paymentTable.provider })
      .from(paymentTable)
      .where(eq(paymentTable.orderId, o.id))
      .limit(1);

    const subOrders = await this.db
      .select({ id: subOrderTable.id, deliveryMethod: subOrderTable.deliveryMethod })
      .from(subOrderTable)
      .where(eq(subOrderTable.orderId, o.id));

    const subIds = subOrders.map((s) => s.id);
    const items =
      subIds.length === 0
        ? []
        : (
            await this.db
              .select({
                productSnapshot: orderItem.productSnapshot,
                unitPriceCents: orderItem.unitPriceCents,
                quantity: orderItem.quantity,
                lineTotalCents: orderItem.lineTotalCents,
              })
              .from(orderItem)
              .innerJoin(subOrderTable, eq(subOrderTable.id, orderItem.subOrderId))
              .where(eq(subOrderTable.orderId, o.id))
              .orderBy(asc(orderItem.id))
          ).map((it) => {
            const snap = it.productSnapshot as ProductSnapshot;
            return {
              title: snap.title,
              optionsLabel: snap.optionsLabel,
              imageUrl: snap.imageUrl,
              unitPriceCents: it.unitPriceCents,
              quantity: it.quantity,
              lineTotalCents: it.lineTotalCents,
            };
          });

    return {
      orderNumber: o.orderNumber,
      placedAt: o.placedAt.toISOString(),
      currency: o.currency,
      itemsTotalCents: o.itemsTotalCents,
      grandTotalCents: o.grandTotalCents,
      paymentStatus: payments[0]?.status ?? 'unknown',
      paymentProvider: payments[0]?.provider ?? 'unknown',
      deliveryMethod: subOrders[0]?.deliveryMethod ?? 'marketplace',
      address: o.addressSnapshot,
      items,
    };
  }
}
