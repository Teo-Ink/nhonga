import { redirect } from 'next/navigation';

// Promoting a listing is paid from the seller's wallet (M-Pesa/e-Mola top-up)
// on the account page, next to each of their listings. The old page charged a
// simulated payment for any listing and could not work with real payments
// (ARQ-06), so its address now leads there.
export default function PromotePage(): never {
  redirect('/conta');
}
