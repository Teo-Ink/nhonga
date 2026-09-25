// Shapes for the AI customer-service assistant.

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  readonly role: ChatRole;
  readonly content: string;
}

export interface ChatReply {
  /** The assistant's answer, or a not-configured notice. */
  readonly reply: string;
  /** False when no ANTHROPIC_API_KEY is set (the bot is a placeholder). */
  readonly configured: boolean;
}

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}
export interface CompletionResult {
  readonly text: string;
  readonly usage: TokenUsage;
}

/** A pluggable completion backend (Anthropic today; Bedrock/etc. later). */
export interface AssistantProvider {
  complete(system: string, messages: readonly ChatMessage[]): Promise<CompletionResult>;
}
