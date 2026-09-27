-- ============================================================
-- test_logs テーブル作成（2026-09-27）
-- 目的: テスト生成（担当者名=合言葉「##test##」の完全一致）の記録を
--       本番の発行ログ（generation_logs）・管理ID採番（usage_logs）から分離する。
--       ・医院向けログ画面（/app/logs）は generation_logs のみ参照するため、
--         テスト記録が医院から見えなくなる
--       ・usage_logs へ挿入しないため、管理IDの連番消費・欠番が発生しない
--       ・確認・削除は Supabase ダッシュボードで管理者が手動運用する
--
-- 【適用手順】本番適用してからアプリをデプロイすること。
--   1. Supabase ダッシュボード → SQL Editor で本ファイル全文を実行
--   2. 作成後にアプリ（/api/counseling）をデプロイ
--   ※ CREATE TABLE IF NOT EXISTS なので二重実行は安全
-- ============================================================

create table if not exists public.test_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics (id),
  patient_anon_id text,                 -- テスト生成は usage_logs を経由しないため null になる
  staff_name text,
  inputs jsonb,
  patient_sheet text,
  talk_script text,
  validation_flags jsonb,
  created_at timestamptz not null default now()
);

-- インデックスは発行ログ（generation_logs）と同じ運用（clinic_id 絞り込み・created_at 並び）に準じる
create index if not exists test_logs_clinic_id_idx on public.test_logs (clinic_id);
create index if not exists test_logs_created_at_idx on public.test_logs (created_at desc);

-- RLS ポリシーは発行ログテーブルに準じる。
-- 医院トークンからのアクセス経路を作らないため、anon / authenticated への
-- ポリシーは一切作成しない（service_role のみアクセス可能）。
alter table public.test_logs enable row level security;

-- 確認用（実行後、行が返れば作成済み）
-- select * from public.test_logs limit 1;
