-- ============================================================
-- デンピストAI kimishika特典医院 発行SQL（KC-056 / 2026-11-02）
--
-- 使い方:
--   1. 下記2箇所のプレースホルダを医院ごとの値に置換する
--      （kimishika管理画面の「SQLコピー」ボタンが自動置換する前提の形式）
--        {医院名}      … 医院名
--        {メールアドレス} … kimishika登録メールアドレス（冪等キー）
--   2. Supabase SQL Editor で1本まるごと実行する
--
-- 結果:
--   最後のSELECTの結果として「発行されたトークン単体」だけが返る。
--   このトークンをkimishika管理画面に貼り付けて運用する。
--
-- 冪等性:
--   同一メールアドレスで再実行しても新規発行せず、既存のトークンを返す
--   （医院レコードの重複作成もしない）。
--
-- 前提:
--   マイグレーション 20261102000000_kimishika_monthly_limit.sql が適用済みであること。
--
-- 注意:
--   医院名にシングルクォート(')が含まれる場合は '' に二重化してから置換すること。
-- ============================================================

insert into public.clinics (name, access_token, plan, kimishika_email)
values (
  '{医院名}',
  'kim' || replace(gen_random_uuid()::text, '-', ''),
  'kimishika',
  lower(trim('{メールアドレス}'))
)
on conflict (kimishika_email) do nothing;

-- 発行済み（または今回発行した）トークンを単体で返す。これをkimishika管理画面に貼り付ける。
select access_token as token
from public.clinics
where kimishika_email = lower(trim('{メールアドレス}'));
