import { redirect } from 'next/navigation';

// "Loja Pro" is paid from the seller's wallet on the account page. The old
// page charged a simulated payment and could not work with real payments
// (ARQ-06), so its address now leads there.
export default function VerifyShopPage(): never {
  redirect('/conta');
}
