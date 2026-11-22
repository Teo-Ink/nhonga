import type { Metadata } from 'next';
import { LegalPage } from '../../components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Termos de Uso · Nhonga',
  description: 'As regras para comprar, vender e anunciar no Nhonga.',
};

// DRAFT for legal review. Fill in the [bracketed] items and set draft={false}
// once approved by a lawyer qualified in Mozambique.
export default function TermsPage() {
  return (
    <LegalPage title="Termos de Uso" updated="22 de novembro de 2026" draft>
      <p>
        Bem-vindo ao Nhonga, um mercado online de anúncios classificados em Moçambique. Estes Termos
        regulam o uso do site nhonga.co.mz, das aplicações móveis e dos serviços associados (o
        «Nhonga»), explorados por <strong>[Nome legal da empresa]</strong>, NUIT{' '}
        <strong>[número]</strong>, com sede em <strong>[morada, Maputo]</strong>. Ao criar uma conta
        ou usar o Nhonga, aceita estes Termos e a nossa{' '}
        <a href="/privacidade">Política de Privacidade</a>.
      </p>

      <h2>1. Quem pode usar o Nhonga</h2>
      <p>
        Para criar conta, publicar anúncios ou pagar serviços tem de ter pelo menos 18 anos e um
        número de telemóvel moçambicano válido, que confirmamos por SMS. É responsável pela
        segurança do seu telemóvel e por tudo o que for feito na sua conta. Cada pessoa ou empresa
        deve usar uma única conta.
      </p>

      <h2>2. O papel do Nhonga</h2>
      <p>
        O Nhonga é uma plataforma que liga quem vende a quem compra. Não somos parte das vendas
        combinadas entre utilizadores, não somos donos dos artigos anunciados e não garantimos a sua
        qualidade, segurança, legalidade ou a veracidade dos anúncios. O preço, a entrega e o
        pagamento de cada negócio são combinados diretamente entre comprador e vendedor.
      </p>
      <p>
        Recomendamos: ver o artigo antes de pagar, encontrar-se em locais públicos e nunca enviar
        dinheiro adiantado a quem não conhece. Veja os conselhos em{' '}
        <a href="/seguranca">Segurança</a>.
      </p>

      <h2>3. Anúncios</h2>
      <p>Ao publicar um anúncio, garante que:</p>
      <ul>
        <li>tem o direito de vender ou oferecer o que anuncia;</li>
        <li>a descrição, o preço e as fotografias são verdadeiros e atuais;</li>
        <li>as fotografias são suas ou tem autorização para as usar;</li>
        <li>cumpre a lei moçambicana aplicável ao artigo ou serviço.</li>
      </ul>
      <p>É proibido anunciar, entre outros:</p>
      <ul>
        <li>armas, munições e explosivos;</li>
        <li>drogas, medicamentos sujeitos a receita e substâncias controladas;</li>
        <li>artigos roubados, contrafeitos ou que violem direitos de terceiros;</li>
        <li>animais ou produtos de espécies protegidas;</li>
        <li>
          documentos de identificação, cartões SIM registados em nome de outra pessoa ou contas;
        </li>
        <li>conteúdo sexual, ofensivo, discriminatório ou que incite à violência;</li>
        <li>esquemas de pirâmide, empréstimos ilegais ou ofertas de emprego enganosas.</li>
      </ul>
      <p>
        Podemos rever, recusar, editar a categoria ou remover anúncios que violem estes Termos, e
        suspender contas em caso de abuso, fraude ou violações repetidas. Pode denunciar um anúncio
        com o botão «Denunciar» na página do anúncio.
      </p>

      <h2>4. Serviços pagos e carteira</h2>
      <p>
        Publicar anúncios é gratuito. São pagos os serviços opcionais: destaques, «Loja Pro»,
        pacotes e publicidade. Os pagamentos são feitos por M-Pesa, e-Mola, mKesh ou cartão, através
        de prestadores de pagamento autorizados (PawaPay e PaySuite). O Nhonga não vê nem guarda o
        seu PIN.
      </p>
      <p>
        O saldo da carteira e os pontos só podem ser usados em serviços do Nhonga, não são
        convertíveis em dinheiro e não rendem juros. Os preços são apresentados em meticais (MT)
        <strong> [indicar se incluem IVA]</strong>. Um serviço já ativado não é reembolsável, salvo
        se não tiver sido prestado por falha nossa ou nos casos previstos na lei.{' '}
        <strong>[Confirmar política de reembolso e prazos com o advogado.]</strong>
      </p>

      <h2>5. Mensagens e conduta</h2>
      <p>
        As mensagens servem para combinar negócios. Não é permitido enviar spam, ameaças, assédio,
        pedidos de dados pessoais ou bancários, nem tentar levar o outro utilizador a pagar fora de
        canais seguros. Podemos analisar mensagens denunciadas para proteger os utilizadores.
      </p>

      <h2>6. Conteúdo e propriedade intelectual</h2>
      <p>
        O conteúdo que publica continua a ser seu. Para que o Nhonga funcione, concede-nos uma
        licença gratuita e não exclusiva para alojar, mostrar, adaptar (por exemplo, redimensionar
        fotografias) e divulgar esse conteúdo no Nhonga e na sua promoção, enquanto o anúncio
        estiver publicado. A marca, o design e o software do Nhonga pertencem a{' '}
        <strong>[Nome legal da empresa]</strong>.
      </p>

      <h2>7. Responsabilidade</h2>
      <p>
        Fazemos o possível para manter o Nhonga disponível e seguro, mas não garantimos
        funcionamento sem interrupções. Na medida permitida pela lei, não respondemos por perdas
        resultantes de negócios entre utilizadores, de conteúdo publicado por terceiros ou de falhas
        de serviços de terceiros (operadoras, prestadores de pagamento). Nada nestes Termos exclui
        direitos que a lei lhe garante como consumidor.
      </p>

      <h2>8. Encerrar a conta</h2>
      <p>
        Pode pedir o encerramento da sua conta a qualquer momento através do suporte. Podemos
        suspender ou encerrar contas que violem estes Termos. O saldo não utilizado de contas
        encerradas por violação dos Termos <strong>[definir tratamento com o advogado]</strong>.
      </p>

      <h2>9. Alterações</h2>
      <p>
        Podemos atualizar estes Termos. Avisaremos as alterações importantes no Nhonga ou por SMS
        antes de entrarem em vigor. Continuar a usar o Nhonga depois disso significa que aceita a
        nova versão.
      </p>

      <h2>10. Lei aplicável e litígios</h2>
      <p>
        Estes Termos regem-se pela lei da República de Moçambique. Em caso de litígio, procuraremos
        primeiro uma solução amigável; não sendo possível, são competentes os tribunais judiciais da
        cidade de Maputo, sem prejuízo de outras regras legais imperativas.
      </p>

      <h2>11. Contactos</h2>
      <p>
        <strong>[Nome legal da empresa]</strong> · <strong>[morada]</strong> · email{' '}
        <strong>[suporte@…]</strong> · WhatsApp <strong>[+258 …]</strong>
      </p>
    </LegalPage>
  );
}
