'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase, AGENT_PUBLIC_COLUMNS, type Agent, type Profile } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Database, Mail, Key, Sparkles, User, Heart, ThumbsDown, Wrench, ShieldAlert, ScrollText, Check, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';

type Step = 'supabase' | 'gmail' | 'gemini' | 'ritual' | 'done';
const STEP_ORDER: Step[] = ['supabase', 'gmail', 'gemini', 'ritual'];

export function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const [stepIdx, setStepIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shared state across steps
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [gmail, setGmail] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [agentName, setAgentName] = useState('');
  const [personality, setPersonality] = useState('');
  const [likes, setLikes] = useState('');
  const [dislikes, setDislikes] = useState('');
  const [skills, setSkills] = useState('');
  const [boundaries, setBoundaries] = useState('');
  const [ethicsAgreed, setEthicsAgreed] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (data) {
        setProfile(data as Profile);
        setSupabaseUrl(data.supabase_url || '');
        setSupabaseAnonKey(data.supabase_anon_key || '');
      }
    })();
  }, [user]);

  const step = STEP_ORDER[stepIdx];
  const progress = ((stepIdx + 1) / STEP_ORDER.length) * 100;

  const saveProfile = async (updates: Partial<Profile>) => {
    if (!user) return;
    const { error: upErr } = await supabase
      .from('profiles')
      .upsert({ id: user.id, ...updates });
    if (upErr) throw upErr;
  };

  const handleNext = async () => {
    setError(null);
    setLoading(true);
    try {
      if (step === 'supabase') {
        if (!supabaseUrl || !supabaseAnonKey) throw new Error('Both fields are required.');
        await saveProfile({ supabase_url: supabaseUrl, supabase_anon_key: supabaseAnonKey });
      } else if (step === 'gmail') {
        if (!gmail || !gmail.includes('@')) throw new Error('Enter a valid Gmail address.');
      } else if (step === 'gemini') {
        if (!geminiKey || geminiKey.length < 10) throw new Error('Enter a valid Gemini API key.');
      } else if (step === 'ritual') {
        if (!agentName.trim()) throw new Error('Give your agent a name.');
        if (!ethicsAgreed) throw new Error('You must accept the Ethics Contract.');
        // Create the agent
        const { data: agent, error: agentErr } = await supabase
          .from('agents')
          .insert({
            user_id: user!.id,
            name: agentName,
            personality,
            likes,
            dislikes,
            skills,
            boundaries,
            ethics_agreed: ethicsAgreed,
            gmail,
            gemini_api_key: geminiKey,
            onboarding_complete: true,
          })
          .select(AGENT_PUBLIC_COLUMNS)
          .single();
        if (agentErr) throw agentErr;
        // Seed a welcome wallet transaction
        await supabase.from('wallet_transactions').insert({
          agent_id: (agent as Agent).id,
          type: 'credit',
          amount: 100,
          description: 'Welcome treasure bonus',
        });
        await supabase.from('agents').update({ wallet_balance: 100 }).eq('id', (agent as Agent).id);
      }
      if (stepIdx < STEP_ORDER.length - 1) {
        setStepIdx(stepIdx + 1);
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setError(null);
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      <div className="relative z-10 w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Agent Onboarding</h2>
          <p className="text-sm text-muted-foreground">Step {stepIdx + 1} of {STEP_ORDER.length}</p>
          <Progress value={progress} className="h-2" />
        </div>

        {step === 'supabase' && (
          <Card className="glass border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Database className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Supabase Setup</CardTitle>
                  <CardDescription>Link your database house</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sb-url">SUPABASE_URL</Label>
                <Input id="sb-url" placeholder="https://xxxx.supabase.co" value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sb-key">SUPABASE_ANON_KEY</Label>
                <Input id="sb-key" placeholder="eyJhbGci…" value={supabaseAnonKey} onChange={(e) => setSupabaseAnonKey(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'gmail' && (
          <Card className="glass border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Agent Gmail</CardTitle>
                  <CardDescription>Dedicated email for this agent</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gmail">Gmail Address</Label>
                <Input id="gmail" type="email" placeholder="agent@gmail.com" value={gmail} onChange={(e) => setGmail(e.target.value)} />
                <p className="text-xs text-muted-foreground">Each agent needs its own isolated Gmail.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'gemini' && (
          <Card className="glass border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Key className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Agent Gemini API</CardTitle>
                  <CardDescription>The brain for this agent</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gemini">GEMINI_API_KEY</Label>
                <Input id="gemini" type="password" placeholder="AIza…" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} />
                <p className="text-xs text-muted-foreground">Each agent uses its own dedicated Gemini quota.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'ritual' && (
          <RitualWizard
            agentName={agentName} setAgentName={setAgentName}
            personality={personality} setPersonality={setPersonality}
            likes={likes} setLikes={setLikes}
            dislikes={dislikes} setDislikes={setDislikes}
            skills={skills} setSkills={setSkills}
            boundaries={boundaries} setBoundaries={setBoundaries}
            ethicsAgreed={ethicsAgreed} setEthicsAgreed={setEthicsAgreed}
          />
        )}

        {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}

        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={handleBack} disabled={stepIdx === 0 || loading}>
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          <Button onClick={handleNext} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : stepIdx === STEP_ORDER.length - 1 ? (
              <><Sparkles className="h-4 w-4" /> Create Agent</>
            ) : (
              <>Continue <ChevronRight className="h-4 w-4" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RitualWizard(props: {
  agentName: string; setAgentName: (v: string) => void;
  personality: string; setPersonality: (v: string) => void;
  likes: string; setLikes: (v: string) => void;
  dislikes: string; setDislikes: (v: string) => void;
  skills: string; setSkills: (v: string) => void;
  boundaries: string; setBoundaries: (v: string) => void;
  ethicsAgreed: boolean; setEthicsAgreed: (v: boolean) => void;
}) {
  const questions = [
    { icon: User, label: 'Agent Name', key: 'agentName', placeholder: 'Valco, Aldric…', value: props.agentName, set: props.setAgentName, type: 'input' },
    { icon: Sparkles, label: 'Personality', key: 'personality', placeholder: 'Calm, curious, methodical…', value: props.personality, set: props.setPersonality, type: 'textarea' },
    { icon: Heart, label: 'Likes', key: 'likes', placeholder: 'Solving puzzles, helping people…', value: props.likes, set: props.setLikes, type: 'textarea' },
    { icon: ThumbsDown, label: 'Dislikes', key: 'dislikes', placeholder: 'Rudeness, incomplete data…', value: props.dislikes, set: props.setDislikes, type: 'textarea' },
    { icon: Wrench, label: 'Skills', key: 'skills', placeholder: 'Web search, code review, writing…', value: props.skills, set: props.setSkills, type: 'textarea' },
    { icon: ShieldAlert, label: 'Boundaries', key: 'boundaries', placeholder: 'No financial advice, no harmful content…', value: props.boundaries, set: props.setBoundaries, type: 'textarea' },
  ] as const;

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <ScrollText className="h-5 w-5 text-accent" />
          </div>
          <div>
            <CardTitle>Matrix Keeper Ritual</CardTitle>
            <CardDescription>7 questions to shape your agent</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {questions.map((q) => (
          <div key={q.key} className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <q.icon className="h-4 w-4 text-muted-foreground" />
              {q.label}
            </Label>
            {q.type === 'input' ? (
              <Input placeholder={q.placeholder} value={q.value as string} onChange={(e) => (q.set as any)(e.target.value)} />
            ) : (
              <Textarea placeholder={q.placeholder} value={q.value as string} onChange={(e) => (q.set as any)(e.target.value)} rows={2} />
            )}
          </div>
        ))}
        <div className="space-y-2 rounded-lg border border-border/50 p-4 bg-muted/30">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <ScrollText className="h-4 w-4 text-accent" /> Ethics Contract
          </Label>
          <p className="text-xs text-muted-foreground leading-relaxed">
            I agree that this agent will operate ethically, respect human autonomy, protect user privacy,
            refuse harmful requests, and always act in the best interest of its Wali and the people it serves.
          </p>
          <div className="flex items-center space-x-2 pt-1">
            <Checkbox id="ethics" checked={props.ethicsAgreed} onCheckedChange={(v) => props.setEthicsAgreed(v === true)} />
            <label htmlFor="ethics" className="text-sm flex items-center gap-1 cursor-pointer">
              {props.ethicsAgreed && <Check className="h-4 w-4 text-success" />}
              I accept the Ethics Contract
            </label>
          </div>
        </div>
        <Badge variant="secondary" className="w-full justify-center py-1.5">
          {props.ethicsAgreed ? 'Contract accepted' : 'Accept the contract to continue'}
        </Badge>
      </CardContent>
    </Card>
  );
}
