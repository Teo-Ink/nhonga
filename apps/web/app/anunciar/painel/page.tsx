import type { Metadata } from 'next';
import { cents, formatMZN } from '@nhonga/shared';
import { getAdCampaigns } from '../../../lib/api';
import { getDictionary } from '../../../lib/i18n/index';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: `${t.ads.panel_title} — ${t.common.brand}` };
}

// Ads campaigns dashboard (ops view). Lists every campaign with impressions,
// clicks and CTR. Demo: unauthenticated; a real deployment gates this to staff.
export default async function CampaignsPanel() {
  const { t } = await getDictionary();
  const a = t.ads;
  const campaigns = await getAdCampaigns();

  const placementLabel = (p: string): string =>
    p === 'leaderboard' ? a.fmt_leaderboard : p === 'mpu' ? a.fmt_mpu : a.fmt_inline;
  const statusLabel = (s: string): string =>
    s === 'active' ? a.st_active : s === 'pending' ? a.st_pending : s === 'paused' ? a.st_paused : a.st_ended;
  const catLabel = (slug: string | null): string =>
    slug === null ? a.all_cats : ((t.categories as Record<string, string>)[slug] ?? slug);
  const fmtDate = (iso: string): string =>
    new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
  const ctr = (imp: number, clk: number): string =>
    imp > 0 ? `${((clk / imp) * 100).toFixed(1)}%` : '—';

  return (
    <section className="section spotpage" aria-labelledby="panel-title">
      <nav className="crumbs" aria-label="breadcrumb">
        <span className="crumbs__item">
          <a href="/anunciar">{a.page_title}</a>
          <span className="crumbs__sep" aria-hidden="true">
            /
          </span>
        </span>
        <span className="crumbs__item">
          <span aria-current="page">{a.panel_title}</span>
        </span>
      </nav>

      <h1 className="section__title" id="panel-title">
        {a.panel_title}
      </h1>
      <p className="spotpage__lead">{a.panel_subtitle}</p>
      <p className="notice" role="note">
        {a.panel_note}
      </p>

      {campaigns.length === 0 ? (
        <p className="reviews__empty">{a.panel_empty}</p>
      ) : (
        <div className="panelwrap">
          <table className="paneltable">
            <thead>
              <tr>
                <th scope="col">{a.col_advertiser}</th>
                <th scope="col">{a.col_placement}</th>
                <th scope="col">{a.col_category}</th>
                <th scope="col">{a.col_status}</th>
                <th scope="col">{a.col_period}</th>
                <th scope="col" className="num">
                  {a.col_impressions}
                </th>
                <th scope="col" className="num">
                  {a.col_clicks}
                </th>
                <th scope="col" className="num">
                  {a.col_ctr}
                </th>
                <th scope="col" className="num">
                  {a.col_spend}
                </th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td>{c.advertiserName}</td>
                  <td>{placementLabel(c.placement)}</td>
                  <td>{catLabel(c.categorySlug)}</td>
                  <td>
                    <span className={`pill pill--${c.status}`}>{statusLabel(c.status)}</span>
                  </td>
                  <td className="nowrap">
                    {fmtDate(c.startsAt)}–{fmtDate(c.endsAt)}
                  </td>
                  <td className="num">{c.impressions.toLocaleString('pt-PT')}</td>
                  <td className="num">{c.clicks.toLocaleString('pt-PT')}</td>
                  <td className="num">{ctr(c.impressions, c.clicks)}</td>
                  <td className="num">{formatMZN(cents(c.priceCents))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
