import { createClient } from "@supabase/supabase-js";

// ビルド時（process.envが空の評価タイミング）にエラーで落ちないようフォールバックを設定
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://aqicsnqemgtmbixnrtxp.supabase.co";

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "placeholder-key";

// サーバーサイド（API Route）専用の管理者用Supabaseクライアント
export const supabase = createClient(supabaseUrl, supabaseServiceKey);