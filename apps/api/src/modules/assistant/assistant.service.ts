import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/config.schema.js';
import { AnthropicProvider } from './anthropic.provider.js';
import type {
  AssistantProvider,
  ChatMessage,
  ChatReply,
  ListingDraft,
  SearchQueryResult,
} from './assistant.types.js';

export class AssistantError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid_input' | 'upstream' | 'rate_limited',
  ) {
    super(message);
    this.name = 'AssistantError';
  }
}

const MAX_MESSAGES = 20;
const MAX_CONTENT = 2000;
const RATE_WINDOW_MS = 60_000;

// Rough Claude pricing for cost logging only (USD per 1M tokens; not billed by
// us). Order-of-magnitude is enough to spot runaway usage.
const USD_PER_M_INPUT = 3;
const USD_PER_M_OUTPUT = 15;

/** Per-client sliding-window limiter. In-memory: fine for a single instance;
 *  a multi-instance deployment would move this to Redis. */
class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  constructor(private readonly perMinute: number) {}
  allow(clientId: string): boolean {
    const now = Date.now();
    const recent = (this.hits.get(clientId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
    if (recent.length >= this.perMinute) {
      this.hits.set(clientId, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(clientId, recent);
    return true;
  }
}

// Grounds the bot in Nhonga's real model so it doesn't invent policies. Kept
// factual and honest about the demo. Portuguese-first, but it mirrors the
// customer's language.
const SYSTEM_PROMPT = `És o assistente de apoio ao cliente do Nhonga, o mercado online de Moçambique (compra e venda entre pessoas e lojas locais).

Estilo: simpático, claro e breve. Responde no idioma do cliente (português de Moçambique por omissão; se escreverem em inglês, responde em inglês). Usa "tu"/linguagem próxima. Não inventes políticas nem dados; se não souberes, diz que não sabes e encaminha para a página de Ajuda (/ajuda) ou para contactar o vendedor.

O que sabes sobre o Nhonga (mercado de classificados — as pessoas contactam-se e combinam o negócio diretamente):
- Comprar: contacta-se o vendedor pelo anúncio (botão de WhatsApp ou telefone). Não há carrinho nem checkout na plataforma.
- Pagamento e entrega: combinados diretamente entre comprador e vendedor. Formas comuns: M-Pesa, e-Mola, mKesh ou dinheiro em mãos; a entrega é ao domicílio ou levantamento, sem tabela de portes.
- Segurança: o Nhonga NÃO processa pagamentos nem retém valores (não há pagamento protegido). Aconselha encontro em local público, verificar o produto antes de pagar e nunca pagar adiantado — ver /seguranca.
- Vender: é preciso conta (criar conta ou entrar por código no telemóvel), depois o onboarding cria a loja. Anunciar é grátis; há destaques pagos (Destaque, Turbo) e uma subscrição Loja Pro — ver /vender/planos.
- Categorias: Viaturas, Imóveis, Empregos, Serviços, Eventos, além de Moda, Eletrónica, Telemóveis, Casa e Cozinha, Alimentação e Beleza.

Regras importantes:
- NUNCA peças nem trates palavras-passe, códigos OTP, PIN, ou dados de cartão. Se o cliente os partilhar, avisa-o para não o fazer.
- Isto é uma demonstração: se perguntarem por algo que ainda não está ligado (apps móveis, login social), sê honesto.
- Não prometas prazos, preços ou reembolsos específicos que não conheças.
- Mantém as respostas curtas (2 a 5 frases) a menos que peçam passos detalhados.`;

// Drafts a classifieds listing from the seller's rough notes. Honest: never
// invents features the seller did not mention; no misleading claims. Returns
// strict JSON so the web form can fill the title and description fields.
const LISTING_PROMPT = `És um assistente que ajuda vendedores do Nhonga (mercado de classificados de Moçambique) a escrever anúncios claros e honestos.

Regras:
- Escreve em português de Moçambique, tom simpático e direto.
- Usa APENAS a informação que o vendedor deu. NÃO inventes marca, estado, medidas, garantias nem preços que não foram indicados.
- Nada de linguagem enganosa ou exagerada ("melhor do mundo", "100% garantido").
- Título: no máximo 60 caracteres, específico e sem MAIÚSCULAS a gritar.
- Descrição: 2 a 4 frases úteis para o comprador; podes sugerir que combine a visita/entrega e que verifique o artigo.

Responde SÓ com JSON válido, sem texto à volta, no formato:
{"title": "…", "description": "…"}`;

// Known category slugs the vision model may suggest. Anything else is ignored.
const CATEGORY_SLUGS = [
  'viaturas',
  'imoveis',
  'empregos',
  'servicos',
  'eventos',
  'moda',
  'electronica',
  'telemoveis',
  'casa',
  'alimentacao',
  'beleza',
] as const;

// Drafts a listing from a PHOTO of the item (plus optional seller notes). Honest:
// describes only what is visibly in the photo / stated in the notes — never
// invents brand, condition, specs or price. Also suggests a category.
const PHOTO_PROMPT = `És um assistente que ajuda vendedores do Nhonga (classificados de Moçambique) a criar um anúncio a partir de uma FOTO do artigo.

Regras:
- Escreve em português de Moçambique, tom simpático e direto.
- Descreve APENAS o que se vê na foto (e nas notas do vendedor, se houver). NÃO inventes marca, modelo, estado, medidas, garantias nem preço se não forem claros.
- Se não tiveres a certeza de um detalhe, não o afirmes.
- Título: máximo 60 caracteres, específico, sem MAIÚSCULAS a gritar.
- Descrição: 2 a 4 frases úteis para o comprador.
- Sugere a categoria mais adequada, ESCOLHENDO uma destas (ou null se nenhuma encaixar): ${CATEGORY_SLUGS.join(', ')}.

Responde SÓ com JSON válido, sem texto à volta:
{"title": "…", "description": "…", "category": "<slug ou null>"}`;

// Turns a spoken phrase into a catalogue search. Keeps it to keywords (not a
// sentence) and may pick a category from the known list.
const SEARCH_TEXT_PROMPT = `O utilizador está a pesquisar no Nhonga (mercado de Moçambique) por voz. A partir do que disse, extrai a melhor CONSULTA de pesquisa.

Regras:
- "query": palavras-chave curtas (o artigo/serviço e detalhes úteis como marca, zona), NÃO uma frase. Remove "quero", "procuro", "mostra-me", etc.
- "category": escolhe uma destas se encaixar, senão null: ${CATEGORY_SLUGS.join(', ')}.
- Mantém o idioma do utilizador.

Responde SÓ com JSON válido: {"query": "…", "category": "<slug ou null>"}`;

// Turns a photo into a catalogue search for similar listings.
const SEARCH_IMAGE_PROMPT = `O utilizador quer encontrar anúncios SEMELHANTES a este, no Nhonga (mercado de Moçambique), a partir de uma foto.

Regras:
- Identifica o produto ou serviço principal na imagem.
- "query": palavras-chave curtas para o encontrar (tipo de artigo + 1 a 2 detalhes visíveis como cor, marca ou modelo se forem claros). NÃO inventes marca/modelo se não tiveres a certeza.
- "category": escolhe uma destas se encaixar, senão null: ${CATEGORY_SLUGS.join(', ')}.

Responde SÓ com JSON válido: {"query": "…", "category": "<slug ou null>"}`;

@Injectable()
export class AssistantService {
  private readonly log = new Logger('Assistant');
  private readonly provider: AssistantProvider | null;
  private readonly limiter: RateLimiter;
  private readonly monthlyTokenCap: number;
  private monthKey = AssistantService.monthKey();
  private monthTokens = 0;

  constructor(config: ConfigService<AppConfig, true>) {
    const key = config.get('assistantApiKey', { infer: true });
    const model = config.get('assistantModel', { infer: true });
    this.provider = key ? new AnthropicProvider(key, model) : null;
    this.limiter = new RateLimiter(config.get('assistantRatePerMin', { infer: true }));
    this.monthlyTokenCap = config.get('assistantMonthlyTokenCap', { infer: true });
  }

  get configured(): boolean {
    return this.provider !== null;
  }

  async chat(messages: readonly ChatMessage[], clientId = 'anon'): Promise<ChatReply> {
    if (!this.limiter.allow(clientId)) {
      throw new AssistantError('Too many requests — try again shortly', 'rate_limited');
    }
    this.validate(messages);

    if (!this.provider) {
      return {
        reply:
          'O assistente de IA ainda não está ligado nesta demonstração (falta a chave ANTHROPIC_API_KEY). Entretanto, consulta a página de Ajuda (/ajuda) ou contacta o vendedor.',
        configured: false,
      };
    }

    if (this.overMonthlyCap()) {
      this.log.warn(`Monthly token cap (${this.monthlyTokenCap}) reached; serving capacity notice`);
      return {
        reply:
          'O assistente está muito ocupado neste momento. Tenta mais tarde ou consulta a página de Ajuda (/ajuda).',
        configured: true,
      };
    }

    try {
      const { text, usage } = await this.provider.complete(SYSTEM_PROMPT, messages);
      this.record(usage.inputTokens, usage.outputTokens);
      return {
        reply: text || 'Desculpa, não consegui responder agora. Tenta reformular a pergunta.',
        configured: true,
      };
    } catch (e) {
      // A provider outage (e.g. no credit) shouldn't 502 the chat — serve a
      // calm notice and point to Help, like the over-capacity path.
      this.log.warn(`chat upstream error: ${e instanceof Error ? e.message : e}`);
      return {
        reply:
          'O assistente está indisponível neste momento. Tenta mais tarde ou consulta a página de Ajuda (/ajuda) ou contacta o vendedor.',
        configured: true,
      };
    }
  }

  /** AI-assisted posting (D): draft a title + description from the seller's notes. */
  async draftListing(
    input: { category?: string; details: string },
    clientId = 'anon',
  ): Promise<ListingDraft> {
    if (!this.limiter.allow(clientId)) {
      throw new AssistantError('Too many requests — try again shortly', 'rate_limited');
    }
    const details = (input.details ?? '').trim();
    if (details.length < 3) {
      throw new AssistantError('Descreva o artigo em poucas palavras.', 'invalid_input');
    }
    if (details.length > MAX_CONTENT) {
      throw new AssistantError(`too long (max ${MAX_CONTENT} chars)`, 'invalid_input');
    }
    if (!this.provider) return { title: '', description: '', configured: false };
    if (this.overMonthlyCap()) {
      throw new AssistantError('O assistente está muito ocupado. Tenta mais tarde.', 'upstream');
    }

    const category = (input.category ?? '').trim() || 'geral';
    const user = `Categoria: ${category}\nNotas do vendedor: ${details}`;
    try {
      const { text, usage } = await this.provider.complete(LISTING_PROMPT, [
        { role: 'user', content: user },
      ]);
      this.record(usage.inputTokens, usage.outputTokens);
      return { ...parseDraft(text), configured: true };
    } catch (e) {
      // Degrade gracefully: if the provider is unreachable (e.g. no credit),
      // report the assistant as unavailable so the seller just fills the form
      // manually, instead of failing the request with a 502.
      this.log.warn(`draftListing upstream error: ${e instanceof Error ? e.message : e}`);
      return { title: '', description: '', configured: false };
    }
  }

  /** AI-assisted posting from a PHOTO (vision): draft title + description +
   *  a suggested category from the item's image, plus any seller notes. */
  async draftListingFromPhoto(
    input: { image: { mediaType: string; dataBase64: string }; notes?: string },
    clientId = 'anon',
  ): Promise<ListingDraft> {
    if (!this.limiter.allow(clientId)) {
      throw new AssistantError('Too many requests — try again shortly', 'rate_limited');
    }
    const { mediaType, dataBase64 } = input.image;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(mediaType) || !dataBase64) {
      throw new AssistantError('Imagem inválida (use JPEG, PNG, WEBP ou GIF).', 'invalid_input');
    }
    // ~7MB of base64 ≈ 5MB image — Claude's per-image ceiling.
    if (dataBase64.length > 7_000_000) {
      throw new AssistantError('Imagem demasiado grande.', 'invalid_input');
    }
    const notes = (input.notes ?? '').trim().slice(0, MAX_CONTENT);
    if (!this.provider) return { title: '', description: '', configured: false };
    if (this.overMonthlyCap()) {
      throw new AssistantError('O assistente está muito ocupado. Tenta mais tarde.', 'upstream');
    }

    const text = notes
      ? `Cria o anúncio a partir desta foto. Notas do vendedor: ${notes}`
      : 'Cria o anúncio a partir desta foto.';
    try {
      const { text: out, usage } = await this.provider.completeVision(PHOTO_PROMPT, text, {
        mediaType,
        dataBase64,
      });
      this.record(usage.inputTokens, usage.outputTokens);
      const draft = parseDraft(out);
      const category =
        draft.category && (CATEGORY_SLUGS as readonly string[]).includes(draft.category)
          ? draft.category
          : undefined;
      return {
        title: draft.title,
        description: draft.description,
        ...(category ? { category } : {}),
        configured: true,
      };
    } catch (e) {
      this.log.warn(`draftListingFromPhoto upstream error: ${e instanceof Error ? e.message : e}`);
      return { title: '', description: '', configured: false };
    }
  }

  /** AI search: turn a spoken phrase OR a photo into a catalogue query +
   *  category, to drive /pesquisa. Exactly one of text/image is used. */
  async searchQuery(
    input: { text?: string; image?: { mediaType: string; dataBase64: string } },
    clientId = 'anon',
  ): Promise<SearchQueryResult> {
    if (!this.limiter.allow(clientId)) {
      throw new AssistantError('Too many requests — try again shortly', 'rate_limited');
    }
    const text = (input.text ?? '').trim().slice(0, MAX_CONTENT);
    const image = input.image;
    if (!text && !image) {
      throw new AssistantError('Diga ou mostre o que procura.', 'invalid_input');
    }
    if (image) {
      if (!/^image\/(jpeg|png|webp|gif)$/.test(image.mediaType) || !image.dataBase64) {
        throw new AssistantError('Imagem inválida (use JPEG, PNG, WEBP ou GIF).', 'invalid_input');
      }
      if (image.dataBase64.length > 7_000_000) {
        throw new AssistantError('Imagem demasiado grande.', 'invalid_input');
      }
    }
    if (!this.provider) return { query: '', configured: false };
    if (this.overMonthlyCap()) {
      throw new AssistantError('O assistente está muito ocupado. Tenta mais tarde.', 'upstream');
    }

    try {
      const { text: out, usage } = image
        ? await this.provider.completeVision(
            SEARCH_IMAGE_PROMPT,
            text ? `Contexto do utilizador: ${text}` : 'Encontra anúncios semelhantes.',
            image,
          )
        : await this.provider.complete(SEARCH_TEXT_PROMPT, [{ role: 'user', content: text }]);
      this.record(usage.inputTokens, usage.outputTokens);
      const parsed = parseSearch(out);
      const category =
        parsed.category && (CATEGORY_SLUGS as readonly string[]).includes(parsed.category)
          ? parsed.category
          : undefined;
      return { query: parsed.query, ...(category ? { category } : {}), configured: true };
    } catch (e) {
      // Degrade gracefully — the caller falls back to the raw text as the query.
      this.log.warn(`searchQuery upstream error: ${e instanceof Error ? e.message : e}`);
      return { query: text, configured: false };
    }
  }

  private overMonthlyCap(): boolean {
    if (this.monthlyTokenCap <= 0) return false;
    this.rollMonth();
    return this.monthTokens >= this.monthlyTokenCap;
  }

  /** Log usage + a rough cost estimate, and accrue the monthly total. */
  private record(inputTokens: number, outputTokens: number): void {
    this.rollMonth();
    this.monthTokens += inputTokens + outputTokens;
    const costUsd = (inputTokens * USD_PER_M_INPUT + outputTokens * USD_PER_M_OUTPUT) / 1_000_000;
    this.log.log(
      `usage in=${inputTokens} out=${outputTokens} ~$${costUsd.toFixed(4)} monthTotal=${this.monthTokens}`,
    );
  }

  private rollMonth(): void {
    const key = AssistantService.monthKey();
    if (key !== this.monthKey) {
      this.monthKey = key;
      this.monthTokens = 0;
    }
  }

  private static monthKey(): string {
    const d = new Date();
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
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

/** Parse the model's reply into {query, category}. JSON first, then fall back to
 *  treating the whole reply as the query. */
function parseSearch(text: string): { query: string; category?: string } {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  try {
    const obj = JSON.parse(cleaned) as { query?: unknown; category?: unknown };
    const query = typeof obj.query === 'string' ? obj.query.trim().slice(0, 100) : '';
    const category =
      typeof obj.category === 'string' && obj.category.trim() ? obj.category.trim() : undefined;
    if (query) return { query, ...(category ? { category } : {}) };
  } catch {
    /* not JSON — use the raw text as the query */
  }
  return { query: cleaned.replace(/[\r\n]+/g, ' ').slice(0, 100) };
}

/** Parse the model's reply into {title, description}. Prefers strict JSON, with
 *  a plain-text fallback so a non-JSON reply still fills something useful. */
function parseDraft(text: string): { title: string; description: string; category?: string } {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  try {
    const obj = JSON.parse(cleaned) as {
      title?: unknown;
      description?: unknown;
      category?: unknown;
    };
    const title = typeof obj.title === 'string' ? obj.title.trim().slice(0, 80) : '';
    const description =
      typeof obj.description === 'string' ? obj.description.trim().slice(0, 1200) : '';
    const category =
      typeof obj.category === 'string' && obj.category.trim() ? obj.category.trim() : undefined;
    if (title || description) return { title, description, ...(category ? { category } : {}) };
  } catch {
    /* not JSON — fall back to plain text */
  }
  const lines = text
    .trim()
    .split('\n')
    .filter((l) => l.trim() !== '');
  return {
    title: (lines[0] ?? '').slice(0, 80),
    description: (lines.slice(1).join(' ') || (lines[0] ?? '')).slice(0, 1200),
  };
}
