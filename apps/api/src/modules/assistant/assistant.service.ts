import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/config.schema.js';
import { AnthropicProvider } from './anthropic.provider.js';
import type { AssistantProvider, ChatMessage, ChatReply } from './assistant.types.js';

export class AssistantError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid_input' | 'upstream',
  ) {
    super(message);
    this.name = 'AssistantError';
  }
}

const MAX_MESSAGES = 20;
const MAX_CONTENT = 2000;

// Grounds the bot in Nhonga's real model so it doesn't invent policies. Kept
// factual and honest about the demo. Portuguese-first, but it mirrors the
// customer's language.
const SYSTEM_PROMPT = `És o assistente de apoio ao cliente do Nhonga, o mercado online de Moçambique (compra e venda entre pessoas e lojas locais).

Estilo: simpático, claro e breve. Responde no idioma do cliente (português de Moçambique por omissão; se escreverem em inglês, responde em inglês). Usa "tu"/linguagem próxima. Não inventes políticas nem dados; se não souberes, diz que não sabes e encaminha para a página de Ajuda (/ajuda) ou para contactar o vendedor.

O que sabes sobre o Nhonga:
- Pagamentos: M-Pesa, e-Mola, mKesh, ou dinheiro na entrega. Os pagamentos por carteira móvel confirmam-se no telemóvel do cliente.
- Entrega: combinada com o vendedor (ao domicílio ou levantamento). Não há tabela de portes fixa.
- Proteção ao comprador: reembolso se pagar pela plataforma e não receber o produto.
- Vender: é preciso conta (criar conta ou entrar por código no telemóvel), depois o onboarding cria a loja. Anunciar é grátis; há destaques pagos (Destaque, Turbo) e uma subscrição Loja Pro — ver /vender/planos.
- Seguimento de encomenda: pela referência da encomenda (formato NH-AAMMDD-XXXXX) em /conta ou na página do pedido.
- Categorias: Moda, Eletrónica, Telemóveis, Casa e Cozinha, Alimentação, Beleza.

Regras importantes:
- NUNCA peças nem trates palavras-passe, códigos OTP, PIN, ou dados de cartão. Se o cliente os partilhar, avisa-o para não o fazer.
- Isto é uma demonstração: se perguntarem por algo que ainda não está ligado (apps móveis, login social), sê honesto.
- Não prometas prazos, preços ou reembolsos específicos que não conheças.
- Mantém as respostas curtas (2 a 5 frases) a menos que peçam passos detalhados.`;

@Injectable()
export class AssistantService {
  private readonly provider: AssistantProvider | null;

  constructor(config: ConfigService<AppConfig, true>) {
    const key = config.get('assistantApiKey', { infer: true });
    const model = config.get('assistantModel', { infer: true });
    this.provider = key ? new AnthropicProvider(key, model) : null;
  }

  get configured(): boolean {
    return this.provider !== null;
  }

  async chat(messages: readonly ChatMessage[]): Promise<ChatReply> {
    this.validate(messages);

    if (!this.provider) {
      return {
        reply:
          'O assistente de IA ainda não está ligado nesta demonstração (falta a chave ANTHROPIC_API_KEY). Entretanto, consulta a página de Ajuda (/ajuda) ou contacta o vendedor.',
        configured: false,
      };
    }

    try {
      const reply = await this.provider.complete(SYSTEM_PROMPT, messages);
      return {
        reply: reply || 'Desculpa, não consegui responder agora. Tenta reformular a pergunta.',
        configured: true,
      };
    } catch (e) {
      throw new AssistantError(e instanceof Error ? e.message : 'upstream error', 'upstream');
    }
  }

  private validate(messages: readonly ChatMessage[]): void {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new AssistantError('messages must be a non-empty array', 'invalid_input');
    }
    if (messages.length > MAX_MESSAGES) {
      throw new AssistantError(`too many messages (max ${MAX_MESSAGES})`, 'invalid_input');
    }
    for (const m of messages) {
      if (m.role !== 'user' && m.role !== 'assistant') {
        throw new AssistantError('invalid message role', 'invalid_input');
      }
      if (typeof m.content !== 'string' || m.content.trim() === '') {
        throw new AssistantError('message content must be a non-empty string', 'invalid_input');
      }
      if (m.content.length > MAX_CONTENT) {
        throw new AssistantError(`message too long (max ${MAX_CONTENT} chars)`, 'invalid_input');
      }
    }
    if (messages[messages.length - 1]!.role !== 'user') {
      throw new AssistantError('the last message must be from the user', 'invalid_input');
    }
  }
}
