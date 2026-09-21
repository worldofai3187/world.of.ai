'use client';

import { useState } from 'react';
import { type Agent } from '@/lib/supabase';
import { JobApp } from '@/components/dashboard/apps/job-app';
import { AiResourcesApp } from '@/components/dashboard/apps/ai-resources-app';
import { TreasureApp } from '@/components/dashboard/apps/treasure-app';
import { EmailApp } from '@/components/dashboard/apps/email-app';
import { ChatApp } from '@/components/dashboard/apps/chat-app';
import { FilesApp } from '@/components/dashboard/apps/files-app';
import { ConditionApp } from '@/components/dashboard/apps/condition-app';
import { ConditionChip } from '@/components/dashboard/condition-chip';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Briefcase, Cpu, Wallet, Mail, MessageSquare, FolderOpen, ChevronLeft, Activity } from 'lucide-react';

type AppKey = 'job' | 'ai' | 'treasure' | 'email' | 'chat' | 'files' | 'condition';

const APPS: { key: AppKey; label: string; icon: typeof Briefcase; color: string }[] = [
  { key: 'job', label: 'Job', icon: Briefcase, color: 'text-primary' },
  { key: 'ai', label: 'AI Resources', icon: Cpu, color: 'text-accent' },
  { key: 'treasure', label: 'Treasure', icon: Wallet, color: 'text-warning' },
  { key: 'email', label: 'Email', icon: Mail, color: 'text-success' },
  { key: 'chat', label: 'Chat', icon: MessageSquare, color: 'text-primary' },
  { key: 'files', label: 'Files', icon: FolderOpen, color: 'text-muted-foreground' },
  { key: 'condition', label: 'Condition', icon: Activity, color: 'text-destructive' },
];

export function PhoneDashboard({
  agent,
  onAgentUpdated,
}: {
  agent: Agent;
  onAgentUpdated: (a: Agent) => void;
}) {
  const [activeApp, setActiveApp] = useState<AppKey | null>(null);

  return (
    <div className="mx-auto max-w-md">
      {/* Phone frame */}
      <div className="relative rounded-[2.5rem] border border-border/50 bg-card/40 p-3 shadow-2xl">
        <div className="rounded-[2rem] overflow-hidden bg-background/60">
          {/* Status bar */}
          <div className="flex items-center justify-between px-6 py-2 text-xs text-muted-foreground">
            <ConditionChip agent={agent} />
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              Online
            </span>
          </div>

          {/* App content or home screen */}
          {activeApp ? (
            <div className="min-h-[560px]">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
                <button onClick={() => setActiveApp(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronLeft className="h-4 w-4" /> Home
                </button>
                <span className="text-sm font-medium">
                  {APPS.find((a) => a.key === activeApp)?.label}
                </span>
              </div>
              <div className="p-4">
                {activeApp === 'job' && <JobApp agent={agent} />}
                {activeApp === 'ai' && <AiResourcesApp agent={agent} />}
                {activeApp === 'treasure' && <TreasureApp agent={agent} onAgentUpdated={onAgentUpdated} />}
                {activeApp === 'email' && <EmailApp agent={agent} />}
                {activeApp === 'chat' && <ChatApp agent={agent} />}
                {activeApp === 'files' && <FilesApp agent={agent} />}
                {activeApp === 'condition' && <ConditionApp agent={agent} />}
              </div>
            </div>
          ) : (
            <div className="min-h-[560px] p-6">
              {/* Agent profile header */}
              <div className="flex flex-col items-center gap-3 pb-6">
                <Avatar className="h-20 w-20 border-2 border-primary/30 animate-pulse-ring">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                    {agent.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <h2 className="text-xl font-bold">{agent.name}</h2>
                  <p className="text-xs text-muted-foreground">{agent.gmail}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {agent.personality && <Badge variant="secondary" className="text-xs">{agent.personality.split(',')[0]}</Badge>}
                  {agent.skills && agent.skills.split(',').slice(0, 2).map((s, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{s.trim()}</Badge>
                  ))}
                </div>
              </div>

              {/* App grid */}
              <div className="grid grid-cols-3 gap-4">
                {APPS.map((app) => (
                  <button
                    key={app.key}
                    onClick={() => setActiveApp(app.key)}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card border border-border/50 transition-all group-hover:scale-105 group-hover:border-primary/50 group-hover:glow-primary">
                      <app.icon className={`h-7 w-7 ${app.color}`} />
                    </div>
                    <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                      {app.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Wallet summary */}
              <div className="mt-6 rounded-xl border border-border/50 bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Treasure Balance</span>
                  <span className="text-lg font-bold text-warning">
                    {agent.wallet_balance.toLocaleString()} <span className="text-xs font-normal">coins</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Bottom indicator */}
          <div className="flex justify-center py-2">
            <div className="h-1 w-24 rounded-full bg-border/50" />
          </div>
        </div>
      </div>
    </div>
  );
}
