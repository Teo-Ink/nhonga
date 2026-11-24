import { randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DB } from '../../db/database.module.js';
import type { Db } from '../../db/types.js';
import { complaint } from '../../db/schema/complaints.js';
import { AuthService } from '../auth/auth.service.js';

export interface ComplaintInput {
  name: string;
  contact: string;
  subject: string;
  body: string;
}

export interface ComplaintView {
  id: string;
  reference: string;
  name: string;
  contact: string;
  subject: string;
  body: string;
  status: string;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

// No 0/O or 1/I, so a reference read over the phone is unambiguous.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A reference the person can quote, e.g. "R-2026-4F7K2Q". */
export function complaintReference(now = new Date(), bytes = randomBytes(6)): string {
  const code = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `R-${now.getUTCFullYear()}-${code}`;
}

/**
 * Complaints channel (LEG-02): the record the INTIC regulation asks platform
 * operators to keep for 5 years. Nothing here deletes a complaint.
 */
@Injectable()
export class ComplaintsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly auth: AuthService,
  ) {}

  async create(input: ComplaintInput, rawToken: string | null): Promise<{ reference: string }> {
    // Signed-in or not, a complaint is accepted; the account is linked when known.
    const userId = rawToken
      ? await this.auth.me(rawToken).then(
          (u) => u.id,
          () => null,
        )
      : null;
    const reference = complaintReference();
    await this.db.insert(complaint).values({
      id: randomUUID(),
      reference,
      userId,
      name: input.name,
      contact: input.contact,
      subject: input.subject,
      body: input.body,
    });
    return { reference };
  }

  async list(status?: string): Promise<ComplaintView[]> {
    const rows = await this.db
      .select()
      .from(complaint)
      .where(status ? eq(complaint.status, status) : undefined)
      .orderBy(desc(complaint.createdAt))
      .limit(200);
    return rows.map(view);
  }

  async resolve(
    reference: string,
    input: { status: 'answered' | 'closed'; resolution: string },
  ): Promise<ComplaintView> {
    const rows = await this.db
      .update(complaint)
      .set({ status: input.status, resolution: input.resolution, resolvedAt: new Date() })
      .where(eq(complaint.reference, reference))
      .returning();
    const row = rows[0];
    if (row === undefined) throw new NotFoundException({ message: 'Reclamação não encontrada.' });
    return view(row);
  }
}

function view(r: typeof complaint.$inferSelect): ComplaintView {
  return {
    id: r.id,
    reference: r.reference,
    name: r.name,
    contact: r.contact,
    subject: r.subject,
    body: r.body,
    status: r.status,
    resolution: r.resolution,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
  };
}
