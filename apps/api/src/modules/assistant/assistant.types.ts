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

export interface ListingDraft {
  /** Suggested title (empty when not configured). */
  readonly title: string;
  /** Suggested description (empty when not configured). */
  readonly description: string;
  /** Suggested category slug from the known list, when the model is confident. */
  readonly category?: string;
  /** False when no ANTHROPIC_API_KEY is set. */
  readonly configured: boolean;
}

/** An image for vision drafting: base64 bytes + its media type. */
export interface ImageInput {
  readonly mediaType: string;
  readonly dataBase64: string;
}

/** AI search: a structured catalogue query derived from speech or a photo. */
export interface SearchQueryResult {
  /** Keywords to search (empty when not configured or nothing recognised). */
  readonly query: string;
  /** A suggested category slug from the known list, when confident. */
  readonly category?: string;
  /** False when no ANTHROPIC_API_KEY is set. */
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
  /** Single-turn completion over a text prompt plus one image (vision). */
  completeVision(system: string, text: string, image: ImageInput): Promise<CompletionResult>;
}
