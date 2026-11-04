// kimishika特典医院の月30回制御（KC-056 / 2026-11-04に上限100→30へ変更）の動作検証
//
// 【Part A: 静的検査】常時実行。コード・SQLの構造・文言を検証する。
// 【Part B: DB検証】   接続先が指定された場合のみ実行。
//   使い方: KIMISHIKA_PG="host:port:dbname" node test-kimishikaLimit.mjs
//   （ローカル検証例: createdb + service_roleロール作成後に
//     KIMISHIKA_PG="localhost:55433:kimishika_test" node test-kimishikaLimit.mjs）
//   本番Supabaseには接続しない（マイグレーション本番適用は依頼者作業のため）。
import { readFileSync } from "fs";
import { execFileSync } from "child_process";

let pass = 0;
let fail = 0;
const ok = (cond, name) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ FAIL: ${name}`);
  }
};

// ============================================================
// Part A: 静的検査
// ============================================================
console.log("Part A: 静的検査");

const route = readFileSync("app/api/counseling/route.ts", "utf8");
const page = readFileSync("app/app/page.tsx", "utf8");
const migration = readFileSync(
  "supabase/migrations/20261102000000_kimishika_monthly_limit.sql",
  "utf8"
);
const template = readFileSync("docs/kimishika/DENPIST_AI_SQL_TEMPLATE.sql", "utf8");

// A1: マイグレーションの構成
ok(migration.includes("create or replace function public.try_increment_clinic_monthly_usage"),
  "A1-1 RPC try_increment_clinic_monthly_usage が定義されている");
ok(migration.includes("create table if not exists public.clinic_monthly_usage"),
  "A1-2 月次カウントテーブル clinic_monthly_usage が作成される");
ok(migration.includes('add column if not exists plan'), "A1-3 clinics.plan カラム追加");
ok(migration.includes("add column if not exists kimishika_email"), "A1-4 clinics.kimishika_email カラム追加");
ok(migration.includes("Asia/Tokyo"), "A1-5 リセット基準が日本時間(Asia/Tokyo)");
ok(/primary key \(clinic_id, month\)/.test(migration), "A1-6 月初リセットは主キー(clinic_id, month)＝lazy reset方式");
ok(migration.includes("grant execute"), "A1-7 RPC は service_role のみ実行可能");

// A2: カウントが Dify 呼び出しの前に行われる（フック位置）
const idxRpc = route.indexOf("try_increment_clinic_monthly_usage");
const idxDify = route.indexOf("fetch(targetUrl");
ok(idxRpc > -1 && idxDify > -1 && idxRpc < idxDify,
  "A2-1 月30回チェックが Dify呼び出し(fetch)より前にある");
ok(route.includes('clinic?.plan === "kimishika"'),
  "A2-2 kimishika特典医院(plan=kimishika)にのみ適用されるガード");
ok(route.includes("monthlyLimitReached: true"), "A2-3 上限到達時は monthlyLimitReached フラグを返す");
ok(route.includes("今月の無料利用枠（月30回）に達しました。\\n翌月1日にリセットされます。"),
  "A2-4 上限到達時の文言が依頼者提示文面と一致");

// A3: 画面表示
ok(page.includes("data.monthlyLimitReached"), "A3-1 クライアントが monthlyLimitReached を分岐で扱う");
ok(/monthlyLimitReached\s*\?\s*data\.error/.test(page.replace(/\n/g, " ")),
  "A3-2 上限到達時は「AI生成エラー:」プレフィックスなしで文言をそのまま表示");
ok(page.includes("whitespace-pre-wrap"), "A3-3 複数行案内が改行付きで描画される");

// A4: SQLテンプレート
ok(template.includes("{医院名}") && template.includes("{メールアドレス}"),
  "A4-1 プレースホルダ {医院名} {メールアドレス} を含む");
ok(template.includes("on conflict (kimishika_email) do nothing"),
  "A4-2 冪等（同一メールアドレス再実行で新規発行しない）");
const lastStmt = template.trim().split(";").filter((s) => s.trim()).pop();
ok(/select\s+access_token\s+as\s+token/i.test(lastStmt),
  "A4-3 最後の文がトークン単体のSELECT（コピー可能な形で返る）");
ok(template.includes("'kimishika'"), "A4-4 プラン種別 kimishika が登録される");
ok(/insert into public\.clinics \([^)]*print_email/.test(template.replace(/\n/g, " ")),
  "A4-5 print_email（本番NOT NULL列）がINSERTに含まれる");
ok(!/service_role|SUPABASE_SERVICE_ROLE_KEY|apikey|Bearer/i.test(template),
  "A4-6 テンプレートに秘匿情報を含まない");

// ============================================================
// Part B: DB検証（KIMISHIKA_PG 指定時のみ）
// ============================================================
const pg = process.env.KIMISHIKA_PG; // "host:port:dbname"
if (!pg) {
  console.log("\nPart B: DB検証 — スキップ（KIMISHIKA_PG 未指定）");
} else {
  const [host, port, db] = pg.split(":");
  const psql = (sql) =>
    execFileSync("psql", ["-h", host, "-p", port, "-d", db, "-tAq", "-c", sql], {
      encoding: "utf8",
    }).trim();
  console.log("\nPart B: DB検証 (%s)", pg);

  // B0: クリーンな医院として検証用トークンを準備（存在しなければ作成）
  //     print_email は本番スキーマで NOT NULL（デフォルトなし）のため必須
  const ensureClinic = (token) => {
    psql(`insert into public.clinics (name, access_token, print_email, plan, kimishika_email)
      select 'KC056検証医院', '${token}', '${token}@kimishika-test.example', 'kimishika', '${token}@kimishika-test.example'
      where not exists (select 1 from public.clinics where access_token='${token}')`);
    return psql(`select id from public.clinics where access_token='${token}'`);
  };
  const cid = ensureClinic("kc056-test-token");

  // B1: RPCの 29/30/31（月30回枠）
  const seq = psql(`do $$
    declare r int; i int;
    begin
      delete from public.clinic_monthly_usage where clinic_id='${cid}'::uuid;
      create temp table _r (seq int, ret int);
      for i in 1..31 loop
        r := public.try_increment_clinic_monthly_usage('${cid}'::uuid, 30);
        insert into _r values (i, r);
      end loop;
    end $$;
    select string_agg(coalesce(ret::text,'NULL'),',') from (select seq, ret from pg_temp._r where seq in (29,30,31) order by seq) t;`);
  ok(seq === "29,30,NULL", `B1 29回目=29 / 30回目=30 / 31回目=NULL(拒否) [実測: ${seq}]`);
  const cnt = psql(`select count from public.clinic_monthly_usage where clinic_id='${cid}'::uuid`);
  ok(cnt === "30", `B2 上限を超えてカウントされていない（count=${cnt}）`);

  // B3: 月またぎ（前月行があっても当月は新規カウント＝lazy reset）
  //     B1で当月枠を使い切った医院とは別の医院で検証する
  const cidB = ensureClinic("kc056-test-token-b");
  psql(`delete from public.clinic_monthly_usage where clinic_id='${cidB}'::uuid`);
  psql(`insert into public.clinic_monthly_usage (clinic_id, month, count)
    values ('${cidB}'::uuid, date_trunc('month', current_date)::date - interval '1 month', 30)`);
  const cross = psql(`select public.try_increment_clinic_monthly_usage('${cidB}'::uuid, 30)`);
  ok(cross === "1", `B3 当月は初回から利用可能（前月30回済みでも当月1回目が成功） [返値=${cross}]`);
  psql(`delete from public.clinic_monthly_usage where clinic_id in ('${cid}'::uuid, '${cidB}'::uuid)`);

  // B4: SQLテンプレート（冪等＋トークン単体返却）
  const tpl = template
    .replaceAll("{医院名}", "KC056ダミー医院")
    .replaceAll("{メールアドレス}", "kc056-dummy@test.example");
  const runTpl = () =>
    execFileSync("psql", ["-h", host, "-p", port, "-d", db, "-tAq", "-c", tpl], {
      encoding: "utf8",
    }).trim();
  const t1 = runTpl();
  const t2 = runTpl();
  ok(/^kim[0-9a-f]{32}$/.test(t1), `B4-1 トークン単体が返る（形式 kim+32hex）[${t1}]`);
  ok(t1 === t2, "B4-2 同一メールアドレスの再実行は既存トークンを返す（新規発行しない）");
  const rows = psql(`select count(*) from public.clinics where kimishika_email='kc056-dummy@test.example'`);
  ok(rows === "1", `B4-3 医院レコードが重複作成されていない（${rows}件）`);
  const planSet = psql(`select plan='kimishika' from public.clinics where kimishika_email='kc056-dummy@test.example'`);
  ok(planSet === "t", "B4-4 プラン種別 kimishika が登録されている");
  const printEmail = psql(`select print_email='kc056-dummy@test.example' from public.clinics where kimishika_email='kc056-dummy@test.example'`);
  ok(printEmail === "t", "B4-5 print_email（NOT NULL）がkimishika登録メールアドレスで登録されている");

  // B5: 既存医院(plan未設定)への影響なし（条件変更していないことのDB側確認）
  const untouched = psql(`select count(*) from public.clinics where plan is null`);
  ok(Number(untouched) >= 1, `B5 plan未設定（従来のトライアル等）医院がそのまま存在する（${untouched}件）`);

  // B6: 並列実行でも上限30で厳密に止まること（25回消費済み + 30並列 → ちょうど5件成功）
  const cidC = ensureClinic("kc056-test-token-c");
  psql(`delete from public.clinic_monthly_usage where clinic_id='${cidC}'::uuid`);
  psql(`insert into public.clinic_monthly_usage (clinic_id, month, count)
    select '${cidC}'::uuid, date_trunc('month', current_date)::date, 25
    on conflict do nothing`);
  const concOut = execFileSync("bash", ["-c", `
    rm -f /tmp/kc063-conc.txt
    for i in $(seq 1 30); do
      psql -h ${host} -p ${port} -d ${db} -tAc "select public.try_increment_clinic_monthly_usage('${cidC}'::uuid, 30);" >> /tmp/kc063-conc.txt &
    done
    wait
    sort /tmp/kc063-conc.txt | uniq -c
    rm -f /tmp/kc063-conc.txt
  `], { encoding: "utf8" });
  const succeeded = (concOut.match(/^\s*1\s+(2[6-9]|30)\s*$/gm) || []).length;
  const finalCnt = psql(`select count from public.clinic_monthly_usage where clinic_id='${cidC}'::uuid`);
  ok(succeeded === 5, `B6-1 30並列でちょうど5件のみ成功（26〜30） [実測成功種別: ${succeeded}]`);
  ok(finalCnt === "30", `B6-2 最終カウントが厳密に30で止まっている（count=${finalCnt}）`);
  psql(`delete from public.clinic_monthly_usage where clinic_id='${cidC}'::uuid`);
}

console.log(`\n結果: ${pass}件PASS / ${fail}件FAIL`);
process.exit(fail > 0 ? 1 : 0);
