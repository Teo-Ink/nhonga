import { describe, expect, it } from 'vitest';
import { isUploadRoute } from './body-limits.js';

describe('isUploadRoute', () => {
  it('allows large bodies only on the photo routes', () => {
    expect(isUploadRoute('POST', '/catalog/products')).toBe(true);
    expect(isUploadRoute('PATCH', '/catalog/products/abc-123')).toBe(true);
    expect(isUploadRoute('POST', '/assistant/listing-photo')).toBe(true);
  });

  it('keeps every other route small', () => {
    expect(isUploadRoute('POST', '/auth/otp/request')).toBe(false);
    expect(isUploadRoute('POST', '/conversations')).toBe(false);
    expect(isUploadRoute('PATCH', '/catalog/products/abc/status')).toBe(false);
    expect(isUploadRoute('GET', '/catalog/products')).toBe(false);
    expect(isUploadRoute('POST', '/checkout/webhooks/pawapay')).toBe(false);
  });
});
