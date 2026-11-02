-- ============================================================
-- 利用規約同意記録テーブル terms_consents（2026-11-03 / KC-063）
--
-- 目的:
--   デンピストAI利用規約 v1.0（2026-11-05 施行）への同意を、
--   医院（トークンに紐づく clinics レコード）ごとにサーバ側DBで記録する。
--   - 同意の有無によるアクセス制御（同意ゲート）はサーバ側でのみ判定する
--     （クライアント側のみの表示制御はスキップ可能になるため禁止）
--   - 規約改訂時は tos_version を上げると、全医院が再同意対象になる構造
--
-- 冪等性:
--   (clinic_id, tos_version) に一意制約を付け、同一バージョンへの二重同意を防ぐ。
--   アプリ側は insert ... on conflict do nothing で記録する。
--
-- 【適用手順】本番適用は依頼者が Supabase SQL Editor で手動実行する。
--   ※ create table if not exists なので二重実行は安全。
--   ※ アプリ側は本テーブル未作成でも従来通り動作する
--     （同意チェックのクエリ失敗時はフェイルセーフでゲートを通す）。
-- ============================================================

create table if not exists public.terms_consents (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references public.clinics (id),
  tos_version text not null,                       -- lib/terms.ts の CURRENT_TERMS_VERSION と対応
  agreed_at   timestamp with time zone not null default now(),  -- サーバ時刻で記録
  created_at  timestamp with time zone not null default now(),
  unique (clinic_id, tos_version)
);

-- 医院側からの直接 select / insert は不可。
-- 同意状態の参照・記録はサーバ側の処理経由のみ（service_role のみアクセス可能）。
alter table public.terms_consents enable row level security;

-- 確認用（実行後に行が返れば作成済み）
-- select * from public.terms_consents limit 1;
