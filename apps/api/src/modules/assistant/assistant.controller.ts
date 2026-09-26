import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Ip,
  Post,
} from '@nestjs/common';
import { AssistantError, AssistantService } from './assistant.service.js';
import type { ChatMessage, ChatReply, ListingDraft } from './assistant.types.js';

interface ChatBody {
  messages?: unknown;
}
interface ListingBody {
  category?: unknown;
  details?: unknown;
}

function parseMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) {
    throw new BadRequestException({ message: 'messages must be an array' });
  }
  return input.map((m): ChatMessage => {
    const obj = m as { role?: unknown; content?: unknown };
    if ((obj.role !== 'user' && obj.role !== 'assistant') || typeof obj.content !== 'string') {
      throw new BadRequestException({ message: 'each message needs role and string content' });
    }
    return { role: obj.role, content: obj.content };
  });
}

/** AI customer-service assistant. Stateless — the client sends the transcript. */
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get('status')
  status(): { configured: boolean } {
    return { configured: this.assistant.configured };
  }

  @Post('chat')
  @HttpCode(200)
  async chat(@Body() body: ChatBody, @Ip() ip: string): Promise<ChatReply> {
    const messages = parseMessages(body.messages);
    try {
      return await this.assistant.chat(messages, ip || 'anon');
    } catch (e) {
      throw toHttp(e);
    }
  }

  /** AI-assisted posting (D): draft a title + description from rough notes. */
  @Post('listing')
  @HttpCode(200)
  async listing(@Body() body: ListingBody, @Ip() ip: string): Promise<ListingDraft> {
    const details = typeof body.details === 'string' ? body.details : '';
    const arg: { category?: string; details: string } = { details };
    if (typeof body.category === 'string') arg.category = body.category;
    try {
      return await this.assistant.draftListing(arg, ip || 'anon');
    } catch (e) {
      throw toHttp(e);
    }
  }
}

function toHttp(e: unknown): HttpException {
  if (e instanceof AssistantError) {
    return new HttpException(
      { message: e.message },
      e.code === 'invalid_input'
        ? HttpStatus.BAD_REQUEST
        : e.code === 'rate_limited'
          ? HttpStatus.TOO_MANY_REQUESTS
          : HttpStatus.BAD_GATEWAY,
    );
  }
  return e instanceof HttpException
    ? e
    : new HttpException({ message: 'Assistant error' }, HttpStatus.INTERNAL_SERVER_ERROR);
}
