-- ============================================================
-- kimishika特典医院の月間上限を 100回 → 30回 に変更（2026-11-04）
--
-- 変更内容:
--   RPC try_increment_clinic_monthly_usage のデフォルト引数 p_limit を
--   100 から 30 に揃える（create or replace function のみ）。
--   ※ アプリ（/api/counseling）は呼び出し時に毎回 p_limit を明示指定するため、
--     本適用はフォールバック値の整合用途。既存の clinic_monthly_usage の
--     行は一切書き換えない（当月の累積が30以上の医院は即ブロックされ、
--     翌月の lazy reset で自然に30枠に収まる）。
--
-- 【適用手順】本番適用は依頼者が Supabase SQL Editor で手動実行する。
--   ※ create or replace function なので二重実行は安全。
--   ※ 未適用でもアプリ側の明示指定（30）が優先されるため挙動は変わらない。
-- ============================================================

create or replace function public.try_increment_clinic_monthly_usage(
  p_clinic_id uuid,
  p_limit integer default 30
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

-- RPCはservice_roleのみ実行可能に（方針は初回マイグレーションと同一）
revoke all on function public.try_increment_clinic_monthly_usage(uuid, integer) from public;
grant execute on function public.try_increment_clinic_monthly_usage(uuid, integer) to service_role;

-- 確認用（省略引数で呼んで 30 で止まることの目安。clinic_id は存在する医院に置き換える）
-- select public.try_increment_clinic_monthly_usage('<医院のclinic_id>'::uuid);
