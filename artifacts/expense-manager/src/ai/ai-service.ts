import { supabase } from '@/lib/supabase';
import type { AiStatus, ChatMessage, ChatResponse, Provider } from './types';

export const PROVIDER_LABEL: Record<Provider, string> = {
  gemini: 'Gemini',
  claude: 'Claude',
};

export const DEFAULT_SUGGESTIONS = [
  'How much did I spend this month?',
  'Which category costs me the most?',
  'What was my biggest expense last month?',
  'Am I saving more than last month?',
];

export const GREETING_MESSAGE: ChatMessage = {
  role: 'assistant',
  content:
    "Hi! I'm Spendly AI. Ask me anything about your own expenses, income, loans or EMIs and I'll answer from your data.",
};

/**
 * Check which AI providers (Gemini, Claude) are currently configured and available.
 */
export async function fetchAiStatus(): Promise<AiStatus> {
  try {
    const res = await fetch('/api/chat');
    if (!res.ok) {
      return { providers: [], default: null };
    }
    const data = (await res.json()) as AiStatus;
    return data;
  } catch {
    return { providers: [], default: null };
  }
}

/**
 * Send conversation messages to the Spendly AI assistant serverless backend.
 * Uses the active Supabase JWT so Row-Level Security (RLS) is strictly enforced.
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  provider?: Provider | null
): Promise<{ reply: string; provider?: Provider; cached?: boolean }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Please sign in again to use the AI assistant.');
  }

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages: messages.filter((m) => m !== GREETING_MESSAGE),
      provider: provider || undefined,
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as ChatResponse;

  if (!res.ok || !payload.reply) {
    throw new Error(payload.error || 'Something went wrong. Please try again.');
  }

  return {
    reply: payload.reply,
    provider: payload.provider,
    cached: payload.cached,
  };
}

