import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB } from '../../db/database.module.js';
import type { Db } from '../../db/types.js';
import { savedSearch } from '../../db/schema/alerts.js';
import { CatalogService } from '../catalog/catalog.service.js';
import type { ProductFilters, SortKey } from '../catalog/catalog.types.js';
import { DeliveryService } from '../notifications/delivery.service.js';

export class AlertError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid_input' | 'not_found',
  ) {
    super(message);
    this.name = 'AlertError';
  }
}

export interface SavedSearchDto {
  id: string;
  label: string;
  href: string;
  createdAt: string;
  lastRunAt: string | null;
}
export interface AlertRunResult {
  id: string;
  label: string;
  phone: string;
  total: number;
  newCount: number;
  sms: string | null;
  sent: boolean;
  /** How many devices the push reached (0 if the phone isn't a signed-in user). */
  push: number;
  /** Whether an in-app notification was also written. */
  inApp: boolean;
}

const SORTS: readonly SortKey[] = ['relevance', 'newest', 'price_asc', 'price_desc', 'rating'];

@Injectable()
export class AlertsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly catalog: CatalogService,
    private readonly delivery: DeliveryService,
  ) {}

  async create(input: {
    phone: string;
    label: string;
    href: string;
    query: Record<string, unknown>;
  }): Promise<{ id: string }> {
    const phone = input.phone.replace(/[^\d+]/g, '');
    if (phone.replace(/\D/g, '').length < 9) {
      throw new AlertError('invalid phone', 'invalid_input');
    }
    if (!input.label.trim() || !input.href.trim()) {
      throw new AlertError('label and href required', 'invalid_input');
    }
    const id = randomUUID();
    await this.db.insert(savedSearch).values({
      id,
      phoneE164: phone,
      label: input.label.slice(0, 120),
      href: input.href.slice(0, 512),
      query: sanitizeFilters(input.query),
    });
    return { id };
  }

  async list(phone: string): Promise<SavedSearchDto[]> {
    const rows = await this.db
      .select()
      .from(savedSearch)
      .where(eq(savedSearch.phoneE164, phone.replace(/[^\d+]/g, '')));
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      href: r.href,
      createdAt: r.createdAt.toISOString(),
      lastRunAt: r.lastRunAt?.toISOString() ?? null,
    }));
  }

  async remove(id: string): Promise<void> {
    await this.db.delete(savedSearch).where(eq(savedSearch.id, id));
  }

  /**
   * Check a saved search (or all of them) for matching listings and "send" an
   * SMS when there are new ones. New = published/bumped since the last run; on
   * the very first run every current match counts, so the alert is demonstrable.
   */
  async run(id?: string): Promise<AlertRunResult[]> {
    const rows = id
      ? await this.db.select().from(savedSearch).where(eq(savedSearch.id, id))
      : await this.db.select().from(savedSearch);
    if (id && rows.length === 0) throw new AlertError('saved search not found', 'not_found');

    const out: AlertRunResult[] = [];
    for (const r of rows) {
      const filters = toFilters(r.query);
      const res = await this.catalog.listProducts('pt', { ...filters, limit: 60 });
      const since = r.lastRunAt?.getTime() ?? null;
      const newCount =
        since === null
          ? res.total
          : res.items.filter((i) => i.postedAt !== null && Date.parse(i.postedAt) > since).length;

      let sms: string | null = null;
      let sent = false;
      let push = 0;
      let inApp = false;
      if (newCount > 0) {
        sms = `Nhonga: ${newCount} anuncio(s) para "${r.label}". Ver: https://nhonga.co.mz${r.href}`;
        // Fan the alert across SMS + push + in-app (push/in-app only reach the
        // phone if it belongs to a signed-in user with a registered device).
        const delivered = await this.delivery.notifyPhone(r.phoneE164, {
          title: `${newCount} novo(s) anúncio(s)`,
          body: `${r.label} — toque para ver`,
          href: r.href,
          smsText: sms,
        });
        sent = delivered.sms;
        push = delivered.push;
        inApp = delivered.inApp;
      }
      await this.db
        .update(savedSearch)
        .set({ lastRunAt: new Date() })
        .where(eq(savedSearch.id, r.id));

      out.push({
        id: r.id,
        label: r.label,
        phone: r.phoneE164,
        total: res.total,
        newCount,
        sms,
        sent,
        push,
        inApp,
      });
    }
    return out;
  }
}

// Keep only the catalogue filter fields we understand; ignore anything else a
// caller might send.
function sanitizeFilters(q: Record<string, unknown>): Record<string, unknown> {
  const f = toFilters(q);
  return { ...f } as Record<string, unknown>;
}

function toFilters(q: Record<string, unknown>): ProductFilters {
  const f: Record<string, unknown> = {};
  const qq = q['q'];
  const cat = q['categorySlug'];
  const sort = q['sort'];
  if (typeof qq === 'string' && qq.trim()) f['q'] = qq.trim().slice(0, 100);
  if (typeof cat === 'string' && cat) f['categorySlug'] = cat;
  const min = Number(q['minPriceCents']);
  const max = Number(q['maxPriceCents']);
  if (Number.isFinite(min) && min >= 0) f['minPriceCents'] = Math.trunc(min);
  if (Number.isFinite(max) && max >= 0) f['maxPriceCents'] = Math.trunc(max);
  if (typeof sort === 'string' && (SORTS as readonly string[]).includes(sort)) {
    f['sort'] = sort as SortKey;
  }
  return f as ProductFilters;
}
