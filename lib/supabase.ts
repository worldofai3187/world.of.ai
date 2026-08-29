import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Agent = {
  id: string;
  user_id: string;
  name: string;
  personality: string | null;
  likes: string | null;
  dislikes: string | null;
  skills: string | null;
  boundaries: string | null;
  ethics_agreed: boolean;
  gmail: string | null;
  gemini_api_key: string | null;
  wallet_balance: number;
  onboarding_complete: boolean;
  created_at: string;
};

export type Profile = {
  id: string;
  display_name: string | null;
  guardian_pin_hash: string | null;
  supabase_url: string | null;
  supabase_anon_key: string | null;
};

export type Job = {
  id: string;
  agent_id: string;
  title: string;
  description: string | null;
  status: string;
  reward: number;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  agent_id: string;
  role: string;
  content: string;
  created_at: string;
};

export type FileEntry = {
  id: string;
  agent_id: string;
  name: string;
  size: number;
  mime_type: string | null;
  storage_path: string | null;
  created_at: string;
};

export type WalletTransaction = {
  id: string;
  agent_id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
};

export type Email = {
  id: string;
  agent_id: string;
  sender: string;
  recipient: string;
  subject: string | null;
  body_preview: string | null;
  status: string;
  created_at: string;
};

export type RiskAction = {
  id: string;
  agent_id: string;
  risk_level: 'Low' | 'Medium' | 'High';
  action_type: string;
  description: string | null;
  status: string;
  created_at: string;
};
