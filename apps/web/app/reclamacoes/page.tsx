import type { Metadata } from 'next';
import { ComplaintForm } from '../../components/ComplaintForm';
import { LegalPage } from '../../components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Reclamações · Nhonga',
  description: 'Apresente uma reclamação ao Nhonga e receba uma referência para acompanhar.',
};

// Complaints channel (LEG-02). The response deadline is a bracketed
// placeholder until the lawyer confirms it; the page stays a draft till then.
export default function ComplaintsPage() {
  return (
    <LegalPage title="Reclamações" updated="24 de novembro de 2026" draft>
      <p>
        Se algo correu mal com um pagamento, um anúncio, a sua conta, os seus dados ou a publicidade
        no Nhonga, apresente aqui a sua reclamação. Recebe logo uma referência e respondemos para o
        contacto que indicar, em até <strong>[prazo]</strong> dias úteis.
      </p>
      <p>
        Para denunciar um anúncio suspeito, use antes o botão «Denunciar» na página desse anúncio: é
        mais rápido. Guardamos as reclamações e as respostas durante 5 anos, como a lei exige.
      </p>
      <ComplaintForm />
      <h2>Outras vias</h2>
      <p>
        Pode também escrever para <strong>[suporte@…]</strong> ou recorrer às entidades de defesa do
        consumidor. Veja os <a href="/termos">Termos de Uso</a> e a{' '}
        <a href="/privacidade">Política de Privacidade</a>.
      </p>
    </LegalPage>
  );
}
