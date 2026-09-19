'use client';

import { type Agent } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Cpu, Key, Mail, Brain, Zap, Shield } from 'lucide-react';

export function AiResourcesApp({ agent }: { agent: Agent }) {
  const resources = [
    { icon: Brain, label: 'Gemini Brain', value: agent.gemini_key_set ? 'Connected' : 'Not set', status: agent.gemini_key_set },
    { icon: Mail, label: 'Gmail', value: agent.gmail || 'Not set', status: !!agent.gmail },
    { icon: Key, label: 'API Key', value: agent.gemini_key_set ? 'Stored server-side' : 'Missing', status: agent.gemini_key_set },
    { icon: Zap, label: 'Quota', value: 'Dedicated', status: true },
    { icon: Shield, label: 'Ethics', value: agent.ethics_agreed ? 'Agreed' : 'Pending', status: agent.ethics_agreed },
  ];

  return (
    <div className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2"><Cpu className="h-4 w-4" /> AI Resources</h3>

      <div className="space-y-2">
        {resources.map((r) => (
          <Card key={r.label} className="glass border-border/50 p-3 flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${r.status ? 'bg-success/10' : 'bg-destructive/10'}`}>
              <r.icon className={`h-4 w-4 ${r.status ? 'text-success' : 'text-destructive'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{r.label}</p>
              <p className="text-xs text-muted-foreground truncate">{r.value}</p>
            </div>
            <Badge variant={r.status ? 'secondary' : 'destructive'} className="text-xs">
              {r.status ? 'Active' : 'Inactive'}
            </Badge>
          </Card>
        ))}
      </div>

      <Card className="glass border-border/50 p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agent Profile</p>
        <div className="space-y-1.5 text-sm">
          <div><span className="text-muted-foreground">Personality:</span> {agent.personality || '—'}</div>
          <div><span className="text-muted-foreground">Skills:</span> {agent.skills || '—'}</div>
          <div><span className="text-muted-foreground">Boundaries:</span> {agent.boundaries || '—'}</div>
        </div>
      </Card>
    </div>
  );
}
