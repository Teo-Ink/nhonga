import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { AssistantError, AssistantService } from './assistant.service.js';
import type { ChatMessage, ChatReply } from './assistant.types.js';

interface ChatBody {
  messages?: unknown;
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
  async chat(@Body() body: ChatBody): Promise<ChatReply> {
    const messages = parseMessages(body.messages);
    try {
      return await this.assistant.chat(messages);
    } catch (e) {
      if (e instanceof AssistantError) {
        throw new HttpException(
          { message: e.message },
          e.code === 'invalid_input' ? HttpStatus.BAD_REQUEST : HttpStatus.BAD_GATEWAY,
        );
      }
      throw e;
    }
  }
}
