"use client";

// ============================================================
// 自費提案 組織力チェック（/check）のクライアント画面
// - 導入 → 設問（1問ずつ・Q1〜Q8＋E1の計9問）→ 結果
// - 判定ロジック・定型文は org-check-logic.ts（文言変更禁止）
// - 医院名・個人情報・メールアドレスは一切収集しない
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AnswerCode,
  E1Code,
  QUESTION_PREAMBLE,
  UNKNOWN_LABEL,
  QUESTIONS,
  E1_QUESTION,
  judgeAxis,
  computeResult,
  OrgResult,
  TYPE_CONTENTS,
  E1_TRIALS,
  E1Trial,
  YEARLY_TEXT,
  TRIAL_NOTE,
  feeBarWidthPct,
  MONTHLY_FEE_LABEL,
  COMMON_NOTES,
  partialAxisLine,
} from "./org-check-logic";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// テスト用：ロジックの再評価に必要な主要エクスポートの存在確認キー
export const __checkClientMarker = "org-check-client";

export default function CheckClient() {
  const searchParams = useSearchParams();
  const rParam = searchParams.get("r");
  const directType =
    rParam === "1" || rParam === "2" || rParam === "3" || rParam === "4"
      ? (Number(rParam) as 1 | 2 | 3 | 4)
      : null;

  const [step, setStep] = useState<"intro" | "question" | "result">(
    directType ? "result" : "intro"
  );
  const [qIndex, setQIndex] = useState(0); // 0〜7 = Q1〜Q8, 8 = E1
  const [answers, setAnswers] = useState<AnswerCode[]>(Array(8).fill(null));
  const [e1, setE1] = useState<E1Code>(null);
  const [utmSource, setUtmSource] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // utm_source の取得（1回のみ。シェア流入元の集計用）
  useEffect(() => {
    const u = new URLSearchParams(window.location.search).get("utm_source");
    setUtmSource(u && u.trim() ? u.trim().slice(0, 100) : null);
  }, []);

  const result: OrgResult | null = useMemo(() => {
    // 直接表示（?r=）は E1・軸結果を持たないため、セクション1/2/4のみ表示
    if (directType || step !== "result") return null;
    const axis1 = judgeAxis(answers.slice(0, 4));
    const axis2 = judgeAxis(answers.slice(4, 8));
    return computeResult(axis1, axis2);
  }, [directType, step, answers]);

  const start = () => {
    window.gtag?.("event", "shindan_start");
    setStep("question");
  };

  const choose = (code: AnswerCode) => {
    if (qIndex < 8) {
      const next = [...answers];
      next[qIndex] = code;
      setAnswers(next);
      if (qIndex < 7) {
        setQIndex(qIndex + 1);
        return;
      }
      setQIndex(8); // E1へ
      return;
    }
    // E1
    setE1(code as E1Code);
    persistResult(answers, code as E1Code);
    setStep("result");
  };

  // ---------- 結果確定時の匿名保存（fire-and-forget・失敗はconsole.errorで可視化） ----------
  const persistResult = (finalAnswers: AnswerCode[], e1Code: E1Code) => {
    const r = computeResult(
      judgeAxis(finalAnswers.slice(0, 4)),
      judgeAxis(finalAnswers.slice(4, 8))
    );
    const orgType = r.kind === "type" ? String(r.type) : "partial";
    window.gtag?.("event", "shindan_complete");
    fetch("/api/org-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: {
          q1: finalAnswers[0],
          q2: finalAnswers[1],
          q3: finalAnswers[2],
          q4: finalAnswers[3],
          q5: finalAnswers[4],
          q6: finalAnswers[5],
          q7: finalAnswers[6],
          q8: finalAnswers[7],
          e1: e1Code,
        },
        org_type: orgType,
        utm_source: utmSource,
      }),
    })
      .then((res) => {
        if (!res.ok) {
          console.error("[org-check] 回答保存失敗: HTTP", res.status);
        }
      })
      .catch((err) => {
        console.error("[org-check] 回答保存fetch例外:", err);
      });
  };

  // ---------- 結果シェア（フルタイプのみ・型名の直接露出を抑える） ----------
  const share = async () => {
    if (!result || result.kind !== "type") return;
    const url = `${window.location.origin}/check?r=${result.type}`;
    const text = `うちの医院は"届け方"を見直すタイプでした\n${url}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard API 非対応・権限拒否時のフォールバック
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  // ---------- 共通のラッパ ----------
  const wrap = (children: React.ReactNode) => (
    <main className="min-h-screen bg-bg py-14 md:py-20">
      <div className="mx-auto w-full max-w-2xl px-5">{children}</div>
    </main>
  );

  // ---------- 導入画面 ----------
  if (step === "intro") {
    return wrap(
      <div className="rounded-xl border border-line bg-white p-7 md:p-10">
        <p className="text-xs font-bold tracking-widest text-gold">ORGANIZATION CHECK</p>
        <h1 className="mt-3 font-serif-jp text-2xl font-bold text-ink md:text-3xl">
          自費の選択肢、患者さんに届いていますか？
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          8問・約2分で、貴院の"届け方"をチェックします
        </p>
        <p className="mt-4 text-xs leading-relaxed text-ink-soft">
          {QUESTION_PREAMBLE}
        </p>
        <button
          onClick={start}
          className="mt-8 w-full rounded-lg bg-accent px-6 py-4 text-sm font-bold text-paper transition-opacity hover:opacity-90"
        >
          チェックをはじめる
        </button>
      </div>
    );
  }

  // ---------- 設問画面（1問ずつ） ----------
  if (step === "question") {
    const isE1 = qIndex === 8;
    const question = isE1 ? null : QUESTIONS[qIndex];
    const total = 9;
    const current = qIndex + 1;
    const unknownOption = { label: UNKNOWN_LABEL, score: null as AnswerCode };
    const options = isE1
      ? E1_QUESTION.options.map((o) => ({ label: o.label, score: o.code as AnswerCode }))
      : [...question!.options.map((o) => ({ label: o.label, score: o.score as AnswerCode })), unknownOption];

    return wrap(
      <div className="rounded-xl border border-line bg-white p-7 md:p-10">
        <p className="text-xs font-bold tracking-widest text-gold">
          {isE1 ? "環境設問" : `質問 ${current} / ${total}`}
        </p>
        <p className="mt-2 text-[11px] text-ink-soft">{QUESTION_PREAMBLE}</p>
        <div className="mt-2 h-1 w-full bg-line">
          <div
            className="h-full bg-gold transition-all"
            style={{ width: `${Math.round((current / total) * 100)}%` }}
          />
        </div>
        <h2 className="mt-6 text-base font-bold leading-relaxed text-ink md:text-lg">
          {isE1 ? E1_QUESTION.text : question!.text}
        </h2>
        {isE1 && (
          <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">
            {E1_QUESTION.note}
          </p>
        )}
        <div className="mt-6 space-y-3">
          {options.map((o) => (
            <button
              key={o.label}
              onClick={() => choose(o.score)}
              className="w-full rounded-lg border border-line bg-paper px-5 py-4 text-left text-sm leading-relaxed text-ink transition-colors hover:border-accent hover:bg-accent-tint"
            >
              {o.label}
            </button>
          ))}
        </div>
        {qIndex > 0 && (
          <button
            onClick={() => setQIndex(qIndex - 1)}
            className="mt-6 text-xs text-ink-soft underline underline-offset-2"
          >
            前の質問に戻る
          </button>
        )}
      </div>
    );
  }

  // ---------- 結果画面 ----------
  const type = directType ?? (result?.kind === "type" ? result.type : null);
  const content = type ? TYPE_CONTENTS[type] : null;
  const trial: E1Trial | null =
    !directType && e1 !== null ? E1_TRIALS[e1] : null;
  const showTrial = !directType && trial !== null;

  return wrap(
    <div className="space-y-6">
      {/* セクション1： 組織タイプ＋よくある光景 */}
      <section className="rounded-xl border border-line bg-white p-7 md:p-10">
        <p className="text-xs font-bold tracking-widest text-gold">RESULT</p>
        {content ? (
          <>
            <h2 className="mt-3 font-serif-jp text-2xl font-bold text-ink md:text-3xl">
              {content.name}
            </h2>
            <p className="mt-5 text-sm leading-loose text-ink">{content.scene}</p>
            <p className="mt-4 text-xs leading-relaxed text-ink-soft">
              {content.structure}
            </p>
          </>
        ) : (
          // 片軸・両軸とも判定保留： タイプ名は出さず正直に表示
          <>
            <h2 className="mt-3 font-serif-jp text-2xl font-bold text-ink md:text-3xl">
              判定結果
            </h2>
            <div className="mt-5 space-y-3 text-sm leading-relaxed text-ink">
              <p>{partialAxisLine(1, result!.axis1)}</p>
              <p>{partialAxisLine(2, result!.axis2)}</p>
            </div>
          </>
        )}
      </section>

      {/* セクション2： このタイプの課題 → 打ち手（課題と同じ番号で対応・フルタイプのみ） */}
      {content && (
        <section className="rounded-xl border border-line bg-white p-7 md:p-10">
          <h3 className="text-base font-bold text-ink">このタイプの課題</h3>
          <ol className="mt-5 space-y-4">
            {content.issues.map((issue, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-soft text-xs font-bold text-paper">
                  {i + 1}
                </span>
                <span>{issue}</span>
              </li>
            ))}
          </ol>
          <h3 className="mt-8 text-base font-bold text-ink">打ち手</h3>
          <ol className="mt-5 space-y-6">
            {content.actions.map((a, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-paper">
                  {i + 1}
                </span>
                <span>
                  <span className="font-bold">{a.lead}</span>
                  <span className="mt-1 block">{a.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* セクション3： 効き判定＋月次利益増の試算（フルタイプのみ。試算はE1回答時のみ） */}
      {content && (
        <section className="rounded-xl border border-gold/40 bg-white p-7 md:p-10">
          <h3 className="text-base font-bold text-ink">効き判定＋月次利益増の試算</h3>
          <p className="mt-3 text-sm leading-relaxed text-ink">{content.effectiveness}</p>

          {showTrial && trial && (
            <>
              <div className="mt-5 space-y-3">
                {/* 見込み粗利増（最長・ゴールド） */}
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <span className="w-24 shrink-0 text-xs font-bold text-ink sm:w-28 sm:text-sm">
                    見込み粗利増
                  </span>
                  <div className="h-2.5 min-w-4 flex-1 bg-line">
                    <div className="h-full bg-gold" style={{ width: "100%" }} />
                  </div>
                  <span className="shrink-0 whitespace-nowrap font-serif-jp text-xs font-bold text-ink sm:text-sm">
                    {trial.gainLabel}
                  </span>
                </div>
                {/* 月額費用（全長は粗利増と同じ。うちネイビー部分は月額/粗利増上限の比率） */}
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <span className="w-24 shrink-0 text-xs font-bold text-ink sm:w-28 sm:text-sm">
                    月額費用
                  </span>
                  <div className="h-2.5 min-w-4 flex-1 bg-line">
                    <div
                      className="h-full bg-ink-soft"
                      style={{ width: `${feeBarWidthPct(trial)}%` }}
                    />
                  </div>
                  <span className="shrink-0 whitespace-nowrap font-serif-jp text-xs font-bold text-ink sm:text-sm">
                    {MONTHLY_FEE_LABEL}
                  </span>
                </div>
              </div>

              <p className="mt-4 text-sm font-bold leading-relaxed text-ink">
                {trial.message}
              </p>

              {trial.showYearly && (
                <p className="mt-5 rounded-lg bg-tint px-5 py-4 text-center font-serif-jp text-base font-bold text-ink md:text-lg">
                  {YEARLY_TEXT}
                </p>
              )}
            </>
          )}

          <p className="mt-5 text-[11px] leading-relaxed text-ink-soft">{TRIAL_NOTE}</p>
        </section>
      )}

      {/* セクション4： 橋渡し（タイプ別に出し分け。④のみ申し込みボタン非表示・フルタイプのみ） */}
      {content && (
        <section className="rounded-xl border border-line bg-accent p-7 text-paper md:p-10">
          <h3 className="font-serif-jp text-lg font-bold md:text-xl">
            {content.bridge.heading}
          </h3>
          <div className="mt-4 space-y-3">
            {content.bridge.body.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed md:text-base">
                {p}
              </p>
            ))}
          </div>
          {content.bridge.cta ? (
            <>
              <p className="mt-5 text-sm font-bold leading-relaxed">{content.bridge.cta}</p>
              <a
                href="/#apply"
                onClick={() => window.gtag?.("event", "shindan_to_lp")}
                className="mt-4 inline-block rounded-lg bg-paper px-6 py-3 text-sm font-bold text-accent transition-opacity hover:opacity-90"
              >
                無料トライアルに申し込む
              </a>
            </>
          ) : (
            <a
              href="/"
              className="mt-5 inline-block rounded-lg bg-paper px-6 py-3 text-sm font-bold text-accent transition-opacity hover:opacity-90"
            >
              LPトップへ戻る
            </a>
          )}
        </section>
      )}

      {/* シェア（フルタイプのみ） */}
      {content && (
        <div className="text-center">
          <button
            onClick={share}
            className="rounded-lg border border-line bg-white px-6 py-3 text-sm font-bold text-ink transition-colors hover:border-accent"
          >
            {copied ? "コピーしました" : "結果をコピーする"}
          </button>
        </div>
      )}

      {/* 共通注記（末尾固定） */}
      <div className="space-y-2 border-t border-line pt-6">
        {COMMON_NOTES.map((n, i) => (
          <p key={i} className="text-[11px] leading-relaxed text-ink-soft">
            {n}
          </p>
        ))}
      </div>

      {/* 直接表示（?r=）の場合は設問開始の導線も残す */}
      {directType && (
        <div className="text-center">
          <button
            onClick={() => {
              setStep("intro");
              window.history.replaceState(null, "", "/check");
            }}
            className="text-xs text-ink-soft underline underline-offset-2"
          >
            組織力チェックをはじめる
          </button>
        </div>
      )}
    </div>
  );
}
