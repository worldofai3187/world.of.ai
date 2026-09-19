'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase, AGENT_PUBLIC_COLUMNS, type Agent } from '@/lib/supabase';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bot, Plus, Check } from 'lucide-react';

export function AgentSwitcher({
  agents,
  activeAgent,
  onSelect,
  onAdd,
}: {
  agents: Agent[];
  activeAgent: Agent | null;
  onSelect: (a: Agent) => void;
  onAdd: (a: Agent) => void;
}) {
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);

  return (
    <Card className="glass border-border/50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Agents</h3>
        <Badge variant="secondary">{agents.length}</Badge>
      </div>

      <div className="space-y-2">
        {agents.map((a) => (
          <button
            key={a.id}
            onClick={() => onSelect(a)}
            className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all hover:bg-muted/50 ${
              activeAgent?.id === a.id
                ? 'border-primary bg-primary/5 glow-primary'
                : 'border-border/50'
            }`}
          >
            <Avatar className="h-9 w-9 border border-border/50">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {a.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.name}</p>
              <p className="truncate text-xs text-muted-foreground">{a.gmail || 'No email'}</p>
            </div>
            {activeAgent?.id === a.id && <Check className="h-4 w-4 text-primary shrink-0" />}
          </button>
        ))}
      </div>

      <Button
        variant="outline"
        className="w-full border-dashed"
        onClick={() => setAdding(true)}
      >
        <Plus className="h-4 w-4" /> Add Agent
      </Button>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" /> New Agent Onboarding
            </DialogTitle>
          </DialogHeader>
          <OnboardingFlow onComplete={() => {
            setAdding(false);
            // Reload agents
            (async () => {
              const { data } = await supabase.from('agents').select(AGENT_PUBLIC_COLUMNS).order('created_at', { ascending: true });
              const list = (data || []) as Agent[];
              if (list.length > 0) {
                const newest = list[list.length - 1];
                onAdd(newest);
              }
            })();
          }} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
