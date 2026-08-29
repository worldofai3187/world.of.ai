'use client';

import { useState, useEffect } from 'react';
import { supabase, type Agent, type Job } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Briefcase, Plus, Loader2, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string }> = {
  pending: { icon: Clock, color: 'text-warning' },
  in_progress: { icon: AlertCircle, color: 'text-primary' },
  completed: { icon: CheckCircle2, color: 'text-success' },
};

export function JobApp({ agent }: { agent: Agent }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('jobs').select('*').eq('agent_id', agent.id).order('created_at', { ascending: false });
    setJobs((data || []) as Job[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [agent.id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await supabase.from('jobs').insert({
      agent_id: agent.id,
      title,
      description,
      reward: parseFloat(reward) || 0,
    });
    setTitle(''); setDescription(''); setReward('');
    setShowAdd(false);
    setSaving(false);
    load();
  };

  const cycleStatus = async (job: Job) => {
    const order = ['pending', 'in_progress', 'completed'];
    const next = order[(order.indexOf(job.status) + 1) % order.length];
    await supabase.from('jobs').update({ status: next }).eq('id', job.id);
    load();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Briefcase className="h-4 w-4" /> Jobs</h3>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4" /> New
        </Button>
      </div>

      {showAdd && (
        <Card className="glass border-border/50 p-4 space-y-3">
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="job-title">Title</Label>
              <Input id="job-title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Research market trends" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="job-desc">Description</Label>
              <Textarea id="job-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What should the agent do?" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="job-reward">Reward (coins)</Label>
              <Input id="job-reward" type="number" value={reward} onChange={(e) => setReward(e.target.value)} placeholder="50" />
            </div>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Assign Job'}
            </Button>
          </form>
        </Card>
      )}

      {jobs.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No jobs yet. Assign one to get started.</p>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => {
            const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
            return (
              <Card key={job.id} className="glass border-border/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{job.title}</p>
                    {job.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{job.description}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => cycleStatus(job)} className="flex items-center gap-1">
                        <Badge variant="secondary" className={`cursor-pointer hover:opacity-80 ${cfg.color}`}>
                          <cfg.icon className="h-3 w-3" /> {job.status.replace('_', ' ')}
                        </Badge>
                      </button>
                      {job.reward > 0 && <Badge variant="outline" className="text-warning">{job.reward} coins</Badge>}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
