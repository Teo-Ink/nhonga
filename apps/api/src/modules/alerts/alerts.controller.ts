import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AlertError,
  AlertsService,
  type AlertRunResult,
  type SavedSearchDto,
} from './alerts.service.js';
import { ADMIN_HEADER, isAdminToken } from '../../common/admin.js';
import { AuthService, type AuthUser } from '../auth/auth.service.js';

interface CreateBody {
  phone?: unknown;
  label?: unknown;
  href?: unknown;
  query?: unknown;
}

/**
 * Saved searches + SMS alerts (F).
 *
 * Every route needs a session: the alert goes to the signed-in user's own
 * verified number, never to a number typed in a form, so the endpoint cannot
 * be used to send SMS to strangers or to read another number's searches.
 * Running every alert at once is an ops job (admin token).
 */
@Controller('saved-searches')
export class AlertsController {
  constructor(
    private readonly alerts: AlertsService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async list(@Headers('authorization') authz?: string): Promise<SavedSearchDto[]> {
    const user = await this.user(authz);
    return this.alerts.list(user.phoneE164);
  }

  @Post()
  @HttpCode(201)
  async create(
    @Body() body: CreateBody,
    @Headers('authorization') authz?: string,
  ): Promise<{ id: string }> {
    const user = await this.user(authz);
    const str = (v: unknown): string => (typeof v === 'string' ? v : '');
    const label = str(body.label).trim();
    const href = str(body.href).trim();
    const query =
      body.query && typeof body.query === 'object' ? (body.query as Record<string, unknown>) : {};
    if (!label || !href) {
      throw new BadRequestException({ message: 'label and href required' });
    }
    try {
      return await this.alerts.create({ phone: user.phoneE164, label, href, query });
    } catch (e) {
      throw toHttp(e);
    }
  }

  /** Check alerts. With ?id= the owner checks one of their own; without it,
   *  every alert is checked, which is the scheduled ops job (admin token). */
  @Post('run')
  @HttpCode(200)
  async run(
    @Query('id') id?: string,
    @Headers('authorization') authz?: string,
    @Headers(ADMIN_HEADER) adminToken?: string,
  ): Promise<AlertRunResult[]> {
    try {
      if (isAdminToken(adminToken)) return await this.alerts.run(id);
      if (!id) throw new NotFoundException({ message: 'Not found' });
      const user = await this.user(authz);
      return await this.alerts.run(id, user.phoneE164);
    } catch (e) {
      throw toHttp(e);
    }
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @Headers('authorization') authz?: string): Promise<void> {
    const user = await this.user(authz);
    await this.alerts.remove(id, user.phoneE164);
  }

  private async user(authz: string | undefined): Promise<AuthUser> {
    const token = authz?.startsWith('Bearer ') ? authz.slice(7).trim() : null;
    try {
      return await this.auth.me(token);
    } catch {
      throw new UnauthorizedException({ message: 'Inicie sessão para criar alertas.' });
    }
  }
}

function toHttp(e: unknown): HttpException {
  if (e instanceof AlertError) {
    if (e.code === 'not_found') return new NotFoundException({ message: e.message });
    return new BadRequestException({ message: e.message });
  }
  return new HttpException({ message: 'internal error' }, HttpStatus.INTERNAL_SERVER_ERROR);
}
