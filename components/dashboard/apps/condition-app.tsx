'use client';

import { useEffect, useState } from 'react';
import { supabase, type Agent } from '@/lib/supabase';
import type { Condition } from '@/lib/condition';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, Loader2, RefreshCw, Moon, Shuffle } from 'lucide-react';

const STATE_BADGE: Record<string, string> = {
  sehat: 'border-success/30 bg-success/15 text-success',
  pegal: 'border-warning/30 bg-warning/15 text-warning',
  demam: 'border-destructive/30 bg-destructive/15 text-destructive',
};

function Bar({
  label,
  used,
  cap,
  pct,
  suffix,
}: {
  label: string;
  used: number;
  cap: number | null;
  pct: number | null;
  suffix?: string;
}) {
  const width = pct === null ? 0 : Math.round(pct * 100);
  const color =
    pct === null
      ? 'bg-muted-foreground/40'
      : pct >= 1
        ? 'bg-destructive'
        : pct >= 0.7
          ? 'bg-warning'
          : 'bg-success';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {used.toLocaleString()}
          {cap === null ? '' : ` / ${cap.toLocaleString()}`}
          {suffix ? ` ${suffix}` : ''}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color} transition-all`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function ConditionApp({ agent }: { agent: Agent }) {
  const [cond, setCond] = useState<Condition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sesi habis. Login ulang.');

      const res = await fetch('/api/condition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ agent_id: agent.id }),
      });

      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }
      if (!res.ok) throw new Error(data?.detail || data?.error || `HTTP ${res.status}`);
      setCond(data as Condition);
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat kondisi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 45_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <Activity className="h-4 w-4" /> Condition
        </h3>
        <Button variant="ghost" size="icon" onClick={load} disabled={loading} aria-label="Refresh">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : !cond ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/30 p-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Model aktif</p>
              <p className="truncate text-sm font-medium">{cond.model || 'belum ada panggilan'}</p>
            </div>
            <Badge variant="outline" className={STATE_BADGE[cond.state]}>
              {cond.label}
            </Badge>
          </div>

          <div className="space-y-3 rounded-xl border border-border/50 p-4">
            <Bar label={`RPM · ${cond.windowSeconds}s`} used={cond.rpm} cap={cond.limits?.rpm ?? null} pct={cond.rpmPct} />
            <Bar label={`TPM · ${cond.windowSeconds}s`} used={cond.tpm} cap={cond.limits?.tpm ?? null} pct={cond.tpmPct} />
            <Bar label="RPD · 24 jam" used={cond.rpd} cap={cond.limits?.rpd ?? null} pct={cond.rpdPct} />
          </div>

          {cond.state === 'demam' && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3">
              <p className="text-sm font-semibold text-destructive">{cond.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{cond.guidance}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" disabled title="Fase berikutnya">
                  <Shuffle className="h-3.5 w-3.5" /> Ganti model
                </Button>
                <Button variant="outline" size="sm" disabled title="Fase berikutnya">
                  <Moon className="h-3.5 w-3.5" /> Mode istirahat
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Dua tombol itu fase berikutnya. Sekarang keputusannya manual.
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">{cond.guidance}</p>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Kuota dihitung per project (API key), bukan per agent. Nambah model = ganti plafon, bukan kolam tanpa batas.
          </p>
        </>
      )}
    </div>
  );
}
