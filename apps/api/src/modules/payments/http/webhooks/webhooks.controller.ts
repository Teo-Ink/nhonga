import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type { RawCallback } from '../../payment-provider.interface.js';
import { WebhookIngestionService } from './webhook-ingestion.service.js';

@Controller('webhooks/payments')
export class WebhooksController {
  constructor(private readonly ingestion: WebhookIngestionService) {}

  /**
   * Receive a provider payment callback.
   *
   * Signature verification runs against the exact received bytes, so the raw
   * body is required (rawBody is enabled in main.ts). Re-serialising a parsed
   * object would change whitespace and key order and break the digest.
   *
   * Always 200 once the event is durably recorded, so a provider stops
   * retrying; 400 for a bad signature or unusable body; 404 for a rail we do
   * not run.
   */
  @Post(':provider')
  @HttpCode(200)
  async receive(
    @Param('provider') providerParam: string,
    @Headers() headers: Record<string, string | undefined>,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ status: string }> {
    const rawBody = req.rawBody?.toString('utf8') ?? '';
    const raw: RawCallback = { headers, rawBody };

    const result = await this.ingestion.ingest(providerParam, raw);

    switch (result.outcome) {
      case 'unknown_provider':
        throw new NotFoundException({
          error: 'Not Found',
          message: `No payment provider "${providerParam}"`,
        });
      case 'bad_signature':
      case 'malformed':
        // The body reached us but did not verify or parse. Tell the provider it
        // was rejected; do not reveal which check failed.
        throw new BadRequestException({ error: 'Bad Request', message: 'Callback rejected' });
      case 'duplicate':
      case 'accepted':
        return { status: 'ok' };
    }
  }
}
