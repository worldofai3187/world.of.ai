'use client';

import { useState, useEffect } from 'react';
import { supabase, type Agent, type Email } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Plus, Loader2, Inbox, Send } from 'lucide-react';

export function EmailApp({ agent }: { agent: Agent }) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('emails').select('*').eq('agent_id', agent.id).order('created_at', { ascending: false });
    setEmails((data || []) as Email[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [agent.id]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await supabase.from('emails').insert({
      agent_id: agent.id,
      sender: agent.gmail || 'agent@world-of-ai',
      recipient,
      subject,
      body_preview: body.slice(0, 200),
      status: 'sent',
    });
    setRecipient(''); setSubject(''); setBody('');
    setShowCompose(false);
    setSaving(false);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Mail className="h-4 w-4" /> Email</h3>
        <Button size="sm" variant="outline" onClick={() => setShowCompose(!showCompose)}>
          <Plus className="h-4 w-4" /> Compose
        </Button>
      </div>

      {showCompose && (
        <Card className="glass border-border/50 p-4 space-y-3">
          <form onSubmit={handleSend} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="to">To</Label>
              <Input id="to" type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} required placeholder="recipient@example.com" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="subj">Subject</Label>
              <Input id="subj" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Hello" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bod">Message</Label>
              <Textarea id="bod" value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Your message…" />
            </div>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Send</>}
            </Button>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : emails.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Inbox is empty.</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-hide">
          {emails.map((em) => (
            <Card key={em.id} className="glass border-border/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{em.subject || '(no subject)'}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {em.status === 'sent' ? `To: ${em.recipient}` : `From: ${em.sender}`}
                  </p>
                  {em.body_preview && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{em.body_preview}</p>}
                </div>
                <Badge variant={em.status === 'sent' ? 'secondary' : 'outline'} className="text-xs shrink-0">
                  {em.status === 'sent' ? <Send className="h-3 w-3" /> : <Inbox className="h-3 w-3" />}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
