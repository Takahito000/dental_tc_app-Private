import { createClient } from '@supabase/supabase-js';

// マークダウン記号やゴミ文字を自動切除して正しいURLのみを抽出
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const urlMatch = rawUrl.match(/(https?:\/\/[^\s\[\]\(\)]+)/);
const supabaseUrl = urlMatch ? urlMatch[1] : 'https://aqicsnqemgtmbixnrtxp.supabase.co';

const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseAnonKey = rawKey.replace(/[\[\]\(\)'"\s]/g, '').trim();

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getSupabaseAdmin = () => {
  const rawAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const adminKey = rawAdminKey.replace(/[\[\]\(\)'"\s]/g, '').trim();
  return createClient(supabaseUrl, adminKey);
};