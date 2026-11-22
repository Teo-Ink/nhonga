import { NextResponse } from 'next/server';
import { apiFetch, readJson, withApi } from '../../../../../lib/bff';

// Promo click tracker: records the click on the API, then redirects to the
// advertiser's URL. Only redirects to the campaign's stored http(s) URL (set by
// admin/booking), never a caller-supplied one — so this is not an open redirect.
// Path is /api/spot (not /api/ads) so ad blockers don't block the click.
async function handleGET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const res = await apiFetch(`/ads/${encodeURIComponent(id)}/click`, {
      method: 'POST',
      cache: 'no-store',
    });
    if (res.ok) {
      const { clickUrl } = (await readJson(res)) as { clickUrl?: string };
      if (clickUrl && /^https?:\/\//i.test(clickUrl)) {
        return NextResponse.redirect(clickUrl, 302);
      }
    }
  } catch {
    /* fall through */
  }
  return NextResponse.redirect(new URL('/', _req.url), 302);
}

export const GET = withApi(handleGET);
