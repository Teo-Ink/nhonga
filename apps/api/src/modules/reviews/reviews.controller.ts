import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import {
  ReviewError,
  ReviewsService,
  type CreateReviewInput,
  type ReviewDto,
  type ReviewListDto,
} from './reviews.service.js';

interface CreateBody {
  rating?: unknown;
  comment?: unknown;
  productSlug?: unknown;
}

/** Seller reviews. Listing is public; leaving a review needs a signed-in session. */
@Controller('vendors')
export class ReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly auth: AuthService,
  ) {}

  @Get(':vendorId/reviews')
  list(@Param('vendorId') vendorId: string): Promise<ReviewListDto> {
    return this.reviews.list(vendorId);
  }

  @Post(':vendorId/reviews')
  @HttpCode(201)
  async create(
    @Param('vendorId') vendorId: string,
    @Headers('authorization') authz: string | undefined,
    @Body() body: CreateBody,
  ): Promise<ReviewDto> {
    const user = await this.authUser(authz);
    const input: CreateReviewInput = { rating: Number(body.rating) };
    if (typeof body.comment === 'string') input.comment = body.comment;
    if (typeof body.productSlug === 'string') input.productSlug = body.productSlug;
    try {
      return await this.reviews.create(vendorId, user.id, user.displayName, input);
    } catch (e) {
      throw toHttp(e);
    }
  }

  /** Resolve the signed-in reviewer, or 401. */
  private async authUser(authz: string | undefined): Promise<{ id: string; displayName: string }> {
    const m = authz ? /^Bearer\s+(.+)$/i.exec(authz.trim()) : null;
    try {
      return await this.auth.me(m ? m[1]! : null);
    } catch {
      throw new UnauthorizedException({ message: 'Inicie sessão para avaliar um vendedor.' });
    }
  }
}

function toHttp(e: unknown): HttpException {
  if (e instanceof ReviewError) {
    const payload = { error: 'Review', message: e.message, code: e.code };
    return e.code === 'not_found'
      ? new NotFoundException(payload)
      : new BadRequestException(payload);
  }
  return e instanceof HttpException
    ? e
    : new HttpException({ message: 'Review error' }, HttpStatus.INTERNAL_SERVER_ERROR);
}
