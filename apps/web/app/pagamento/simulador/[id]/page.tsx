import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PaymentSimulator } from '../../../../components/checkout/PaymentSimulator';

export const metadata: Metadata = {
  title: 'Simulador de pagamento · Nhonga',
  robots: { index: false },
};

// Stands in for the gateway's hosted page when CHECKOUT_MODE=mock. The API
// refuses simulator calls in live mode; this page is also hidden in production.
export default async function SimulatorPage({ params }: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV === 'production' && process.env.CHECKOUT_SIMULATOR !== '1') notFound();
  const { id } = await params;
  return (
    <main className="container paypage">
      <PaymentSimulator id={id} />
    </main>
  );
}
