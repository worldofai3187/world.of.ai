'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase, type Agent, type Profile } from '@/lib/supabase';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { AgentSwitcher } from '@/components/dashboard/agent-switcher';
import { PhoneDashboard } from '@/components/dashboard/phone-dashboard';
import { GuardianControl } from '@/components/dashboard/guardian-control';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Shield, LogOut, Menu } from 'lucide-react';

export function Dashboard() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [showGuardian, setShowGuardian] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    const [{ data: prof }, { data: ags }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('agents').select('*').order('created_at', { ascending: true }),
    ]);
    const profData = prof as Profile | null;
    setProfile(profData);
    const agentList = (ags || []) as Agent[];
    setAgents(agentList);
    if (agentList.length > 0) {
      setActiveAgent(agentList[0]);
      setNeedsOnboarding(false);
    } else {
      setNeedsOnboarding(true);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAgentAdded = (agent: Agent) => {
    setAgents((prev) => [...prev, agent]);
    setActiveAgent(agent);
    setNeedsOnboarding(false);
  };

  const handleAgentUpdated = (updated: Agent) => {
    setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setActiveAgent(updated);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading your agents…</p>
      </div>
    );
  }

  if (needsOnboarding) {
    return <OnboardingFlow onComplete={loadData} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/50 glass">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <AgentSwitcher
                  agents={agents}
                  activeAgent={activeAgent}
                  onSelect={setActiveAgent}
                  onAdd={handleAgentAdded}
                />
              </SheetContent>
            </Sheet>
            <h1 className="text-lg font-bold tracking-tight">
              World of <span className="text-gradient">AI</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowGuardian(true)}>
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Guardian</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        {/* Sidebar - desktop */}
        <aside className="hidden md:block w-72 shrink-0">
          <div className="sticky top-20">
            <AgentSwitcher
              agents={agents}
              activeAgent={activeAgent}
              onSelect={setActiveAgent}
              onAdd={handleAgentAdded}
            />
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          {activeAgent && (
            <PhoneDashboard
              agent={activeAgent}
              onAgentUpdated={handleAgentUpdated}
            />
          )}
        </main>
      </div>

      {showGuardian && (
        <GuardianControl
          agents={agents}
          profile={profile}
          onClose={() => setShowGuardian(false)}
          onProfileUpdate={setProfile}
        />
      )}
    </div>
  );
}
