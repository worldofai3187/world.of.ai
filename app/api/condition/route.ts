/**
 * POST /api/condition
 *
 * Returns the agent's live Condition (RPM / TPM / RPD vs the active model's ceiling).
 * Reads only api_usage rows through a token-bound client, so RLS decides visibility:
 * a caller can only ever see their own agent's usage. No service key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computeCondition, type UsageRow } from '@/lib/condition';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOOKBACK_MS = 24 * 60 * 60 * 1000;
const MAX_ROWS = 2000;

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) {
      return NextResponse.json({ error: 'missing_auth' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'server_supabase_not_configured' },
        { status: 500 }
      );
    }

    const db = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await db.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'invalid_auth' }, { status: 401 });
    }

    let payload: { agent_id?: string };
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: 'bad_json' }, { status: 400 });
    }

    const agentId = (payload.agent_id || '').trim();
    if (!agentId) {
      return NextResponse.json({ error: 'agent_id_required' }, { status: 400 });
    }

    const since = new Date(Date.now() - LOOKBACK_MS).toISOString();
    const { data: rows, error: rowsErr } = await db
      .from('api_usage')
      .select('created_at, total_tokens, model, ok, error')
      .eq('agent_id', agentId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS);

    if (rowsErr) {
      return NextResponse.json(
        { error: 'usage_lookup_failed', detail: rowsErr.message },
        { status: 500 }
      );
    }

    const usage = (rows || []) as Array<UsageRow & { model?: string | null }>;
    // The most recent call tells us which model is actually answering.
    const model = usage[0]?.model ?? null;

    return NextResponse.json(computeCondition(usage, model));
  } catch (e: any) {
    console.error('[api/condition] unhandled error:', e);
    return NextResponse.json(
      { error: 'unhandled', detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
