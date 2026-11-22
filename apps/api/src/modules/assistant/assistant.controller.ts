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
import type { ChatMessage, ChatReply, ListingDraft, SearchQueryResult } from './assistant.types.js';

interface ChatBody {
  messages?: unknown;
}
interface ListingBody {
  category?: unknown;
  details?: unknown;
}
interface ListingPhotoBody {
  /** A data URL (data:image/jpeg;base64,…) or raw base64 bytes. */
  image?: unknown;
  /** Required when `image` is raw base64 (inferred from the data URL otherwise). */
  mediaType?: unknown;
  notes?: unknown;
}

/** Split a data URL into its media type + base64, or use the provided mediaType. */
function parseImage(image: unknown, mediaType: unknown): { mediaType: string; dataBase64: string } {
  if (typeof image !== 'string' || !image) {
    throw new BadRequestException({ message: 'image is required' });
  }
  const m = /^data:([^;]+);base64,(.+)$/s.exec(image);
  if (m) return { mediaType: m[1]!, dataBase64: m[2]! };
  if (typeof mediaType === 'string' && mediaType) return { mediaType, dataBase64: image };
  throw new BadRequestException({ message: 'image must be a data URL or include mediaType' });
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

  /** AI-assisted posting from a PHOTO (vision): draft a listing from the image. */
  @Post('listing-photo')
  @HttpCode(200)
  async listingPhoto(@Body() body: ListingPhotoBody, @Ip() ip: string): Promise<ListingDraft> {
    const image = parseImage(body.image, body.mediaType);
    const arg: { image: { mediaType: string; dataBase64: string }; notes?: string } = { image };
    if (typeof body.notes === 'string') arg.notes = body.notes;
    try {
      return await this.assistant.draftListingFromPhoto(arg, ip || 'anon');
    } catch (e) {
      throw toHttp(e);
    }
  }

  /** AI search: derive a catalogue query (+ category) from speech text or a photo. */
  @Post('search-query')
  @HttpCode(200)
  async searchQuery(
    @Body() body: { text?: unknown; image?: unknown; mediaType?: unknown },
    @Ip() ip: string,
  ): Promise<SearchQueryResult> {
    const arg: { text?: string; image?: { mediaType: string; dataBase64: string } } = {};
    if (typeof body.text === 'string' && body.text.trim()) arg.text = body.text;
    if (typeof body.image === 'string' && body.image) {
      arg.image = parseImage(body.image, body.mediaType);
    }
    try {
      return await this.assistant.searchQuery(arg, ip || 'anon');
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
