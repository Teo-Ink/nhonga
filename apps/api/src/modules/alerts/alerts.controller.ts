import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  AlertError,
  AlertsService,
  type AlertRunResult,
  type SavedSearchDto,
} from './alerts.service.js';

interface CreateBody {
  phone?: unknown;
  label?: unknown;
  href?: unknown;
  query?: unknown;
}

/** Saved searches + SMS alerts (F). */
@Controller('saved-searches')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  list(@Query('phone') phone?: string): Promise<SavedSearchDto[]> {
    if (!phone) return Promise.resolve([]);
    return this.alerts.list(phone);
  }

  @Post()
  @HttpCode(201)
  async create(@Body() body: CreateBody): Promise<{ id: string }> {
    const str = (v: unknown): string => (typeof v === 'string' ? v : '');
    const phone = str(body.phone).trim();
    const label = str(body.label).trim();
    const href = str(body.href).trim();
    const query =
      body.query && typeof body.query === 'object' ? (body.query as Record<string, unknown>) : {};
    if (!phone || !label || !href) {
      throw new BadRequestException({ message: 'phone, label and href required' });
    }
    try {
      return await this.alerts.create({ phone, label, href, query });
    } catch (e) {
      throw toHttp(e);
    }
  }

  /** Check saved searches and "send" alert SMS. Optional ?id= for just one. */
  @Post('run')
  @HttpCode(200)
  async run(@Query('id') id?: string): Promise<AlertRunResult[]> {
    try {
      return await this.alerts.run(id);
    } catch (e) {
      throw toHttp(e);
    }
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.alerts.remove(id);
  }
}

function toHttp(e: unknown): HttpException {
  if (e instanceof AlertError) {
    if (e.code === 'not_found') return new NotFoundException({ message: e.message });
    return new BadRequestException({ message: e.message });
  }
  return new HttpException({ message: 'internal error' }, HttpStatus.INTERNAL_SERVER_ERROR);
}
