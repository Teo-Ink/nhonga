import type { AssistantProvider, ChatMessage, CompletionResult } from './assistant.types.js';

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

  async complete(system: string, messages: readonly ChatMessage[]): Promise<CompletionResult> {
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
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
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
