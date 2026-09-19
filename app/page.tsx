'use client';

import { useAuth } from '@/lib/auth-context';

import { AuthScreen } from '@/components/auth/auth-screen';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { Dashboard } from '@/components/dashboard/dashboard';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading World of AI…</p>
        </div>
      </div>
    );
  }

  if (!session) return <AuthScreen />;
  return <Dashboard />;
}
