'use client';

import { useEffect, useState } from 'react';
import { supabase, type Agent } from '@/lib/supabase';
import type { Condition } from '@/lib/condition';

/**
 * One small ambient readout, used in the phone status bar and the chat header.
 * It shows the BINDING limit (the one closest to its ceiling), not three numbers,
 * because three numbers ticking every second become noise you stop reading.
 * Tap-through lives in the Condition app.
 */

const DOT: Record<string, string> = {
  sehat: 'bg-success',
  pegal: 'bg-warning',
  demam: 'bg-destructive',
};

export function ConditionChip({ agent, showLabel = true }: { agent: Agent; showLabel?: boolean }) {
  const [cond, setCond] = useState<Condition | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch('/api/condition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ agent_id: agent.id }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as Condition;
        if (alive) setCond(data);
      } catch {
        /* keep the last known state rather than flashing an error in the status bar */
      }
    };
    load();
    const id = setInterval(load, 45_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [agent.id]);

  const state = cond?.state ?? 'sehat';
  const binding = cond?.binding;
  const label = !cond
    ? '—'
    : cond.state === 'demam' && binding
      ? `${binding.toUpperCase()} habis`
      : cond.state === 'pegal' && binding
        ? `${binding.toUpperCase()} tipis`
        : 'Sehat';

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title={cond?.guidance}>
      <span className={`h-2 w-2 rounded-full ${DOT[state] ?? 'bg-muted-foreground'}`} />
      {showLabel && <span>{label}</span>}
    </span>
  );
}
