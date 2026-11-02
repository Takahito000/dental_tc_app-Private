-- ============================================================
-- kimishika特典医院の月100回制御 + 発行SQL用カラム（2026-11-02 / KC-056）
--
-- 目的:
--   1. kimishika登録医院の特典（月100回まで無料）を、シート生成回数で制御する
--      - 対象は plan = 'kimishika' の医院のみ（既存トライアル・モニター医院は
--        plan が null のままなので一切条件変更を受けない）
--   2. 医院のkimishika紐付け＝kimishika登録メールアドレスと同一アドレスで管理する
--      （発行SQLの冪等キーとして使う。既存行は null のまま衝突しない）
--   3. 月次カウントは lazy reset（生成時に当月行を参照・なければ新規作成。
--      cron不要でジョブ失敗によるリセット漏れが起きない）
--
-- 【適用手順】本番適用は依頼者が Supabase SQL Editor で手動実行する。
--   ※ alter table add column if not exists / create table if not exists /
--     create or replace function なので二重実行は安全。
--   ※ アプリ側（/api/counseling）はマイグレーション未適用でも従来通り動作する
--     （RPC呼び出し失敗時は warn を残して従来通り生成するフェイルセーフ）。
-- ============================================================

-- 1) clinics へプラン種別・kimishika紐付けメールを追加
--    plan: null = 従来のトライアル・モニター医院（条件変更なし）/ 'kimishika' = kimishika特典
alter table public.clinics
  add column if not exists plan text;

alter table public.clinics
  add column if not exists kimishika_email text;

-- 発行SQLの冪等キー（null 行は複数可＝既存医院に影響しない）
create unique index if not exists clinics_kimishika_email_key
  on public.clinics (kimishika_email);

-- 2) 月次利用カウント（月初リセットは「当月の行がなければ新規作成」で実現＝lazy reset）
create table if not exists public.clinic_monthly_usage (
  clinic_id uuid not null references public.clinics (id),
  month     date not null,              -- その月の1日（JST基準。アプリ側はRPC内部で算出）
  count     integer not null default 0, -- 当月のシート生成回数
  primary key (clinic_id, month)
);

alter table public.clinic_monthly_usage enable row level security;
-- 医院トークンからのアクセス経路は作らない（service_role のみアクセス可能）

-- 3) カウントの原子インクリメントRPC（Dify呼び出しの前に実行する）
--    戻り値:
--      1〜p_limit …… 加算成功（その月の新しいカウント＝今回の生成が N 回目）
--      null        …… 上限到達のため加算不可（呼び出し側はDifyを呼ばず案内を返す）
--    同時実行対策: UPDATE の WHERE count < p_limit で上限超過をDB側でブロックし、
--    INSERT直後の競合ではUPDATEを再試行する。上限を超えて加算されることはない。
create or replace function public.try_increment_clinic_monthly_usage(
  p_clinic_id uuid,
  p_limit integer default 100
)
returns integer
language plpgsql
as $$
declare
  v_now_jst   timestamp := now() at time zone 'Asia/Tokyo';
  v_month     date := date_trunc('month', v_now_jst)::date;
  v_count     integer;
begin
  -- (a) 当月行が存在し上限未満なら加算
  update public.clinic_monthly_usage
     set count = count + 1
   where clinic_id = p_clinic_id
     and month = v_month
     and count < p_limit
   returning count into v_count;
  if found then
    return v_count;
  end if;

  -- (b) 当月行が無ければ新規作成（lazy resetの本体。月またぎはここで新しい月の行が作られる）
  insert into public.clinic_monthly_usage (clinic_id, month, count)
  values (p_clinic_id, v_month, 1)
  on conflict (clinic_id, month) do nothing;
  if found then
    return 1;
  end if;

  -- (c) 並発で他トランザクションが挿入した可能性があるため加算を再試行
  update public.clinic_monthly_usage
     set count = count + 1
   where clinic_id = p_clinic_id
     and month = v_month
     and count < p_limit
   returning count into v_count;
  if found then
    return v_count;
  end if;

  -- (d) ここに来るのは「当月行が存在し、p_limit 以上」＝上限到達のみ
  return null;
end;
$$;

-- RPCはservice_roleのみ実行可能に（anon/authenticatedからの呼び出し経路を作らない）
revoke all on function public.try_increment_clinic_monthly_usage(uuid, integer) from public;
grant execute on function public.try_increment_clinic_monthly_usage(uuid, integer) to service_role;

-- 確認用（実行後にそれぞれ行・列が見えれば作成済み）
-- select plan, kimishika_email from public.clinics limit 1;
-- select * from public.clinic_monthly_usage limit 1;
-- select public.try_increment_clinic_monthly_usage('00000000-0000-0000-0000-000000000000'::uuid, 100);
