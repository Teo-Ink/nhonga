import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpException,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import {
  MessagingError,
  MessagingService,
  type ConversationDto,
  type MessageDto,
} from './messaging.service.js';

function bearer(authz: string | undefined): string | null {
  return authz?.startsWith('Bearer ') ? authz.slice(7).trim() : null;
}
function toHttp(e: unknown): HttpException {
  if (e instanceof MessagingError) {
    if (e.code === 'not_found') return new NotFoundException({ message: e.message });
    if (e.code === 'forbidden') return new ForbiddenException({ message: e.message });
    return new BadRequestException({ message: e.message });
  }
  throw e;
}

/** In-app buyer↔seller messaging (I). */
@Controller('conversations')
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get()
  list(
    @Headers('authorization') authz?: string,
  ): Promise<{ items: ConversationDto[]; unread: number }> {
    return this.messaging.list(bearer(authz)).catch((e) => {
      throw toHttp(e);
    });
  }

  @Post()
  @HttpCode(201)
  async start(
    @Body() body: { vendorSlug?: unknown; productSlug?: unknown; body?: unknown },
    @Headers('authorization') authz?: string,
  ): Promise<{ id: string }> {
    const str = (v: unknown): string => (typeof v === 'string' ? v : '');
    if (!str(body.vendorSlug) || !str(body.body)) {
      throw new BadRequestException({ message: 'vendorSlug and body required' });
    }
    try {
      return await this.messaging.start(
        {
          vendorSlug: str(body.vendorSlug),
          ...(str(body.productSlug) ? { productSlug: str(body.productSlug) } : {}),
          body: str(body.body),
        },
        bearer(authz),
      );
    } catch (e) {
      throw toHttp(e);
    }
  }

  @Get(':id')
  async thread(
    @Param('id') id: string,
    @Headers('authorization') authz?: string,
  ): Promise<{ counterpart: string; productTitle: string | null; messages: MessageDto[] }> {
    try {
      return await this.messaging.thread(id, bearer(authz));
    } catch (e) {
      throw toHttp(e);
    }
  }

  @Post(':id/messages')
  @HttpCode(201)
  async send(
    @Param('id') id: string,
    @Body() body: { body?: unknown },
    @Headers('authorization') authz?: string,
  ): Promise<{ ok: true }> {
    const text = typeof body.body === 'string' ? body.body : '';
    try {
      return await this.messaging.send(id, text, bearer(authz));
    } catch (e) {
      throw toHttp(e);
    }
  }
}
