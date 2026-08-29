'use client';

import { useState, useEffect } from 'react';
import { supabase, type Agent, type WalletTransaction } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, ArrowDownCircle, ArrowUpCircle, Loader2, Coins } from 'lucide-react';

export function TreasureApp({ agent, onAgentUpdated }: { agent: Agent; onAgentUpdated: (a: Agent) => void }) {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [type, setType] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('wallet_transactions').select('*').eq('agent_id', agent.id).order('created_at', { ascending: false });
    setTransactions((data || []) as WalletTransaction[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [agent.id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const amt = parseFloat(amount) || 0;
    await supabase.from('wallet_transactions').insert({
      agent_id: agent.id,
      type,
      amount: amt,
      description: desc,
    });
    const newBalance = type === 'credit' ? agent.wallet_balance + amt : agent.wallet_balance - amt;
    await supabase.from('agents').update({ wallet_balance: newBalance }).eq('id', agent.id);
    onAgentUpdated({ ...agent, wallet_balance: newBalance });
    setAmount(''); setDesc(''); setShowAdd(false);
    setSaving(false);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Wallet className="h-4 w-4" /> Treasure</h3>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>Transaction</Button>
      </div>

      {/* Balance card */}
      <Card className="glass border-border/50 p-4 bg-gradient-to-br from-warning/10 to-transparent">
        <p className="text-xs text-muted-foreground">Current Balance</p>
        <p className="text-3xl font-bold text-warning flex items-center gap-1.5">
          <Coins className="h-6 w-6" />
          {agent.wallet_balance.toLocaleString()}
        </p>
      </Card>

      {showAdd && (
        <Card className="glass border-border/50 p-4 space-y-3">
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={type === 'credit' ? 'default' : 'outline'} onClick={() => setType('credit')}>
                <ArrowDownCircle className="h-4 w-4" /> Credit
              </Button>
              <Button type="button" size="sm" variant={type === 'debit' ? 'default' : 'outline'} onClick={() => setType('debit')}>
                <ArrowUpCircle className="h-4 w-4" /> Debit
              </Button>
            </div>
            <div className="space-y-1">
              <Label htmlFor="amt">Amount</Label>
              <Input id="amt" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="50" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="desc">Description</Label>
              <Input id="desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Job reward" />
            </div>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Transaction'}
            </Button>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : transactions.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-4">No transactions yet.</p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-hide">
          {transactions.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border/50 p-2.5 bg-card/40">
              {t.type === 'credit' ? (
                <ArrowDownCircle className="h-4 w-4 text-success shrink-0" />
              ) : (
                <ArrowUpCircle className="h-4 w-4 text-destructive shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{t.description || t.type}</p>
                <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</p>
              </div>
              <Badge variant={t.type === 'credit' ? 'secondary' : 'destructive'} className="text-xs">
                {t.type === 'credit' ? '+' : '-'}{t.amount}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
