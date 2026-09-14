"use client";

// ============================================================
// 発行ログ一覧（/app/logs）のクライアント画面
// - 認証は /api/generation-logs 側（token → clinics.access_token 照合 → clinic_id絞り）
// - ソート・フィルタはクライアント側完結（追加APIコール不要）
// - free_memo は展開表示にも含めない（患者を特定し得る自由記述のため）
// ============================================================

import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type LogRow = {
  id: string;
  patient_anon_id: string | null;
  staff_name: string | null;
  inputs: Record<string, unknown> | null;
  created_at: string;
};

type SortKey = "anonId" | "createdAt" | "staff" | "mode" | "first";
type SortDir = "asc" | "desc";

const MODE_LABELS: Record<string, string> = {
  denture: "義歯",
  crown: "クラウン",
};

// inputs のキーをフォームの設問ラベルに変換（不明なキーはそのまま表示）
const INPUT_LABELS: Record<string, string> = {
  mode: "アプリ種別",
  sheet_mode: "シートモード",
  first_candidate: "第一候補",
  candidate_price_range: "価格レンジ",
  note_flags: "注意フラグ",
  staffName: "担当者",
  price_per_day: "1日あたりの目安",
  // クラウン
  target_site: "被せ物の部位",
  visibility: "笑ったときの見え方",
  chief_priority: "患者さまが重視していること",
  metal_allergy: "金属アレルギーの有無",
  bruxism: "歯ぎしり・食いしばり",
  has_pain: "痛み・違和感の有無",
  // 義歯
  denture_status: "入れ歯の使用状況",
  remaining_teeth: "残っている歯",
  target_jaw: "対象の顎",
  defect_site: "欠損部位",
  current_denture_complaints: "現義歯の主な不満（複数可）",
  denture_duration: "現義歯の使用年数",
  adjustment_history: "調整・履歴",
  oral_dryness: "口の乾き・唾液",
  ridge_mucosa: "顎堤・粘膜の状態",
  emotion_drivers: "追求したい情緒価値",
  expectation_type: "期待値タイプ",
  expectation: "患者さまの期待",
  cost_sensitivity: "費用感度",
  red_flag_words: "要注意ワード",
};

// 同じキーで義歯／クラウンで設問ラベルが異なる場合の上書き（クラウン側）
const CROWN_LABEL_OVERRIDES: Record<string, string> = {
  cost_sensitivity: "費用へのご意向",
};

// 展開表示の値を見やすい表記に変換（キー単位。不明な値はそのまま表示）
const VALUE_LABELS: Record<string, Record<string, string>> = {
  mode: { denture: "義歯", crown: "クラウン" },
  sheet_mode: {
    normal: "通常",
    standard: "通常",
    insurance_first: "保険ファースト",
    cautious: "慎重モード",
    careful: "検査案内モード",
  },
};

// 展開表示から除外するキー（free_memo=患者を特定し得る自由記述、token=認証情報、note_flags=スタッフ向け内部フラグ）
const EXCLUDED_INPUT_KEYS = new Set(["free_memo", "token", "access_token", "note_flags"]);

const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date(iso))
    .replace(/\//g, "/");

const fmtValue = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.map((x) => fmtValue(x)).join("、") : "—";
  if (typeof v === "boolean") return v ? "あり" : "なし";
  return String(v);
};

// VALUE_LABELS を値に適用（配列は要素ごと。マッチしない値はそのまま）
// price_per_day は数値のみの場合に末尾へ単位「円」を付ける（本番値は「約380円」等で既に単位付きのため変更不要）
const applyValueLabels = (key: string, v: unknown): unknown => {
  if (key === "price_per_day") {
    if (typeof v === "number" && Number.isFinite(v)) return `${v}円`;
    if (typeof v === "string") {
      const t = v.trim();
      if (/^[\d,]+$/.test(t)) return `${t}円`;
    }
    return v;
  }
  const map = VALUE_LABELS[key];
  if (!map) return v;
  if (Array.isArray(v)) return v.map((x) => map[String(x)] ?? x);
  if (typeof v === "string") return map[v] ?? v;
  return v;
};

export default function LogsClient() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [staffFilter, setStaffFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // トークン解決: ?t= 優先、なければ localStorage / Cookie（/app と同パターン）
  useEffect(() => {
    const urlToken = searchParams.get("t") || "";
    const savedToken = localStorage.getItem("clinic_access_token") || "";
    const cookieToken =
      document.cookie.match(/(?:^|;\s*)clinic_access_token=([^;]*)/)?.[1] || "";
    setToken(urlToken || savedToken || decodeURIComponent(cookieToken) || "");
  }, [searchParams]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("notoken");
      return;
    }
    setLoading(true);
    fetch(`/api/generation-logs?t=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.status === 401) {
          setError("unauthorized");
          return null;
        }
        if (!res.ok) {
          setError("server");
          return null;
        }
        return res.json();
      })
      .then((d) => {
        if (!d) return;
        setLogs(Array.isArray(d.logs) ? d.logs : []);
        setTruncated(d.truncated === true);
        setError(null);
      })
      .catch(() => setError("server"))
      .finally(() => setLoading(false));
  }, [token]);

  const modeOf = (row: LogRow) =>
    (row.inputs?.mode || "").toString();
  const modeLabel = (row: LogRow) =>
    MODE_LABELS[modeOf(row)] || modeOf(row) || "—";
  const firstOf = (row: LogRow) =>
    (row.inputs?.first_candidate || "").toString();
  const staffOf = (row: LogRow) => row.staff_name || "—";

  // 期間フィルタ用の「今月」「先月」境界（JST）
  const periodRange = useMemo(() => {
    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
    );
    const thisStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { thisStart, lastStart, lastEnd };
  }, []);

  const staffOptions = useMemo(
    () => Array.from(new Set(logs.map(staffOf))).sort(),
    [logs]
  );

  const filtered = useMemo(() => {
    return logs.filter((row) => {
      if (staffFilter !== "all" && staffOf(row) !== staffFilter) return false;
      if (modeFilter !== "all" && modeOf(row) !== modeFilter) return false;
      if (periodFilter !== "all") {
        const d = new Date(row.created_at);
        if (periodFilter === "thisMonth" && d < periodRange.thisStart)
          return false;
        if (
          periodFilter === "lastMonth" &&
          (d < periodRange.lastStart || d > periodRange.lastEnd)
        )
          return false;
      }
      return true;
    });
  }, [logs, staffFilter, modeFilter, periodFilter, periodRange]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const val = (row: LogRow): string => {
      switch (sortKey) {
        case "anonId":
          return row.patient_anon_id || "";
        case "staff":
          return staffOf(row);
        case "mode":
          return modeOf(row);
        case "first":
          return firstOf(row);
        default:
          return row.created_at;
      }
    };
    return [...filtered].sort((a, b) => val(a).localeCompare(val(b)) * dir);
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortIcon = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  const headers: { key: SortKey; label: string; right?: boolean }[] = [
    { key: "anonId", label: "管理ID" },
    { key: "createdAt", label: "生成日時", right: true },
    { key: "staff", label: "担当者" },
    { key: "mode", label: "種別" },
    { key: "first", label: "第一候補" },
  ];

  return (
    <main className="min-h-screen bg-bg text-ink">
      {/* ヘッダー（ツールと同トーン） */}
      <header className="no-print bg-paper border-b-[1.5px] border-b-ink py-3.5 px-6">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-y-2">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand-icon.png" alt="デンピストAI" className="h-9 w-9 rounded-lg" />
            <div>
              <h1 className="font-serif-jp text-base font-bold tracking-wider">
                発行ログ
              </h1>
              <p className="hidden text-[9px] tracking-[0.2em] text-ink-soft sm:block">
                DENPIST AI
              </p>
            </div>
          </div>
          <a
            href={`/app?t=${encodeURIComponent(token)}`}
            className="text-xs font-bold text-accent hover:underline underline-offset-2"
          >
            入力画面へ戻る
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-6">
        {/* フィルタバー */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-ink-soft">
            担当者
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs font-medium text-ink focus:border-accent focus:outline-none"
            >
              <option value="all">すべて</option>
              {staffOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-ink-soft">
            種別
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs font-medium text-ink focus:border-accent focus:outline-none"
            >
              <option value="all">すべて</option>
              <option value="denture">義歯</option>
              <option value="crown">クラウン</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-ink-soft">
            期間
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs font-medium text-ink focus:border-accent focus:outline-none"
            >
              <option value="all">全期間</option>
              <option value="thisMonth">今月</option>
              <option value="lastMonth">先月</option>
            </select>
          </label>
          <span className="ml-auto text-[11px] text-ink-soft">
            {sorted.length}件
          </span>
        </div>

        {/* 一覧 */}
        <div className="overflow-x-auto rounded-xl bg-white px-4 py-2 md:px-6">
          {loading ? (
            <p className="py-12 text-center text-xs text-ink-soft">読み込み中...</p>
          ) : error === "notoken" || error === "unauthorized" ? (
            <p className="py-12 text-center text-xs text-ink-soft">
              {error === "notoken"
                ? "トークンがありません。/app から「発行ログ」リンクで開いてください。"
                : "認証に失敗しました。トークンを確認してください。"}
            </p>
          ) : error === "server" ? (
            <p className="py-12 text-center text-xs text-ink-soft">
              ログの取得に失敗しました。時間をおいて再度お試しください。
            </p>
          ) : sorted.length === 0 ? (
            <p className="py-12 text-center text-xs text-ink-soft">
              {logs.length === 0
                ? "発行ログはまだありません。"
                : "条件に一致する発行ログはありません。"}
            </p>
          ) : (
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink/60 text-left">
                  {headers.map((h) => (
                    <th
                      key={h.key}
                      onClick={() => toggleSort(h.key)}
                      className={`cursor-pointer select-none whitespace-nowrap px-3 py-3 text-[11px] font-bold text-ink-soft hover:text-accent ${
                        h.right ? "text-right" : "text-left"
                      }`}
                    >
                      {h.label}
                      {sortIcon(h.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() =>
                        setExpandedId(expandedId === row.id ? null : row.id)
                      }
                      className="cursor-pointer border-b border-line transition-colors hover:bg-tint"
                    >
                      <td className="px-3 py-3.5 font-mono text-xs text-ink">
                        {row.patient_anon_id || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-right text-xs text-ink-soft">
                        {fmtDateTime(row.created_at)}
                      </td>
                      <td className="px-3 py-3.5 text-xs text-ink-soft">
                        {staffOf(row)}
                      </td>
                      <td className="px-3 py-3.5 text-xs text-ink-soft">
                        {modeLabel(row)}
                      </td>
                      <td className="px-3 py-3.5 text-xs font-bold text-ink">
                        {firstOf(row) || "—"}
                      </td>
                    </tr>
                    {expandedId === row.id && (
                      <tr className="border-b border-line bg-paper">
                        <td colSpan={5} className="px-3 py-4 md:px-6">
                          <dl className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
                            {expandEntries(row).map(([k, v]) => (
                              <div key={k} className="flex gap-2 text-xs">
                                <dt className="shrink-0 font-bold text-ink-soft">
                                  {inputLabel(k, modeOf(row))}:
                                </dt>
                                <dd className="break-words text-ink">
                                  {fmtValue(applyValueLabels(k, v))}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 上限到達時の注記 */}
        {truncated && (
          <p className="mt-3 text-[11px] text-ink-soft">
            ※最新500件を表示しています。それ以前のログは表示されません。
          </p>
        )}

        {/* トークン取り扱い注意 */}
        <p className="mt-8 text-[11px] leading-relaxed text-ink-soft">
          ※このページのURLにはアクセストークンが含まれています。URLの共有・漏洩にご注意ください。
        </p>
      </div>
    </main>
  );
}

// 展開表示用のエントリ（free_memo・token系は除外。項目名の並びは既知ラベル優先）
function expandEntries(row: LogRow): [string, unknown][] {
  const inputs = row.inputs || {};
  const keys = Object.keys(inputs).filter((k) => !EXCLUDED_INPUT_KEYS.has(k));
  const known = keys.filter((k) => k in INPUT_LABELS);
  const unknown = keys.filter((k) => !(k in INPUT_LABELS)).sort();
  return [...known, ...unknown].map((k) => [k, inputs[k]]);
}

// 項目ラベルの解決（クラウンで同名キーのラベルが異なる場合は上書き。不明なキーはそのまま）
function inputLabel(key: string, mode: string): string {
  if (mode === "crown" && CROWN_LABEL_OVERRIDES[key]) return CROWN_LABEL_OVERRIDES[key];
  return INPUT_LABELS[key] || key;
}
