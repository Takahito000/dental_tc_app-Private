import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase environment variables in .env.local");
}

// サーバーサイド（API Route）専用の管理者用Supabaseクライアント
export const supabase = createClient(supabaseUrl, supabaseServiceKey);