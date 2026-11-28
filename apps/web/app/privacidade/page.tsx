import type { Metadata } from 'next';
import { LegalPage } from '../../components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Política de Privacidade · Nhonga',
  description: 'Que dados pessoais o Nhonga recolhe, porquê, e os seus direitos.',
};

// DRAFT for legal review. Mozambique has no dedicated data-protection law yet
// (the bill was approved by the Council of Ministers on 3 March 2026 and is
// pending in the Assembly — see docs/juridico/01-analise-conformidade.md); obligations currently come from the Constitution, the
// Electronic Transactions Law (Lei n.º 3/2017) and related rules, and INTIC
// expects prior notification of personal-data processing. A lawyer must
// confirm that list, fill in the [bracketed] items and set draft={false}.
export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade" updated="24 de novembro de 2026" draft>
      <p>
        Esta política explica que dados pessoais o Nhonga recolhe, para que os usa, com quem os
        partilha e que direitos tem. O responsável pelo tratamento é{' '}
        <strong>[Nome legal da empresa]</strong>, NUIT <strong>[número]</strong>,{' '}
        <strong>[morada, Maputo]</strong>. A pessoa responsável pelo cumprimento das regras de
        proteção de dados é <strong>[nome e contacto]</strong>.
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
          <strong>Pagamentos:</strong> montante, método (M-Pesa, e-Mola, cartão Visa), estado e
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
          voz/foto, o assistente ou o gerador de banners (Anthropic e fal.ai, nos Estados Unidos da
          América). Não envie dados pessoais de terceiros ao assistente{' '}
          <strong>[confirmar contratos]</strong>;
        </li>
        <li>
          <strong>Início de sessão com Google ou Facebook</strong>, se escolher essa forma de
          entrar: recebemos da Google (Google LLC) ou do Facebook (Meta Platforms) o seu nome, o
          endereço de e-mail e um identificador da sua conta. Não recebemos a sua palavra-passe, não
          publicamos nada em seu nome e não acedemos aos seus contactos. Pode desligar essa conta em
          Conta → Privacidade e conta <strong>[confirmar termos dos fornecedores]</strong>;
        </li>
        <li>
          <strong>Registo de erros técnicos</strong>: Sentry (Functional Software, Inc.), com
          alojamento na Alemanha. Recebe dados técnicos de falhas do serviço, do site e da aplicação
          (data, endereço pedido, versão e tipo de dispositivo), sem o seu endereço IP, cookies ou
          conteúdo dos pedidos <strong>[confirmar contrato]</strong>;
        </li>
        <li>autoridades, quando a lei o exigir.</li>
      </ul>
      <p>
        Estes fornecedores só podem usar os dados para nos prestar o serviço, com medidas de
        segurança adequadas.
      </p>

      <h2>5. Transferências para fora de Moçambique</h2>
      <p>
        Alguns fornecedores, incluindo o alojamento, tratam dados fora de Moçambique (na África do
        Sul, o alojamento; nos Estados Unidos da América, os serviços de inteligência artificial; na
        Alemanha, o registo de erros técnicos). Nesses casos exigimos garantias de proteção
        equivalentes às desta política.{' '}
        <strong>[Confirmar requisitos de notificação/registo junto do INTIC.]</strong>
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
        Quando elimina a conta, apagamos de imediato o número, o nome, os endereços, os favoritos,
        os alertas e as notificações, e retiramos os anúncios. Guardamos apenas o que a lei nos
        obriga (pagamentos e encomendas) e as mensagens e avaliações já enviadas a outras pessoas,
        agora sem o seu nome.
      </p>

      <h2>7. Os seus direitos</h2>
      <p>
        Pode pedir acesso aos seus dados, a sua correção ou eliminação, opor-se a certos usos,
        retirar o consentimento e pedir uma cópia dos dados que nos forneceu. Sem esperar por nós,
        pode descarregar os seus dados e eliminar a conta em{' '}
        <a href="/conta/privacidade">Conta → Privacidade e conta</a> (e na app, em Conta). Para o
        resto, escreva para <strong>[privacidade@…]</strong>; respondemos em até{' '}
        <strong>[30]</strong> dias. Podemos pedir uma confirmação por SMS para garantir que o pedido
        é seu.
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

      <h2>10. Política de cookies e armazenamento no dispositivo</h2>
      <p>Usamos apenas cookies necessários ao funcionamento do Nhonga:</p>
      <ul>
        <li>
          <strong>sessão</strong>: mantém a sua sessão iniciada durante 7 dias; é apagado quando
          termina a sessão;
        </li>
        <li>
          <strong>convite</strong>: guarda o código de convite quando chega pelo link de um amigo.
        </li>
      </ul>
      <p>
        No seu dispositivo (e não nos nossos servidores) ficam o idioma, o tema, a poupança de
        dados, os favoritos, os anúncios vistos recentemente e as pesquisas guardadas; pode
        apagá-los limpando os dados do navegador ou da app. Não usamos cookies de publicidade, não
        seguimos a sua navegação noutros sites e não usamos ferramentas de análise de terceiros. Se
        isso mudar, pediremos primeiro o seu consentimento e atualizaremos esta política.
      </p>

      <h2>11. Aplicação móvel e permissões</h2>
      <ul>
        <li>
          <strong>Câmara e fotografias</strong>: só quando escolhe fotografar ou anexar imagens a um
          anúncio, ou pesquisar por imagem;
        </li>
        <li>
          <strong>Notificações</strong>: para avisar de mensagens, alertas e do estado dos seus
          anúncios; pode desligá-las nas definições do telemóvel.
        </li>
      </ul>
      <p>
        A app não pede acesso aos seus contactos, à localização por GPS nem ao microfone. A
        província e o distrito de um anúncio são os que escreve. Pode retirar cada permissão nas
        definições do telemóvel, a qualquer momento.
      </p>

      <h2>12. Inteligência artificial</h2>
      <p>
        O assistente, a pesquisa por voz ou fotografia e o gerador de banners usam serviços de
        inteligência artificial de terceiros. Enviamos apenas o que escreve, diz ou anexa nesse
        pedido e, no caso dos banners, os dados e a fotografia do anúncio. As respostas são geradas
        automaticamente e podem conter erros: confirme sempre a informação antes de decidir um
        negócio. Se um anúncio ou a sua conta forem suspensos, pode pedir que uma pessoa da nossa
        equipa reveja a decisão.{' '}
        <strong>
          [Confirmar com os fornecedores se os dados são usados para treinar modelos e por quanto
          tempo os guardam.]
        </strong>
      </p>

      <h2>13. Comunicações e marketing</h2>
      <p>
        Enviamos mensagens de serviço (códigos de acesso, avisos de segurança, estado de pagamentos
        e de anúncios) porque são necessárias. Só enviamos promoções por SMS, notificação ou outro
        meio se nos der o seu consentimento, e pode retirá-lo a qualquer momento escrevendo-nos ou
        seguindo a indicação da própria mensagem. Não vendemos nem cedemos o seu número a
        anunciantes.
      </p>

      <h2>14. Pagamentos e carteira</h2>
      <p>
        Os pagamentos são processados por prestadores de pagamento autorizados e pelas operadoras
        móveis. Recebemos e guardamos o montante, o método, o estado, a referência e o número de
        telemóvel usado no pagamento, para creditar a carteira, tratar reembolsos, prevenir fraude e
        cumprir a lei fiscal. Nunca recebemos o seu PIN nem os dados completos do cartão.
      </p>

      <h2>15. Mensagens, denúncias e moderação</h2>
      <p>
        As mensagens entre utilizadores ficam guardadas para que ambos as possam consultar. A nossa
        equipa só lê mensagens ou revê anúncios quando há uma denúncia, um sinal de fraude ou um
        pedido válido das autoridades. Quando denuncia um anúncio ou bloqueia alguém, guardamos esse
        registo para proteger os utilizadores; não revelamos quem fez a denúncia.
      </p>

      <h2>16. Estatísticas e registos de erros</h2>
      <p>
        Contamos visualizações de anúncios e toques em «Ver número» ou «Contactar», para mostrar
        estatísticas aos vendedores e melhorar o Nhonga. São dados nossos, não partilhados com redes
        de publicidade. Quando ocorre um erro técnico, podemos enviar um relatório sem o conteúdo
        das suas mensagens a um serviço de monitorização <strong>[nome, se ativado]</strong>.
      </p>

      <h2>17. Pedidos das autoridades</h2>
      <p>
        Só entregamos dados a autoridades quando a lei o exige e mediante pedido formal de entidade
        competente (por exemplo, decisão judicial ou do Ministério Público). Verificamos cada
        pedido, entregamos apenas o necessário e registamos o que foi entregue.
      </p>

      <h2>18. Se houver uma violação de dados</h2>
      <p>
        Se detetarmos um acesso indevido, perda ou divulgação de dados pessoais, contemos o
        incidente, avaliamos o risco e avisamos os utilizadores afetados por SMS ou no Nhonga, sem
        demora injustificada, dizendo o que aconteceu, que dados foram afetados e o que deve fazer.
        Comunicamos também às autoridades competentes nos termos da lei.
      </p>

      <h2>19. Alterações e contactos</h2>
      <p>
        Avisaremos alterações importantes a esta política no Nhonga. Para qualquer questão sobre
        privacidade: <strong>[privacidade@…]</strong> · <strong>[morada]</strong>.
      </p>
    </LegalPage>
  );
}
