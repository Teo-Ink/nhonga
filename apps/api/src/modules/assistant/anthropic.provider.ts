import type {
  AssistantProvider,
  ChatMessage,
  CompletionResult,
  ImageInput,
} from './assistant.types.js';

interface AnthropicTextBlock {
  type: string;
  text?: string;
}
interface AnthropicResponse {
  content?: AnthropicTextBlock[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

/**
 * Anthropic (Claude) Messages API provider. Uses global fetch (Node 20+) — no
 * SDK dependency added. The API key is passed in from config and never logged.
 */
export class AnthropicProvider implements AssistantProvider {
  private static readonly ENDPOINT = 'https://api.anthropic.com/v1/messages';
  private static readonly VERSION = '2023-06-01';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly maxTokens = 700,
  ) {}

  complete(system: string, messages: readonly ChatMessage[]): Promise<CompletionResult> {
    return this.request(
      system,
      messages.map((m) => ({ role: m.role, content: m.content })),
    );
  }

  /** One user turn carrying an image block plus the instruction text. */
  completeVision(system: string, text: string, image: ImageInput): Promise<CompletionResult> {
    return this.request(system, [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: image.mediaType, data: image.dataBase64 },
          },
          { type: 'text', text },
        ],
      },
    ]);
  }

  private async request(system: string, messages: unknown[]): Promise<CompletionResult> {
    const res = await fetch(AnthropicProvider.ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': AnthropicProvider.VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        system,
        messages,
      }),
    });

    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      throw new Error(`Anthropic API error ${res.status}: ${detail}`);
    }

    const data = (await res.json()) as AnthropicResponse;
    const text = (data.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('')
      .trim();
    return {
      text,
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      },
    };
  }
}
