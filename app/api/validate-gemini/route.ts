/**
 * POST /api/validate-gemini
 *
 * Instant key check for the onboarding Gemini step. The user pastes a key, the
 * browser calls here, and we make ONE tiny paid- quota generation call with the
 * user's own key. A wrong key is told at the paste, not at the first chat.
 *
 * Why not skip the server: a browser-direct call to Google would expose CORS /
 * API-key restrictions as confusing failures. One server hop, one tiny prompt,
 * and the answer is only "does this key work", never the reply content.
 *
 * Abuse note: this route is a free-proxy risk only if it returned real text. It
 * returns a boolean plus Google's own error string, with maxOutputTokens=5.
 * The caller must hold a valid Supabase session and is rate limited per user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGemini } from '@/lib/gemini';
import { checkUserRate, USER_RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
      return NextResponse.json({ error: 'server_supabase_not_configured' }, { status: 500 });
    }

    // Identity + abuse gate: one validation per user per minute is plenty.
    const db = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await db.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'invalid_auth' }, { status: 401 });
    }
    const rate = checkUserRate(userData.user.id);
    if (!rate.ok) {
      return NextResponse.json(
        { error: 'rate_limited', retry_after: rate.retryAfterSec },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec ?? 60) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const key = typeof body?.key === 'string' ? body.key.trim() : '';
    if (!key || key.length < 20) {
      return NextResponse.json({ ok: false, reason: 'invalid_format' });
    }

    const result = await callGemini({
      apiKey: key,
      system: 'You are a key validator. Reply with exactly: ok',
      message: 'ping',
      maxOutputTokens: 5,
    });

    if (result.ok) {
      return NextResponse.json({ ok: true });
    }
    // Return Google's short reason so the UI can say WHY it failed (bad key vs
    // quota vs region) instead of a generic "key tidak valid".
    return NextResponse.json({ ok: false, reason: 'gemini_error', detail: result.error });
  } catch (e: any) {
    console.error('[api/validate-gemini] unhandled error:', e);
    return NextResponse.json(
      { error: 'unhandled', detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
