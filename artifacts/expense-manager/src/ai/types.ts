export type Provider = 'gemini' | 'claude';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiStatus {
  providers: Provider[];
  default: Provider | null;
}

export interface ChatResponse {
  reply?: string;
  provider?: Provider;
  cached?: boolean;
  error?: string;
}

