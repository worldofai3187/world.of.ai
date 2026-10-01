'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StewardChat } from '@/components/auth/steward-chat';
import { Brain, Loader2, MessagesSquare, Shield, Sparkles } from 'lucide-react';

const STEWARD_NAME = (process.env.NEXT_PUBLIC_STEWARD_AGENT_NAME || '').trim();

const L = {
  id: {
    signupDesc: 'Buat akun Wali untuk mulai',
    signinDesc: 'Selamat datang kembali, Wali',
    email: 'Email',
    password: 'Kata sandi',
    signupBtn: 'Buat Akun Wali',
    signinBtn: 'Masuk',
    toSignin: 'Sudah punya akun?',
    toSignup: 'Belum punya akun?',
    signin: 'Masuk',
    signup: 'Daftar',
  },
  en: {
    signupDesc: 'Create your Wali account to begin',
    signinDesc: 'Welcome back, Wali',
    email: 'Email',
    password: 'Password',
    signupBtn: 'Create Wali Account',
    signinBtn: 'Sign In',
    toSignin: 'Already have an account?',
    toSignup: "Don't have an account?",
    signin: 'Sign in',
    signup: 'Sign up',
  },
} as const;

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'steward'>('signup');
  const [lang, setLang] = useState<'id' | 'en'>('id');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const t = L[lang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    if (mode === 'signup') {
      const { error, needsConfirmation } = await signUp(email, password);
      if (error) setError(error);
      else if (needsConfirmation)
        setNotice(`Account created. Supabase sent a confirmation link to ${email}. Open it, then sign in.`);
    } else {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    }
    setLoading(false);
  };

  if (mode === 'steward') {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
        <Card className="relative z-10 w-full max-w-md glass border-border/50 p-4 min-h-[560px]">
          <StewardChat onBack={() => { setMode('signup'); setError(null); setNotice(null); }} />
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
      <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-float" />
      <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-accent/20 blur-3xl animate-float" style={{ animationDelay: '1s' }} />

      <Card className="relative z-10 w-full max-w-md glass border-border/50">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 glow-primary">
            <Brain className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            World of <span className="text-gradient">AI</span>
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {mode === 'signup' ? t.signupDesc : t.signinDesc}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t.email}</Label>
              <Input
                id="email"
                type="email"
                placeholder="wali@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.password}</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
            )}
            {notice && (
              <p className="text-sm text-foreground bg-primary/10 rounded-md px-3 py-2">{notice}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Please wait…</>
              ) : mode === 'signup' ? (
                t.signupBtn
              ) : (
                t.signinBtn
              )}
            </Button>

            {STEWARD_NAME && (
              <>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="h-px flex-1 bg-border/50" />
                  <span>atau / or</span>
                  <div className="h-px flex-1 bg-border/50" />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => { setMode('steward'); setError(null); setNotice(null); }}
                >
                  <MessagesSquare className="h-4 w-4" /> Chat with {STEWARD_NAME}
                </Button>
              </>
            )}
          </form>

          <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Secure</span>
            <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> Multi-Agent</span>
          </div>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === 'signup' ? t.toSignin : t.toSignup}{' '}
            <button
              onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null); setNotice(null); }}
              className="font-medium text-primary hover:underline"
              type="button"
            >
              {mode === 'signup' ? t.signin : t.signup}
            </button>
          </p>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            <button
              onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
              className="font-medium hover:text-foreground"
              type="button"
            >
              {lang === 'id' ? 'Bahasa Indonesia / English' : 'English / Bahasa Indonesia'}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
