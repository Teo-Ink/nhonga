'use client';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from './auth/SessionProvider';
import { IconStar } from './icons';
import type { VendorReview, VendorReviewList } from '../lib/api';
import type { Dictionary } from '../lib/i18n/index';

// Seller reviews block: rating summary, the list, and (for a signed-in visitor)
// a star + comment form. Submitting posts to the BFF, then refreshes the server
// component so the new review and the recomputed rating appear.
export function SellerReviews({
  vendorId,
  initial,
  t,
}: {
  vendorId: string;
  initial: VendorReviewList;
  t: Dictionary['reviews'];
}) {
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');

  const { items, summary } = initial;
  const countLabel = fmtCount(summary.ratingCount, t);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) return;
    setState('saving');
    try {
      const res = await fetch(`/api/vendors/${vendorId}/reviews`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState('done');
      setComment('');
      setRating(0);
      router.refresh();
    } catch {
      setState('error');
    }
  }

  return (
    <section className="section reviews" aria-labelledby="reviews-title">
      <div className="reviews__head">
        <h2 className="section__title" id="reviews-title">
          {t.title}
        </h2>
        {summary.ratingAvg !== null ? (
          <span className="reviews__summary">
            <strong className="reviews__avg">{summary.ratingAvg.toFixed(1)}</strong>
            <Stars value={Math.round(summary.ratingAvg)} />
            <span className="reviews__count">{countLabel}</span>
          </span>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="reviews__empty">{t.none}</p>
      ) : (
        <ul className="reviews__list">
          {items.map((r) => (
            <ReviewRow key={r.id} r={r} t={t} />
          ))}
        </ul>
      )}

      {/* Leave-a-review */}
      {user ? (
        <form className="reviewform" onSubmit={submit}>
          <h3 className="reviewform__title">{t.leave_title}</h3>
          <div className="reviewform__stars" role="radiogroup" aria-label={t.your_rating}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                className={`starbtn ${n <= rating ? 'is-on' : ''}`}
                aria-label={`${n}`}
                aria-pressed={n === rating}
                onClick={() => setRating(n)}
              >
                <IconStar width={26} height={26} />
              </button>
            ))}
          </div>
          <textarea
            className="field__input reviewform__text"
            rows={3}
            placeholder={t.comment_ph}
            value={comment}
            maxLength={1000}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="reviewform__foot">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={rating < 1 || state === 'saving'}
            >
              {state === 'saving' ? t.submitting : t.submit}
            </button>
            {state === 'done' ? (
              <span className="reviewform__msg" role="status">
                {t.success}
              </span>
            ) : null}
            {state === 'error' ? (
              <span className="reviewform__msg reviewform__msg--err" role="alert">
                {t.error}
              </span>
            ) : null}
          </div>
          <p className="reviewform__note">{t.edit_note}</p>
        </form>
      ) : (
        <div className="reviews__signin">
          <span>{t.signin_prompt}</span>
          <a className="btn btn--ghost" href={`/entrar?next=${encodeURIComponent(pathname)}`}>
            {t.signin_cta}
          </a>
        </div>
      )}
    </section>
  );
}

function ReviewRow({ r, t }: { r: VendorReview; t: Dictionary['reviews'] }) {
  const date = new Date(r.createdAt).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return (
    <li className="review">
      <div className="review__top">
        <span className="review__author">{r.author}</span>
        <Stars value={r.rating} />
      </div>
      {r.comment ? <p className="review__body">{r.comment}</p> : null}
      <span className="review__meta">
        {r.productSlug ? (
          <>
            {t.about}{' '}
            <a href={`/produto/${r.productSlug}`} className="review__link">
              {r.productSlug}
            </a>{' '}
            ·{' '}
          </>
        ) : null}
        {date}
      </span>
    </li>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="stars" role="img" aria-label={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <IconStar
          key={n}
          width={15}
          height={15}
          className={n <= value ? 'star--on' : 'star--off'}
        />
      ))}
    </span>
  );
}

function fmtCount(n: number, t: Dictionary['reviews']): string {
  return n === 1 ? t.count_one : t.count_other.replace('{n}', String(n));
}
