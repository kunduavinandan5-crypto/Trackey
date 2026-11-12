import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Loader2, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { isRealSupabaseUser } from '@/lib/db-service';
import {
  DEFAULT_SUGGESTIONS,
  GREETING_MESSAGE,
  PROVIDER_LABEL,
  fetchAiStatus,
  sendChatMessage,
} from './ai-service';
import type { AiStatus, ChatMessage, Provider } from './types';

export function AiAssistant() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING_MESSAGE]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const userId = user?.id;
  const enabled = isRealSupabaseUser(user);

  // Ask the server which providers are configured (once, when first opened).
  useEffect(() => {
    if (!open || status || !enabled) return;
    let cancelled = false;
    fetchAiStatus()
      .then((s) => {
        if (cancelled) return;
        setStatus(s);
        setProvider(s.default);
      })
      .catch(() => {
        if (!cancelled) setStatus({ providers: [], default: null });
      });
    return () => {
      cancelled = true;
    };
  }, [open, status, enabled]);

  // Never carry one account's conversation into another.
  useEffect(() => {
    setMessages([GREETING_MESSAGE]);
    setError('');
    setInput('');
  }, [userId]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy, open]);

  if (!user) return null;

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy || !enabled) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: question }];
    setMessages(next);
    setInput('');
    setError('');
    setBusy(true);
    try {
      const response = await sendChatMessage(next, provider);
      setMessages((m) => [...m, { role: 'assistant', content: response.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const notConfigured = enabled && status !== null && status.providers.length === 0;
  const showSuggestions = enabled && messages.length === 1 && !busy && !notConfigured;
  const inputDisabled = busy || notConfigured || !enabled;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open Spendly AI assistant"
          data-testid="button-ai-open"
          className="fixed bottom-[5.75rem] right-4 z-[55] grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/30 transition hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14"
        >
          <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Spendly AI assistant"
          data-testid="panel-ai"
          className="fixed inset-x-2 bottom-2 z-[70] flex h-[78dvh] max-h-[640px] flex-col overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[580px] sm:w-[400px]"
        >
          <header className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-accent/15 text-accent">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight">Spendly AI</p>
              <p className="truncate text-[11px] text-muted-foreground">Answers only from your own data</p>
            </div>
            {status && status.providers.length > 1 && (
              <select
                value={provider ?? ''}
                onChange={(e) => setProvider(e.target.value as Provider)}
                aria-label="AI model"
                className="rounded-full border border-border bg-background px-2 py-1 text-[11px] font-semibold"
              >
                {status.providers.map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_LABEL[p]}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => {
                setMessages([GREETING_MESSAGE]);
                setError('');
              }}
              aria-label="Clear chat"
              title="Clear chat"
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'rounded-br-md bg-accent text-accent-foreground'
                      : 'rounded-bl-md bg-muted text-foreground'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {showSuggestions && (
              <div className="flex flex-wrap gap-2 pt-1">
                {DEFAULT_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-accent hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking through your expenses…
              </div>
            )}
            {!enabled && (
              <p className="rounded-2xl bg-muted px-3.5 py-2 text-sm text-muted-foreground">
                You're in guest mode. Sign in with your Spendly account to ask questions about your own expenses.
              </p>
            )}
            {notConfigured && (
              <p className="rounded-2xl bg-muted px-3.5 py-2 text-sm text-muted-foreground">
                The AI assistant isn't set up on the server yet. Add a Gemini or Claude API key to enable it.
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-2xl bg-destructive/10 px-3.5 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-border/60 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1000}
              disabled={inputDisabled}
              placeholder="Ask about your spending…"
              aria-label="Your question"
              className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-base outline-none transition focus:border-accent sm:text-sm"
            />
            <button
              type="submit"
              disabled={inputDisabled || !input.trim()}
              aria-label="Send"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground transition enabled:hover:scale-105 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

