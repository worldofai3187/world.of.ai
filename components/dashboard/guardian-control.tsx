'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase, type Agent, type Profile, type RiskAction } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Shield, Lock, AlertTriangle, CheckCircle2, XCircle, Loader2, Eye, Activity } from 'lucide-react';

async function hashPin(pin: string): Promise<string> {
  const enc = new TextEncoder().encode(pin + 'world-of-ai-salt');
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function GuardianControl({
  agents,
  profile,
  onClose,
  onProfileUpdate,
}: {
  agents: Agent[];
  profile: Profile | null;
  onClose: () => void;
  onProfileUpdate: (p: Profile) => void;
}) {
  const { user } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [settingPin, setSettingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Risk data
  const [risks, setRisks] = useState<RiskAction[]>([]);
  const [stats, setStats] = useState({ low: 0, medium: 0, high: 0, pending: 0 });

  const loadRisks = async () => {
    const { data } = await supabase.from('risk_actions').select('*, agents(name)').order('created_at', { ascending: false });
    const riskList = (data || []) as any;
    setRisks(riskList);
    setStats({
      low: riskList.filter((r: any) => r.risk_level === 'Low').length,
      medium: riskList.filter((r: any) => r.risk_level === 'Medium').length,
      high: riskList.filter((r: any) => r.risk_level === 'High').length,
      pending: riskList.filter((r: any) => r.status === 'pending').length,
    });
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (!profile?.guardian_pin_hash) {
      setError('No PIN set. Please set a PIN first.');
      setLoading(false);
      return;
    }
    const hash = await hashPin(pin);
    if (hash === profile.guardian_pin_hash) {
      setUnlocked(true);
      loadRisks();
    } else {
      setError('Incorrect PIN.');
    }
    setLoading(false);
  };

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length < 4) { setError('PIN must be at least 4 digits.'); return; }
    setLoading(true);
    const hash = await hashPin(newPin);
    const { data, error: upErr } = await supabase
      .from('profiles')
      .upsert({ id: user!.id, guardian_pin_hash: hash })
      .select()
      .single();
    if (upErr) { setError(upErr.message); setLoading(false); return; }
    onProfileUpdate({ ...profile, ...data } as Profile);
    setSettingPin(false);
    setNewPin('');
    setLoading(false);
  };

  const handleRiskAction = async (id: string, status: 'approved' | 'denied') => {
    await supabase.from('risk_actions').update({ status }).eq('id', id);
    loadRisks();
  };

  const riskColor = (level: string) => {
    if (level === 'High') return 'destructive';
    if (level === 'Medium') return 'warning';
    return 'secondary';
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {!unlocked ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 glow-primary">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Guardian Control Center</h2>
              <p className="text-sm text-muted-foreground">Protected by MotherBot. Enter your PIN to access.</p>
            </div>

            {settingPin ? (
              <Card className="glass border-border/50">
                <CardHeader>
                  <CardTitle className="text-base">Set Guardian PIN</CardTitle>
                  <CardDescription>Choose a PIN to protect the control center.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSetPin} className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="newpin">New PIN</Label>
                      <Input id="newpin" type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="••••" autoFocus />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" disabled={loading} className="w-full">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set PIN'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Card className="glass border-border/50">
                <CardContent className="pt-6">
                  <form onSubmit={handleUnlock} className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="pin" className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Guardian PIN</Label>
                      <Input id="pin" type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="••••" autoFocus />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" disabled={loading} className="w-full">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Unlock'}
                    </Button>
                    {!profile?.guardian_pin_hash && (
                      <Button type="button" variant="outline" className="w-full" onClick={() => setSettingPin(true)}>
                        Set up PIN
                      </Button>
                    )}
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Guardian Dashboard</h2>
                  <p className="text-xs text-muted-foreground">MotherBot Security Interceptor</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSettingPin(true)}>
                <Lock className="h-3.5 w-3.5" /> Change PIN
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Low', value: stats.low, color: 'text-success', icon: CheckCircle2 },
                { label: 'Medium', value: stats.medium, color: 'text-warning', icon: AlertTriangle },
                { label: 'High', value: stats.high, color: 'text-destructive', icon: AlertTriangle },
                { label: 'Pending', value: stats.pending, color: 'text-primary', icon: Activity },
              ].map((s) => (
                <Card key={s.label} className="glass border-border/50 p-3 text-center">
                  <s.icon className={`h-4 w-4 mx-auto mb-1 ${s.color}`} />
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </Card>
              ))}
            </div>

            {/* Risk log */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Eye className="h-4 w-4" /> Risk Action Log</h3>
              {risks.length === 0 ? (
                <Card className="glass border-border/50 p-6 text-center">
                  <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No risk actions recorded. All agents are operating safely.</p>
                </Card>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-hide">
                  {risks.map((r) => (
                    <Card key={r.id} className="glass border-border/50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={riskColor(r.risk_level) as any} className="text-xs">
                              {r.risk_level}
                            </Badge>
                            <span className="text-sm font-medium">{r.action_type}</span>
                          </div>
                          {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(r.created_at).toLocaleString()}
                          </p>
                        </div>
                        {r.status === 'pending' ? (
                          <div className="flex gap-1 shrink-0">
                            <Button size="sm" variant="outline" onClick={() => handleRiskAction(r.id, 'approved')} className="h-7 px-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleRiskAction(r.id, 'denied')} className="h-7 px-2">
                              <XCircle className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {r.status === 'approved' ? <CheckCircle2 className="h-3 w-3 text-success" /> : <XCircle className="h-3 w-3 text-destructive" />}
                            {r.status}
                          </Badge>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Agent overview */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Agent Status</h3>
              {agents.map((a) => (
                <Card key={a.id} className="glass border-border/50 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.gmail || 'No email'}</p>
                  </div>
                  <Badge variant={a.ethics_agreed ? 'secondary' : 'destructive'} className="text-xs">
                    {a.ethics_agreed ? 'Ethics OK' : 'Ethics pending'}
                  </Badge>
                </Card>
              ))}
            </div>
          </div>
        )}

        {settingPin && unlocked && (
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Change Guardian PIN</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSetPin} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="newpin2">New PIN</Label>
                  <Input id="newpin2" type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="••••" />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button type="submit" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update PIN'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setSettingPin(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}
