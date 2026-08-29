'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase, type Agent, type ChatMessage } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Send, Loader2, Bot, User } from 'lucide-react';

export function ChatApp({ agent }: { agent: Agent }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data } = await supabase.from('chat_messages').select('*').eq('agent_id', agent.id).order('created_at', { ascending: true });
    setMessages((data || []) as ChatMessage[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [agent.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setSending(true);
    const userMsg = input;
    setInput('');

    await supabase.from('chat_messages').insert({
      agent_id: agent.id,
      role: 'user',
      content: userMsg,
    });

    // Simulated agent response (would call Gemini in production)
    const response = `Hello! I'm ${agent.name}. ${agent.personality ? `I'm ${agent.personality}.` : ''} How can I help you with that?`;

    await supabase.from('chat_messages').insert({
      agent_id: agent.id,
      role: 'assistant',
      content: response,
    });

    setSending(false);
    load();
  };

  return (
    <div className="space-y-3 flex flex-col h-full">
      <h3 className="font-semibold flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Chat with {agent.name}</h3>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto scrollbar-hide min-h-[300px] max-h-[400px]">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Bot className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Start a conversation with {agent.name}.</p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-card border border-border/50 rounded-bl-sm'
              }`}>
                {m.content}
              </div>
              {m.role === 'user' && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
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

      <form onSubmit={handleSend} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message ${agent.name}…`}
          disabled={sending}
        />
        <Button type="submit" size="icon" disabled={sending || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
