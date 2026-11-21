import type { Metadata } from 'next';
import { PaymentStatus } from '../../../components/checkout/PaymentStatus';

export const metadata: Metadata = { title: 'Pagamento · Nhonga', robots: { index: false } };

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="container paypage">
      <PaymentStatus id={id} />
    </main>
  );
}
