'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Send, Loader2 } from 'lucide-react';

type Turn = { role: 'user' | 'assistant'; text: string };

const STEWARD_NAME =
  (process.env.NEXT_PUBLIC_STEWARD_AGENT_NAME || '').trim() || 'Steward';

/**
 * Public trial chat: no account, no Supabase. The browser keeps the session's
 * turns and sends them as history; the server answers on the shared server key,
 * capped at 10 chats per IP per UTC day.
 */
export function StewardChat({ onBack }: { onBack?: () => void }) {
  const [messages, setMessages] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const userMsg = input.trim();
    if (!userMsg || sending) return;
    setSending(true);
    setError(null);
    setInput('');

    const history: Turn[] = [...messages, { role: 'user' as const, text: userMsg }];
    setMessages(history);
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });

    try {
      const res = await fetch('/api/steward-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          history: messages.slice(-20),
        }),
      });
      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        throw new Error(
          data?.error === 'trial_limit_reached'
            ? `Trial mode for the day is used up (${data?.daily_limit || 10} chats). Create a free account to keep chatting.`
            : (data?.detail || data?.error || `HTTP ${res.status}`)
        );
      }
      setMessages([...history, { role: 'assistant', text: String(data.reply || '') }]);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setSending(false);
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      });
    }
  };

  return (
    <div className="space-y-3 flex flex-col h-full">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold flex items-center gap-2">
          <Bot className="h-4 w-4" /> Chat with {STEWARD_NAME}
        </h3>
        {onBack && (
          <button
            onClick={onBack}
            className="text-xs text-muted-foreground hover:text-foreground"
            type="button"
          >
            ← Back
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Trial mode — no account needed. {STEWARD_NAME} is new and still learning: no code execution, no web search yet. 10 chats per day.
      </p>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto scrollbar-slim min-h-[280px] max-h-[60vh]"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Bot className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Say hi to {STEWARD_NAME} — no account, no setup.
            </p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-card border border-border/50 rounded-bl-sm'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex gap-2 justify-start">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="rounded-2xl bg-card border border-border/50 px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <form onSubmit={handleSend} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message ${STEWARD_NAME}…`}
          disabled={sending}
          maxLength={2000}
        />
        <Button type="submit" size="icon" disabled={sending || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
