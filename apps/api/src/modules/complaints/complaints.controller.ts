import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ComplaintCreate, ComplaintResolve } from '@nhonga/shared';
import { ADMIN_HEADER, assertAdmin } from '../../common/admin.js';
import { ZodBody } from '../../common/zod-body.js';
import {
  ComplaintsService,
  type ComplaintInput,
  type ComplaintView,
} from './complaints.service.js';

function bearer(authz: string | undefined): string | null {
  return authz?.startsWith('Bearer ') ? authz.slice(7).trim() : null;
}

/** Formal complaints to the platform (LEG-02). */
@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly complaints: ComplaintsService) {}

  /** Anyone may complain; the answer carries the reference to quote. */
  @Post()
  @HttpCode(201)
  create(
    @Body(new ZodBody(ComplaintCreate)) body: ComplaintInput,
    @Headers('authorization') authz?: string,
  ): Promise<{ reference: string }> {
    return this.complaints.create(body, bearer(authz));
  }

  /** Ops: complaints, newest first. */
  @Get('admin')
  list(
    @Query('status') status?: string,
    @Headers(ADMIN_HEADER) adminToken?: string,
  ): Promise<ComplaintView[]> {
    assertAdmin(adminToken);
    return this.complaints.list(status);
  }

  /** Ops: record the answer given to a complaint. */
  @Post('admin/:reference/resolve')
  @HttpCode(200)
  resolve(
    @Param('reference') reference: string,
    @Body(new ZodBody(ComplaintResolve))
    body: { status: 'answered' | 'closed'; resolution: string },
    @Headers(ADMIN_HEADER) adminToken?: string,
  ): Promise<ComplaintView> {
    assertAdmin(adminToken);
    return this.complaints.resolve(reference, body);
  }
}
