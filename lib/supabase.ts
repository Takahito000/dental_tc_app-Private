import { createClient } from "@supabase/supabase-js";

// 関数としてエクスポートし、呼び出された時だけ（＝API実行時に）初期化する
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://aqicsnqemgtmbixnrtxp.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

  if (!url || !key) {
    throw new Error("Supabase env missing");
  }
  
  return createClient(url, key);
}