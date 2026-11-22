import type { Metadata } from 'next';
import { LegalPage } from '../../components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Política de Privacidade · Nhonga',
  description: 'Que dados pessoais o Nhonga recolhe, porquê, e os seus direitos.',
};

// DRAFT for legal review. Mozambique has no dedicated data-protection law yet
// (a bill is pending); obligations currently come from the Constitution, the
// Electronic Transactions Law (Lei n.º 3/2017) and related rules, and INTIC
// expects prior notification of personal-data processing. A lawyer must
// confirm that list, fill in the [bracketed] items and set draft={false}.
export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade" updated="22 de novembro de 2026" draft>
      <p>
        Esta política explica que dados pessoais o Nhonga recolhe, para que os usa, com quem os
        partilha e que direitos tem. O responsável pelo tratamento é{' '}
        <strong>[Nome legal da empresa]</strong>, NUIT <strong>[número]</strong>,{' '}
        <strong>[morada, Maputo]</strong>.
      </p>

      <h2>1. Dados que recolhemos</h2>
      <ul>
        <li>
          <strong>Conta:</strong> número de telemóvel (confirmado por SMS), nome e, se for vendedor,
          o nome da loja.
        </li>
        <li>
          <strong>Anúncios:</strong> títulos, descrições, preços, fotografias, categoria e a
          província/distrito que indicar.
        </li>
        <li>
          <strong>Mensagens</strong> trocadas com outros utilizadores no Nhonga.
        </li>
        <li>
          <strong>Pagamentos:</strong> montante, método (M-Pesa, e-Mola, mKesh, cartão), estado e
          referência da transação. O PIN e os dados do cartão são tratados apenas pelos prestadores
          de pagamento; o Nhonga não os vê nem guarda.
        </li>
        <li>
          <strong>Uso e segurança:</strong> endereço IP, tipo de dispositivo e navegador, páginas
          visitadas, pesquisas e registos técnicos, para manter o serviço seguro e funcional.
        </li>
        <li>
          <strong>Pesquisa por voz ou fotografia</strong>, se a usar: o áudio ou a imagem são
          enviados para interpretar o pedido e não ficam guardados no seu perfil.
        </li>
      </ul>

      <h2>2. Para que os usamos</h2>
      <ul>
        <li>criar e proteger a sua conta (incluindo os códigos de acesso por SMS);</li>
        <li>publicar os seus anúncios e permitir o contacto entre compradores e vendedores;</li>
        <li>processar pagamentos e manter o registo da carteira;</li>
        <li>prevenir fraude, spam e anúncios proibidos, e responder a denúncias;</li>
        <li>enviar avisos que pediu (por exemplo, alertas de pesquisas guardadas);</li>
        <li>melhorar o Nhonga com estatísticas agregadas;</li>
        <li>cumprir obrigações legais, fiscais e pedidos válidos das autoridades.</li>
      </ul>
      <p>
        Usamos os dados com base na execução do serviço que nos pede, no seu consentimento (que pode
        retirar), nos nossos interesses legítimos de segurança e melhoria, e em obrigações legais.
        Não vendemos os seus dados pessoais.
      </p>

      <h2>3. O que fica público</h2>
      <p>
        Os anúncios, o nome da loja, a localização indicada e as avaliações são públicos. O seu
        número de telemóvel só é mostrado a quem toca em «Ver número» num anúncio seu; pode preferir
        combinar tudo pelas mensagens do Nhonga.
      </p>

      <h2>4. Com quem partilhamos</h2>
      <ul>
        <li>
          <strong>Prestadores de pagamento</strong> (PawaPay, PaySuite) e as operadoras móveis, para
          processar pagamentos;
        </li>
        <li>
          <strong>Fornecedor de SMS</strong> <strong>[nome]</strong>, para enviar códigos e avisos;
        </li>
        <li>
          <strong>Alojamento</strong>: Amazon Web Services, na região da Cidade do Cabo (África do
          Sul);
        </li>
        <li>
          <strong>Serviços de inteligência artificial</strong>, apenas quando usa a pesquisa por
          voz/foto, o assistente ou o gerador de banners (Anthropic; fal.ai){' '}
          <strong>[confirmar contratos]</strong>;
        </li>
        <li>autoridades, quando a lei o exigir.</li>
      </ul>
      <p>
        Estes fornecedores só podem usar os dados para nos prestar o serviço, com medidas de
        segurança adequadas.
      </p>

      <h2>5. Transferências para fora de Moçambique</h2>
      <p>
        Alguns fornecedores, incluindo o alojamento, tratam dados fora de Moçambique (por exemplo,
        na África do Sul). Nesses casos exigimos garantias de proteção equivalentes às desta
        política. <strong>[Confirmar requisitos de notificação/registo junto do INTIC.]</strong>
      </p>

      <h2>6. Por quanto tempo</h2>
      <ul>
        <li>conta e anúncios: enquanto a conta estiver ativa;</li>
        <li>
          mensagens: <strong>[prazo]</strong> após a última atividade da conversa;
        </li>
        <li>
          registos de pagamentos e faturação: pelo prazo exigido pela lei fiscal{' '}
          <strong>[confirmar prazo]</strong>;
        </li>
        <li>
          registos técnicos e de segurança: até <strong>[prazo]</strong>.
        </li>
      </ul>
      <p>
        Depois de encerrar a conta, apagamos ou anonimizamos os dados, exceto os que a lei nos
        obriga a guardar.
      </p>

      <h2>7. Os seus direitos</h2>
      <p>
        Pode pedir acesso aos seus dados, a sua correção ou eliminação, opor-se a certos usos,
        retirar o consentimento e pedir uma cópia dos dados que nos forneceu. Escreva para{' '}
        <strong>[privacidade@…]</strong>; respondemos em até <strong>[30]</strong> dias. Podemos
        pedir uma confirmação por SMS para garantir que o pedido é seu.
      </p>

      <h2>8. Segurança</h2>
      <p>
        Usamos ligações cifradas (HTTPS), acesso restrito aos dados, códigos de acesso de uso único,
        limites contra abusos e registos de auditoria. Nenhum sistema é infalível: se detetarmos uma
        violação que afete os seus dados, informaremos os utilizadores afetados e as autoridades nos
        termos da lei.
      </p>

      <h2>9. Menores</h2>
      <p>
        O Nhonga destina-se a maiores de 18 anos. Não recolhemos intencionalmente dados de menores;
        se souber de uma conta de um menor, contacte-nos para a removermos.
      </p>

      <h2>10. Cookies e armazenamento no dispositivo</h2>
      <p>
        Usamos apenas cookies necessários: o de sessão, que mantém a sessão iniciada durante 7 dias,
        e um cookie de convite, quando chega pelo link de um amigo. No seu dispositivo (e não nos
        nossos servidores) ficam o idioma, o tema, a poupança de dados, os favoritos, os anúncios
        vistos recentemente e as pesquisas guardadas; pode apagá-los limpando os dados do navegador.
        Não usamos cookies de publicidade nem ferramentas de análise de terceiros.{' '}
        <strong>[Rever se forem adicionadas.]</strong>
      </p>

      <h2>11. Alterações e contactos</h2>
      <p>
        Avisaremos alterações importantes a esta política no Nhonga. Para qualquer questão sobre
        privacidade: <strong>[privacidade@…]</strong> · <strong>[morada]</strong>.
      </p>
    </LegalPage>
  );
}
