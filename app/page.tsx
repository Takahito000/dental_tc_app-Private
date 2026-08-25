"use client";

import { useState, useEffect, useRef } from "react";
import {
  Stethoscope,
  Activity,
  Building2,
  Sparkles,
  FileText,
  MessageSquare,
  Printer,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Bot,
  Send,
} from "lucide-react";

// A4縦 @96dpi: 210mm×297mm ≒ 794×1123px
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

const FORM_DATA = {
  denture_status: ["使っている", "使っていない（初めて）"],
  remaining_teeth: ["ほとんどある", "少しある", "ほとんど無い", "1本もない（無歯顎）"],
  current_denture_complaints: ["痛い", "外れやすい", "噛めない", "見た目が悪い", "話づらい", "その他"],
  denture_duration: ["1年未満", "1〜5年", "5年以上", "該当なし（未使用者）", "不明"],
  adjustment_history: ["調整しても改善しない", "作り直したがダメ", "ほぼ未調整", "該当なし（未使用者）"],
  oral_dryness: ["普通", "乾いている・少ない"],
  ridge_mucosa: ["しっかり", "平坦・やせ・痛みやすい", "不明"],
  emotion_drivers: ["家族と食事", "見た目・審美", "旅行やおでかけ", "会話を楽しむ", "痛みのない生活"],
  expectation_type: ["完璧を求める", "快適なら満足", "現状よりマシになれば良い"],
  cost_sensitivity: ["費用重視", "価値が高ければ許容", "予算上限なし"],
  red_flag_words: ["特になし", "シワを消したい", "絶対に外れない", "何でも噛める"],
};

const LOADING_STEPS = [
  "患者様のお悩み・口腔条件を解析中...",
  "適合する義歯素材・設計プランを選定中...",
  "A4提案シート＆トークカンペを作成中...",
];

type SheetSection = { heading: string; body: string };

function parsePatientSheet(raw: string) {
  const lines = raw.trim().split("\n");
  const title = lines[0]?.replace(/^#+\s*/, "").trim() ?? "【客観分析レポート】お口の治療選択肢の比較";
  const issueLine = lines.find((l) => l.includes("発行日") || l.includes("管理ID")) ?? "";
  const disclaimer = "本シートは一般的な情報提供を目的としたAIによる客観分析であり、診断ではありません。最終的な治療方針は歯科医師にご相談のうえ決定してください。";

  const bodyOnly = raw.replace(/本シートは一般的な情報提供[\s\S]*$/, "");

  const sectionRegex = /■\s*(.+)\n([\s\S]*?)(?=\n■\s|$)/g;
  const sections: SheetSection[] = [];
  let m: RegExpExecArray | null;
  while ((m = sectionRegex.exec(bodyOnly)) !== null) {
    sections.push({ heading: m[1].trim(), body: m[2].trim() });
  }
  return { title, issueLine, sections, disclaimer };
}

const renderInline = (text: string) =>
  text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-blue-900 bg-blue-100 px-1 rounded font-bold">$1</strong>')
    .replace(/\n/g, "<br/>");

// 💡 トークカンペのインライン装飾（全文表示・フォールバック表示で共通利用）
const renderTalkInline = (text: string) =>
  text
    .replace(/### (.*)/g, '<h3 class="font-bold text-amber-900 border-b border-amber-200 pb-1 mt-4 mb-2 text-sm">$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="bg-amber-100 px-1 rounded">$1</strong>');

// 💡 トークカンペ要点表示用パーサー（2026-08-25 表記フォーマット変更対応）
// Dify 2号機の「■ ステップ名／【キーワード】／【心構え】／【全文】」形式を解析する。
// 【キーワード】を1つも含まない旧形式の生成結果は null を返し、全文表示にフォールバックする。
// 【キーワード】を持たないステップ����ステップ0の注意書き等）は raw を保持し、要点表示でも全文を見せる（安全警告を隠さない）。
type TalkKeywordStep = {
  heading: string;
  keywords: string[];
  kokorogamae: string | null;
  raw: string[];
  // 💡 全文ビュー用：見出し・【キーワード】・【心構え】行を除き、【全文】マーカーを剥がした本文
  fullText: string;
};

function parseTalkKeywords(raw: string): { preamble: string; steps: TalkKeywordStep[] } | null {
  if (!raw.includes("【キーワード】")) return null;
  const lines = raw.split("\n");
  const steps: TalkKeywordStep[] = [];
  const preambleLines: string[] = [];
  let current: TalkKeywordStep | null = null;
  const finishStep = (s: TalkKeywordStep): TalkKeywordStep => ({
    ...s,
    fullText: s.raw
      .slice(1)
      .filter((l) => {
        const lt = l.trim();
        return !lt.startsWith("【キーワード】") && !lt.startsWith("【心構え】");
      })
      .join("\n")
      .replace("【全文】", "")
      .trim(),
  });
  for (const line of lines) {
    const t = line.trim();
    if (/^■\s*ステップ/.test(t)) {
      if (current) steps.push(finishStep(current));
      current = { heading: t.replace(/^■\s*/, ""), keywords: [], kokorogamae: null, raw: [line], fullText: "" };
    } else if (current) {
      current.raw.push(line);
      if (t.startsWith("【キーワード】")) {
        current.keywords = t
          .replace("【キーワード】", "")
          .split("／")
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (t.startsWith("【心構え】")) {
        current.kokorogamae = t.replace("【心構え】", "").trim();
      }
      // 【全文】行とその本文は要点表示では使わず、raw から fullText を構築する
    } else {
      preambleLines.push(line);
    }
  }
  if (current) steps.push(finishStep(current));
  return { preamble: preambleLines.join("\n").trim(), steps };
}

const TABLE_COL_WIDTHS = {
  col1: "18%",
  col2: "37%",
  col3: "45%",
};

const cleanTableHtml = (html: string) => {
  let cleaned = html
    .replace(/<colgroup>[\s\S]*?<\/colgroup>/gi, "")
    .replace(/<col[^>]*>/gi, "")
    .replace(/\s(style|width|height|bgcolor|border|cellpadding|cellspacing)="[^"]*"/gi, "");

  const colgroupHtml = `<colgroup><col style="width: ${TABLE_COL_WIDTHS.col1};"><col style="width: ${TABLE_COL_WIDTHS.col2};"><col style="width: ${TABLE_COL_WIDTHS.col3};"></colgroup>`;

  cleaned = cleaned.replace(
    /<table[^>]*>/gi,
    `<table style="table-layout: fixed; width: 100%; border-collapse: collapse;" class="w-full border-2 border-slate-300 text-[12.5px] my-1">${colgroupHtml}`
  );

  // 💡 モデルがデータ行（1列目の行見出しなど）にも <th> を使うと全セルが紺色化する事故への対策：
  //    見出しは先頭の <tr> のみとし、2行目以降の <th> はすべて <td> に変換してからスタイルを適用する
  //    （先読み (?=[\s>]) で <thead> 等の別タグを誤って書き換えないようにする）
  const rowParts = cleaned.split(/(<\/tr>)/gi);
  for (let i = 2; i < rowParts.length; i += 2) {
    rowParts[i] = rowParts[i].replace(/<th(?=[\s>])/gi, "<td").replace(/<\th>/gi, "</td>");
  }
  cleaned = rowParts.join("");

  cleaned = cleaned
    .replace(/<th(?=[\s>])/gi, '<th class="border border-slate-300 p-2 bg-slate-900 text-white text-left font-bold"')
    .replace(/<td(?=[\s>])/gi, '<td class="border border-slate-300 p-2 text-slate-700 leading-normal font-normal"');


  return cleaned;
};

// 💡 エラーの日本語化分類（ユーザーには「見出し＋行動」、サポートには「スクショで読める診断行」を見せる）
type ClassifiedError = {
  kind: "congestion" | "timeout" | "config" | "network" | "other";
  kindLabel: string;
  headline: string;
  guidance: string;
  code: string;
};

function classifyError(raw: string): ClassifiedError {
  const code = raw.match(/\b(\d{3})\b/)?.[1] || "-";
  if (/503|UNAVAILABLE|high demand|overloaded/i.test(raw)) {
    return {
      kind: "congestion",
      kindLabel: "サーバー混雑",
      headline: "AIサーバーが混雑しています",
      guidance: "数分おいてから、もう一度「生成」ボタンを押してください。",
      code,
    };
  }
  if (/504|timeout|timed out|deadline/i.test(raw)) {
    return {
      kind: "timeout",
      kindLabel: "タイムアウト",
      headline: "生成に時間がかか�����います",
      guidance: "もう一度お試しください。",
      code,
    };
  }
  if (/401|403|認証|API key|access_token/i.test(raw)) {
    return {
      kind: "config",
      kindLabel: "接続設定",
      headline: "接続設定に問題があります",
      guidance: "サポートへご連絡ください（利用���院の設定を確認します）。",
      code,
    };
  }
  if (/通信|network|fetch/i.test(raw)) {
    return {
      kind: "network",
      kindLabel: "通信",
      headline: "通信エラーが発生しました",
      guidance: "ネットワーク環境を確認のうえ、もう一度お試しください。",
      code,
    };
  }
  // 既に日本語で書かれた案内（トークン未登録等）はそのまま見せる
  return { kind: "other", kindLabel: "その他", headline: raw, guidance: "", code };
}

export default function Page() {
  const [mounted, setMounted] = useState(false);
  
  // 💡 トークン・医院情報・衛生士名の管理
  const [token, setToken] = useState("");
  const [clinicName, setClinicName] = useState("");
  // 💡 セミナーデモ用トークンかどうか（true の間はメール送信を無効化する）
  const [isDemo, setIsDemo] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [isStandalone, setIsStandalone] = useState(true); // PWA判定（初期true=バナー非表示。マウント後に実判定）

  const [formData, setFormData] = useState({
    denture_status: "使っている",
    remaining_teeth: "ほとんど無い",
    current_denture_complaints: [] as string[],
    denture_duration: "1〜5年",
    adjustment_history: "調整しても改善しない",
    oral_dryness: "普通",
    ridge_mucosa: "しっかり",
    emotion_drivers: ["家族と食事"],
    expectation_type: "快適なら満足",
    cost_sensitivity: "価値が高ければ許容",
    red_flag_words: ["特になし"],
    free_memo: "",
  });

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<{ patientSheet: string; talkScript: string } | null>(null);
  // 💡 生成時に発番される管理ID（医院へ送信のメール本文で使用するため保持する）
  const [patientAnonId, setPatientAnonId] = useState("");
  const [activeTab, setActiveTab] = useState<"patient" | "talk">("patient");
  // 💡 トークカンペの表示モード。チェアサイドで一瞥できる「要点」を初期値にし、学習・時間がある時は「全文」に切替
  const [talkView, setTalkView] = useState<"keyword" | "full">("keyword");
  const [error, setError] = useState<string | null>(null);
  // 💡 エラー発生時刻（スクショ診断用に表示するため記録）
  const [errorAt, setErrorAt] = useState<number | null>(null);
  const showError = (raw: string | null) => {
    setError(raw);
    setErrorAt(raw ? Date.now() : null);
  };
  const [sending, setSending] = useState(false);
  const [printingPdf, setPrintingPdf] = useState(false);

  const previewAreaRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);

  useEffect(() => {
    setMounted(true);
    console.log("[BUILD] 2026-08-25 22:45 table-th-normalize");

    // 1. ?t= パラメータまたは localStorage からトークンをロード
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get("t");
    const savedToken = localStorage.getItem("clinic_access_token");

    const activeToken = urlToken || savedToken || "";
    if (activeToken) {
      setToken(activeToken);
      localStorage.setItem("clinic_access_token", activeToken);

      // 💡 トークンから正式な医院名を引く（患者向けシートに「接続中 (token)」等の
      //    内部表記を絶対に出さないため、解決できた場合のみ state に正式名を入れる）
      const cachedName = localStorage.getItem("clinic_name") || "";
      if (cachedName) setClinicName(cachedName);
      // デモフラグもキャッシュから即時復元（フェッチ完了前の一瞬の誤表示を防ぐ）
      if (localStorage.getItem("clinic_is_demo") === "1") setIsDemo(true);

      fetch(`/api/clinic?t=${encodeURIComponent(activeToken)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.name) {
            setClinicName(d.name);
            localStorage.setItem("clinic_name", d.name);
            const demo = d.is_demo === true;
            setIsDemo(demo);
            if (demo) localStorage.setItem("clinic_is_demo", "1");
            else localStorage.removeItem("clinic_is_demo");
          } else {
            // 未登録トークン：シートには医院名を出さない（画面の接続状況バーで警告表示）
            setClinicName("");
            localStorage.removeItem("clinic_name");
            setIsDemo(false);
            localStorage.removeItem("clinic_is_demo");
          }
        })
        .catch(() => {
          setClinicName("");
          setIsDemo(false);
        });
    } else {
      setClinicName(""); // トークンなし：シートには医院名を出さない
      setIsDemo(false);
    }

    // 2. 担当衛生士名を localStorage から復元
    const savedStaff = localStorage.getItem("staff_name") || "";
    setStaffName(savedStaff);

    // 3. PWA（ホーム画面追加済み）かどうかを判定。未追加なら案内バナーを出す
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true
    );
  }, []);

  useEffect(() => {
    const updateScale = () => {
      if (!previewAreaRef.current) return;
      const availableWidth = previewAreaRef.current.clientWidth - 32;
      setFitScale(Math.min(1, availableWidth / A4_WIDTH_PX));
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [result, activeTab]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  if (!mounted) return null;

  const handleSelect = (key: string, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [key]: value };
      // 💡 未使用者を選んだら、使用年数・調整履歴は自動で「該当なし（未使用者）」に揃える（Dify定義との整合）
      if (key === "denture_status") {
        if (value === "使っていない（初めて）") {
          next.denture_duration = "該当なし（未使用者）";
          next.adjustment_history = "該当なし（未使用者）";
          // 💡 未使用者に現義歯の不満は存在しないため、選択を自動で空にする
          next.current_denture_complaints = [];
        } else {
          if (next.denture_duration === "該当なし（未使用者）") next.denture_duration = "1〜5年";
          if (next.adjustment_history === "該当なし（未使用者）") next.adjustment_history = "調整しても改善しない";
        }
      }
      return next;
    });
  };

  const handleMultiSelect = (key: "current_denture_complaints" | "emotion_drivers" | "red_flag_words", value: string) => {
    setFormData((prev) => {
      const list = prev[key];
      if (value === "特になし") return { ...prev, [key]: ["特になし"] };
      const filteredList = list.filter((item) => item !== "特になし");
      const newList = filteredList.includes(value)
        ? filteredList.filter((item) => item !== value)
        : [...filteredList, value];
      return { ...prev, [key]: newList.length === 0 ? ["特になし"] : newList };
    });
  };

  const handleGenerate = async () => {
    // 💡 未登録トークン・医院未設定では生成を実行しない（ボタン非活性の保険として二重防御）
    if (!(token && clinicName)) {
      showError("医院の接続が確認できません（トークン未登録または未設定）。右上の接続状況を確認してください。");
      return;
    }
    setLoading(true);
    showError(null);
    setResult(null);

    const payload = {
      denture_status: formData.denture_status,
      remaining_teeth: formData.remaining_teeth,
      current_denture_complaints: formData.current_denture_complaints.join(", "),
      denture_duration: formData.denture_duration,
      adjustment_history: formData.adjustment_history,
      oral_dryness: formData.oral_dryness,
      ridge_mucosa: formData.ridge_mucosa,
      emotion_drivers: formData.emotion_drivers.join(", "),
      expectation_type: formData.expectation_type,
      cost_sensitivity: formData.cost_sensitivity,
      red_flag_words: formData.red_flag_words.join(", "),
      free_memo: formData.free_memo || "特になし",
      staffName: staffName.trim(), // 👈 レポートの「担当」欄用（/api/counseling 側で [[STAFF_NAME]] をこの値に置換する）
      token: token, // 👈 医院特定用（usage_logs の clinic_id を動的化するため）
    };

    try {
      const res = await fetch("/api/counseling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setResult({
          patientSheet: data.patientSheet,
          talkScript: data.talkScript,
        });
        setPatientAnonId(data.patientAnonId || "");
      } else {
        showError("AI生成エラー: " + (data.error || "通信エラー"));
      }
    } catch {
      showError("通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  const buildSheetPdfBlob = async (): Promise<Blob | null> => {
    const { toJpeg } = await import("html-to-image");
    const { jsPDF } = await import("jspdf");

    const originalScale = fitScale;
    setFitScale(1);

    // DOMのレイアウト更新を待つ
    // ※「PDFで開く」は新タブがフォーカスを奪うため元タブがバックグラウンド化し、
    //   requestAnimationFrame が停止して永久に解決しない事故が起きる。
    //   setTimeout はバックグラウンドでも発火するため併用し、必ず先に進める。
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      setTimeout(() => resolve(), 300); // フォーカスが外れても300msで必ず進む保険
    });

    const pages = document.querySelectorAll(".sheet-page-portrait");
    if (pages.length === 0) {
      setFitScale(originalScale);
      return null;
    }

    const pdf = new jsPDF("p", "mm", "a4");

    for (let i = 0; i < pages.length; i++) {
      const pageEl = pages[i] as HTMLElement;

      const dataUrl = await toJpeg(pageEl, {
        quality: 0.95,
        pixelRatio: 3,
        backgroundColor: "#ffffff",
        width: A4_WIDTH_PX,
        height: A4_HEIGHT_PX,
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
          margin: "0"
        }
      });

      if (i > 0) pdf.addPage();
      pdf.addImage(dataUrl, "JPEG", 0, 0, 210, 297);
    }

    setFitScale(originalScale);
    return pdf.output("blob");
  };

  // 💡 「A4印刷」ボタン：実績済みのPDF生成エンジンでA4ぴったりのPDFを作り、新しいタブで開く
  //    【重要】新タブを「先に」開く方式は、フォーカスを奪われた元タブがバックグラウンド化し、
  //    生成処理（html-to-image内部のタイマー系処理を含む）が停止する不具合があった。
  //    そのため「フォーカスのある元タブで生成を完了させてから、最後にタブを開く」順序に変更。
  //    ポップアップがブロックされた場合はPDFダウンロードに自動フォールバックする。
  const handleOpenPrintPdf = async () => {
    setPrintingPdf(true);
    try {
      const pdfBlob = await buildSheetPdfBlob(); // ← 元タブがフォーカスを持つ間に生成を完結させる
      if (!pdfBlob) {
        alert("PDF化する領域が見つかりません。先にシートを生成してください。");
        return;
      }
      const url = URL.createObjectURL(pdfBlob);
      const win = window.open(url, "_blank");
      if (!win) {
        // ポップアップブロック時はダウンロードにフォールバック
        const a = document.createElement("a");
        a.href = url;
        a.download = "counseling-sheet.pdf";
        a.click();
        alert("新しいタブがブロックされたため、PDFをダウンロードしました。ダウンロードしたPDFを開いて印刷してください。");
      }
    } catch (err: any) {
      alert("PDF生成でエラーが発生しました。詳細: " + err.message);
    } finally {
      setPrintingPdf(false);
    }
  };

  // 💡 動的トークンと衛生士名を伴う送信処理
  const handleSendPrint = async () => {
    if (!token) {
      alert("医院トークンが未設定です。?t=トークン 付きURLからアクセスしてください。");
      return;
    }
    // 💡 デモトークンからのメール送信は拒否（ボタン非表示の保険として二重防御）
    if (isDemo) {
      alert("デモ版ではメール送信はご利用いただけません。");
      return;
    }

    setSending(true);
    try {
      const pdfBlob = await buildSheetPdfBlob();
      if (!pdfBlob) {
        alert("PDF化する領域が見つかりません。");
        setSending(false);
        return;
      }

      const currentStaff = staffName.trim() || "担当衛生士";
      localStorage.setItem("staff_name", currentStaff);

      const sendData = new FormData();
      sendData.append("access_token", token); // 👈 動的トークン
      sendData.append("staff_name", currentStaff); // 👈 衛生士名
      sendData.append("clinic_name", clinicName);
      // 💡 生成時���Supabaseが発番した本物の管理IDを送る（固定値 "A101" は初期テストの残滓で、メール本文の患者IDが常にA101になる原因だった）
      sendData.append("patient_anon_id", patientAnonId || "");
      sendData.append("pdfFile", pdfBlob, "sheet.pdf");

      const res = await fetch("/api/print", {
        method: "POST",
        body: sendData,
      });

      const data = await res.json();
      if (data.success) {
        alert("PDFの送信が完了しました！メールを確認してください。");
      } else {
        alert("送信失敗: " + data.error);
      }
    } catch (err: any) {
      alert("通信エラーが発生しました。詳細: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const cleanClinicName = clinicName.replace(/様$/, "");

  // 💡 カンペが新フォーマット（【キーワード】併記）かどうか。旧形式の生���結果では切替ボタン自体を出さない
  const talkKeywordAvailable = result ? result.talkScript.includes("【キーワード】") : false;

  // 💡 生成結果の構造異常を検知（表示崩れの自救導線。再生成で治るケースをユーザーが判断できるようにする）
  const resultSuspicious = (() => {
    if (!result) return false;
    const talkBroken = !result.talkScript || !result.talkScript.includes("■");
    // 💡 慎重モード（要注意ワードが選択されている）では比較表を出さないのが正しい動作のため、表の欠落は異常とみなさない
    const cautiousInput = formData.red_flag_words.some((w: string) => w !== "特になし");
    const sheet = parsePatientSheet(result.patientSheet);
    const tableMissing = !cautiousInput && !sheet.sections.some((s) => s.body.includes("<table"));
    return talkBroken || tableMissing;
  })();

  // 💡 A4から内容がはみ出した時だけ中身を自動縮小（高齢者向けの大きめ文字は維持し、はみ出し分だけ縮める）
  const fitContentToA4 = (el: HTMLDivElement | null) => {
    if (!el) return;
    el.style.zoom = "1";
    const available = A4_HEIGHT_PX - 91; // 上下の余白（12mm≒45px×2）を差し引いた利用可能な高さ
    const measured = el.scrollHeight;
    if (measured > available) {
      el.style.zoom = String(Math.max(0.7, available / measured));
    }
  };

  const A4PageWrapper = ({ children, isLast }: { children: React.ReactNode, isLast?: boolean }) => (
    <div 
      className="print-wrapper" 
      style={{ width: A4_WIDTH_PX * fitScale, height: A4_HEIGHT_PX * fitScale }}
    >
      <div
        className={`sheet-page-portrait bg-white shadow-md border border-slate-300 flex flex-col relative ${
          isLast ? "print:break-after-auto" : "print:break-after-page"
        }`}
        style={{
          width: `${A4_WIDTH_PX}px`,
          height: `${A4_HEIGHT_PX}px`,
          transform: `scale(${fitScale})`,
          transformOrigin: "top left",
          padding: "12mm",
          boxSizing: "border-box",
          overflow: "hidden"
        }}
      >
        <div ref={fitContentToA4} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {children}
        </div>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-100 font-sans text-slate-800">
      <style dangerouslySetInnerHTML={{ __html: `
        .sheet-page-portrait table {
          table-layout: fixed !important;
          width: 100% !important;
        }

        .sheet-page-portrait {
          width: 100%;
          max-width: 794px;
          min-height: 1123px;
          margin: 0 auto;
          background-color: #ffffff;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-sizing: border-box;
        }

        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
          .no-print {
            display: none !important;
          }

          html, body, main, .app-layout, .print-area {
            margin: 0 !important;
            padding: 0 !important;
            background-color: #ffffff !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }

          .print-wrapper {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }

          .sheet-page-portrait {
            transform: none !important;
            width: 210mm !important;
            height: auto !important;
            min-height: 297mm !important;
            padding: 12mm !important;
            box-sizing: border-box !important;
            overflow: visible !important;
            border: none !important;
            box-shadow: none !important;
            margin: 0 auto !important;
            
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .print-wrapper:last-child .sheet-page-portrait,
          .sheet-page-portrait:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      ` }} />

      <header className="no-print bg-white border-b border-slate-200 text-slate-900 py-3.5 px-6 shadow-sm">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 border border-blue-600 shadow-sm">
              <Stethoscope className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-wide">デンピストAI</h1>
              <p className="text-xs text-slate-500 hidden sm:block">Denpist AI｜AI自費義歯カウンセリング支援</p>
            </div>
          </div>
          {/* 💡 医院名はこの接続状況ピルに集約（旧ヘッダーバッジ・フォーム見出しバッジ���重複表示を廃止）。「衛生士モード」表記は他モードがある誤解を招くため廃止。担当衛生士名はシートの「担当」に印字されるためモバイルでも表示必須 */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border shadow-xs ${
              token && clinicName
                ? "bg-blue-50 border-blue-200"
                : "bg-rose-50 border-rose-300"
            }`}>
              <Building2 className={`h-4 w-4 ${token && clinicName ? "text-blue-600" : "text-rose-600"}`} />
              <span className={`text-xs font-bold ${token && clinicName ? "text-blue-900" : "text-rose-700"}`}>
                {token
                  ? clinicName
                    ? `接続OK: ${clinicName}${isDemo ? "（デモ）" : ""}`
                    : "トークン未登録"
                  : "医院未設定"}
              </span>
            </div>
            <input
              type="text"
              value={staffName}
              onChange={(e) => {
                setStaffName(e.target.value);
                localStorage.setItem("staff_name", e.target.value);
              }}
              placeholder="担当衛生士名"
              title="シートの「担当」に印字されます"
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 w-24 sm:w-32 focus:outline-none focus:border-blue-500 shadow-xs"
            />
          </div>
        </div>
      </header>

      {/* 📱 PWA案内バナー（ホーム画面未追加かつ医院接続済みの時だけ表示。印刷・PDFには含まれない） */}
      {!isStandalone && token && (
        <div className="no-print max-w-[1600px] mx-auto px-4 md:px-6 pt-4">
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 shadow-xs">
            📱 <b>この画面のまま「ホーム画面に追加」</b>すると、次回からアイコン1タップで医院モードのまま起動できます（iPhone: 共有ボタン →「ホーム画面に追加」／ Android: メニュー →「ホーム画面に追加」）
          </div>
        </div>
      )}

      <div className="app-layout mx-auto grid max-w-[1600px] grid-cols-1 gap-6 p-4 md:p-6 lg:grid-cols-[400px_1fr]">
        <section className="no-print space-y-3 h-fit">
          <div className="flex justify-between items-center bg-white rounded-2xl shadow-md border border-slate-200 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="text-blue-600" size={18} />
              患者条件の入力
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            {/* 1. 入れ歯の使用状況 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <label className="block font-bold mb-1.5 text-slate-700 text-sm tracking-wide">1. 入れ歯の使用状況</label>
              <div className="flex gap-1.5">
                {FORM_DATA.denture_status.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleSelect("denture_status", item)}
                    className={`flex-1 py-2.5 px-2 min-h-[44px] rounded-lg border font-medium transition text-center ${
                      formData.denture_status === item
                        ? "bg-blue-600 text-white border-blue-600 shadow-md"
                        : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. 残っている歯 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <label className="block font-bold mb-1.5 text-slate-700 text-sm tracking-wide">2. 残っている歯</label>
              <div className="grid grid-cols-2 gap-1.5">
                {FORM_DATA.remaining_teeth.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleSelect("remaining_teeth", item)}
                    className={`flex-1 py-2.5 px-2 min-h-[44px] rounded-lg border font-medium transition text-center ${
                      formData.remaining_teeth === item
                        ? "bg-blue-600 text-white border-blue-600 shadow-md"
                        : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. 使用年数 & 4. 調整履歴 */}
            <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div>
                <label className="block font-bold mb-1.5 text-slate-700 text-sm tracking-wide">3. 現義歯の使用年数</label>
                <select
                  value={formData.denture_duration}
                  onChange={(e) => handleSelect("denture_duration", e.target.value)}
                  className="w-full p-2.5 border rounded-lg bg-white border-slate-300 text-base shadow-xs focus:border-blue-500 focus:outline-none transition"
                >
                  {FORM_DATA.denture_duration
                    .filter((d) =>
                      formData.denture_status === "使っていない（初めて）"
                        ? d === "該当なし（未使用者）"
                        : d !== "該当なし（未使用者）"
                    )
                    .map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1.5 text-slate-700 text-sm tracking-wide">4. 調整・履歴</label>
                <select
                  value={formData.adjustment_history}
                  onChange={(e) => handleSelect("adjustment_history", e.target.value)}
                  className="w-full p-2.5 border rounded-lg bg-white border-slate-300 text-base shadow-xs focus:border-blue-500 focus:outline-none transition"
                >
                  {FORM_DATA.adjustment_history
                    .filter((h) =>
                      formData.denture_status === "使っていない（初めて）"
                        ? h === "該当なし（未使用者）"
                        : h !== "該当なし（未使用者）"
                    )
                    .map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                </select>
              </div>
            </div>

            {/* 5. 口の乾き & 6. 顎堤・粘膜の状態 */}
            <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div>
                <label className="block font-bold mb-1.5 text-slate-700 text-sm tracking-wide">5. 口の乾き・唾液</label>
                <select
                  value={formData.oral_dryness}
                  onChange={(e) => handleSelect("oral_dryness", e.target.value)}
                  className="w-full p-2.5 border rounded-lg bg-white border-slate-300 text-base shadow-xs focus:border-blue-500 focus:outline-none transition"
                >
                  {FORM_DATA.oral_dryness.map((od) => (
                    <option key={od} value={od}>{od}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1.5 text-slate-700 text-sm tracking-wide">6. 顎堤・粘膜の状態</label>
                <select
                  value={formData.ridge_mucosa}
                  onChange={(e) => handleSelect("ridge_mucosa", e.target.value)}
                  className="w-full p-2.5 border rounded-lg bg-white border-slate-300 text-base shadow-xs focus:border-blue-500 focus:outline-none transition"
                >
                  {FORM_DATA.ridge_mucosa.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 7. 期待値タイプ */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <label className="block font-bold mb-1.5 text-slate-700 text-sm tracking-wide">7. 期待値タイプ</label>
              <select
                value={formData.expectation_type}
                onChange={(e) => handleSelect("expectation_type", e.target.value)}
                className="w-full p-2.5 border rounded-lg bg-white border-slate-300 text-base shadow-xs focus:border-blue-500 focus:outline-none transition"
              >
                {FORM_DATA.expectation_type.map((ex) => (
                  <option key={ex} value={ex}>{ex}</option>
                ))}
              </select>
            </div>

            {/* 8. 費用感度 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <label className="block font-bold mb-1.5 text-slate-700 text-sm tracking-wide">8. 費用感度</label>
              <div className="flex gap-1.5">
                {FORM_DATA.cost_sensitivity.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleSelect("cost_sensitivity", item)}
                    className={`flex-1 py-2.5 px-1 min-h-[44px] rounded-lg border font-medium transition text-center text-[11px] ${
                      formData.cost_sensitivity === item
                        ? "bg-blue-600 text-white border-blue-600 shadow-md"
                        : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* 9. 現義歯の主な不満 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <label className="block font-bold mb-1.5 text-slate-700 text-sm tracking-wide">9. 現義歯の主な不満（複数可）</label>
              <div className="flex flex-wrap gap-1.5">
                {FORM_DATA.current_denture_complaints.map((item) => {
                  const isActive = formData.current_denture_complaints.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleMultiSelect("current_denture_complaints", item)}
                      className={`py-2 px-3 min-h-[44px] rounded-md border text-xs transition ${
                        isActive
                          ? "bg-blue-600 text-white border-blue-600 font-bold shadow-md"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 10. 追求したい情緒価値 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <label className="block font-bold mb-1.5 text-slate-700 text-sm tracking-wide">10. 追求したい情緒価値（複数可）</label>
              <div className="flex flex-wrap gap-1.5">
                {FORM_DATA.emotion_drivers.map((item) => {
                  const isActive = formData.emotion_drivers.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleMultiSelect("emotion_drivers", item)}
                      className={`py-2 px-3 min-h-[44px] rounded-md border text-xs transition ${
                        isActive
                          ? "bg-blue-600 text-white border-blue-600 font-bold shadow-md"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 11. 要注意ワード */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <label className="block font-bold mb-1.5 text-slate-700 text-sm tracking-wide">11. 要注意ワード（慎重モード）</label>
              <div className="flex flex-wrap gap-1.5">
                {FORM_DATA.red_flag_words.map((item) => {
                  const isActive = formData.red_flag_words.includes(item);
                  const isRose = item !== "特になし";
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleMultiSelect("red_flag_words", item)}
                      className={`py-2 px-3 min-h-[44px] rounded-md border text-xs transition ${
                        isActive
                          ? isRose
                            ? "bg-rose-50 text-rose-700 border-rose-600 font-bold shadow-sm"
                            : "bg-slate-700 text-white border-slate-700 font-bold shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 12. 現場メモ */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <label className="block font-bold mb-1.5 text-slate-700 text-sm tracking-wide">12. 現場メモ（任意）</label>
              <input
                type="text"
                value={formData.free_memo}
                onChange={(e) => setFormData({ ...formData, free_memo: e.target.value })}
                placeholder="家族の同席希望、持病など"
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-base shadow-xs focus:border-blue-500 focus:outline-none transition"
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !(token && clinicName)}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-base flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {loading ? (
              <span className="flex items-center gap-2 animate-pulse">
                <Sparkles size={18} /> {LOADING_STEPS[loadingStep]}
              </span>
            ) : (
              <>
                <FileText size={18} /> カウンセリングシート生成
              </>
            )}
          </button>
          {!(token && clinicName) && (
            <p className="no-print mt-2 text-xs text-rose-600 font-bold text-center">
              ⚠️ 医院の接続が確認できないため生成できません（右上の接続状況を確認してください）
            </p>
          )}
          {/* 💡 表示崩れの自救導線：スマホではこの直下にレポートが来るためここに常設。構造異常を検知した時は強調表示に切替 */}
          {resultSuspicious ? (
            <p className="no-print mt-2 text-xs font-bold text-center text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
              ⚠️ この結果は表示が崩れている可能性があります。「生成」をもう一度押すと改善します
            </p>
          ) : (
            <p className="no-print mt-2 text-[11px] text-slate-400 text-center">
              内容や表示が正しくない場合は、もう一度「生成」を押してください（同じ条件で生成し直されます）
            </p>
          )}
        </section>

        {/* 右カラム：プレビュー */}
        <section aria-label="プレビュー領域" className="print-area h-full flex flex-col">
          {error && (() => {
            const ce = classifyError(error);
            // 分類不能（既に日本語化済みの案内）は従来表示のまま
            if (ce.kind === "other") {
              return (
                <div className="no-print mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold">
                  {ce.headline}
                </div>
              );
            }
            const at = errorAt
              ? new Date(errorAt).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
              : "";
            return (
              <div className="no-print mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-lg">
                <p className="text-sm font-bold text-rose-700 flex items-center gap-1.5">
                  <AlertTriangle size={15} /> {ce.headline}
                </p>
                <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                  {ce.guidance}繰り返し失敗する場合は、この画面のスクリーンショットをサポートへお送りください。
                </p>
                <p className="text-[11px] text-rose-400 mt-1.5 font-mono">
                  コード: {ce.code} ／ 種別: {ce.kindLabel}{at ? ` ／ 発生: ${at}` : ""}
                </p>
              </div>
            );
          })()}

          {result ? (
            <div className="bg-white p-5 rounded-2xl shadow-md border border-slate-200 flex flex-col h-full">
              <div className="no-print flex justify-between items-center border-b pb-3 mb-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab("patient")}
                    className={`py-2 px-3 sm:px-4 min-h-[44px] justify-center font-bold text-xs transition flex items-center gap-1.5 ${
                      activeTab === "patient"
                        ? "text-blue-700 border-b-2 border-blue-600"
                        : "text-slate-500 hover:text-slate-900 border-b-2 border-transparent"
                    }`}
                  >
                    <FileText size={16} /> <span className="hidden sm:inline">A4提案シート (患者用)</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("talk")}
                    className={`py-2 px-3 sm:px-4 min-h-[44px] justify-center font-bold text-xs transition flex items-center gap-1.5 ${
                      activeTab === "talk"
                        ? "text-amber-700 border-b-2 border-amber-500"
                        : "text-slate-500 hover:text-slate-900 border-b-2 border-transparent"
                    }`}
                  >
                    <MessageSquare size={16} /> <span className="hidden sm:inline">トークカンペ (画面専用)</span>
                  </button>
                </div>

                {activeTab === "patient" && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleOpenPrintPdf}
                      disabled={printingPdf}
                      className="py-2 px-4 min-h-[44px] justify-center bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold rounded-lg text-xs transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      <Printer size={16} /> <span className="hidden sm:inline">{printingPdf ? "PDF生成中..." : "A4印刷（PDFで開く）"}</span>
                    </button>
                    {isDemo ? (
                      <span className="py-2 px-3 min-h-[44px] flex items-center text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-lg">
                        デモ版：メール送信は利用できません
                      </span>
                    ) : (
                      <button
                        onClick={handleSendPrint}
                        disabled={sending}
                        className="py-2 px-4 min-h-[44px] justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition flex items-center gap-1.5 shadow disabled:opacity-50"
                      >
                        <Send size={16} /> <span className="hidden sm:inline">{sending ? "送信中..." : "印刷（医院へ送信）"}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* 💡 カンペ表示切替（チェアサイド=要点／学習=全文）。患者タブの印刷ボタンと対称の位置。新フォーマットの生成結果でのみ表示 */}
                {activeTab === "talk" && talkKeywordAvailable && (
                  <div className="flex gap-1.5 items-center">
                    <button
                      onClick={() => setTalkView("keyword")}
                      className={`py-2 px-3 min-h-[44px] rounded-lg border text-xs font-bold transition ${talkView === "keyword" ? "bg-amber-500 text-white border-amber-500 shadow-sm" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}
                    >
                      要点
                    </button>
                    <button
                      onClick={() => setTalkView("full")}
                      className={`py-2 px-4 min-h-[44px] rounded-lg border text-xs font-bold transition ${talkView === "full" ? "bg-amber-500 text-white border-amber-500 shadow-sm" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}
                    >
                      全文
                    </button>
                  </div>
                )}
              </div>

              <div ref={previewAreaRef} className="flex-1 overflow-auto bg-slate-200 p-4 rounded-xl border border-slate-300 flex flex-col items-center gap-6">
                {activeTab === "patient" && (() => {
                  const sheet = parsePatientSheet(result.patientSheet);
                  const intro = sheet.sections.find((s) => s.heading.includes("悩み"));
                  // 💡 慎重モードでは「知っておいていただきたいこと」がこの枠に入る（比較表・おすすめを出さない代わりの本文セクション）
                  const recommend = sheet.sections.find((s) => s.heading.includes("おすすめ") || s.heading.includes("知っておいて"));
                  const tableSection = sheet.sections.find((s) => s.body.includes("<table"));
                  // 💡 慎重モードでは「次のステップについて」がこの枠に入る（2ページ目の描画条件を満たす役割も兼ねる）
                  const prosCons = sheet.sections.find((s) => s.heading.includes("良い点") || s.heading.includes("注意点") || s.heading.includes("次のステップ"));
                  const costSection = sheet.sections.find((s) => s.heading.includes("費用"));

                  const Header = () => (
                    <div className="rounded-xl bg-white border border-slate-200 border-b-2 border-b-slate-800 px-4 py-3 text-slate-900 shadow-sm mb-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <h1 className="text-[17px] font-bold tracking-wide">{sheet.title}</h1>
                          <div className="text-[8px] tracking-[0.25em] text-blue-600 font-semibold mt-0.5">AI OBJECTIVE ANALYSIS</div>
                        </div>
                        <div className="text-right text-[10.5px] opacity-90 leading-tight shrink-0">
                          {cleanClinicName && (
                            <div className="font-semibold">{cleanClinicName}</div>
                          )}
                          <div className="text-[9px] text-slate-500 mt-0.5 space-y-0.5">
                            {sheet.issueLine
                              .replace(/:\s*/g, ":")
                              .split(/[ \s]+/)
                              .filter(Boolean)
                              .map((item, index) => (
                                <div key={index}>{item}</div>
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );

                  const Footer = () => (
                    <div className="mt-auto border-t border-slate-300 pt-2 text-center text-[10px] text-slate-600 leading-relaxed">
                      {sheet.disclaimer}
                    </div>
                  );

                  // 💡 比較表がないシート（慎重モード）は内容が1ページに収まるため単ページで描画する（2ページ目が余白だらけになるのを防ぐ）
                  const singlePageSheet = !tableSection;

                  return (
                    <>
                      {/* PAGE 1 */}
                      <A4PageWrapper isLast={singlePageSheet}>
                        <Header />
                        {intro && (
                          <div className="flex items-start gap-2 mb-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-blue-500 bg-blue-50 text-blue-600 shadow-sm">
                              <Bot size={25} />
                            </div>
                            <div
                              className="relative flex-1 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-[14px] leading-relaxed text-slate-800"
                              dangerouslySetInnerHTML={{ __html: renderInline(intro.body) }}
                            />
                          </div>
                        )}
                        {recommend && (
                          <div className="rounded-xl border border-slate-200 bg-white p-3 mb-2">
                            <div className="flex items-center gap-1 border-l-4 border-blue-600 pl-1.5 text-[15px] font-bold text-slate-900 mb-1">
                              <CheckCircle2 size={14} className="text-blue-600" />
                              {recommend.heading}
                            </div>
                            <div
                              className="text-[13.5px] leading-relaxed text-slate-800"
                              dangerouslySetInnerHTML={{ __html: renderInline(recommend.body) }}
                            />
                          </div>
                        )}
                        {tableSection && (
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="flex items-center gap-1 border-l-4 border-blue-600 pl-1.5 text-[15px] font-bold text-slate-900 mb-1">
                              <Sparkles size={14} className="text-amber-500" />
                              {tableSection.heading}
                            </div>
                            {/* 💡 overflow-x-auto を除去：PDF生成（html-to-image）は @media print を読まず、
                                overflow付き要素がスクロールコンテナ化してスクロールバーが画像に焼き付く上、
                                flex内で高さが縮み内容が隠れる（自動縮小の計測も狂う）ため。table-layout:fixed のため除去しても横にはみ出さない */}
                            <div
                              dangerouslySetInnerHTML={{ __html: cleanTableHtml(tableSection.body) }}
                            />
                          </div>
                        )}
                        {singlePageSheet && prosCons && (
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="flex items-center gap-1 border-l-4 border-blue-600 pl-1.5 text-[15px] font-bold text-slate-900 mb-1">
                              <CheckCircle2 size={14} className="text-blue-600" />
                              {prosCons.heading}
                            </div>
                            <div
                              className="text-[13.5px] leading-relaxed text-slate-800"
                              dangerouslySetInnerHTML={{ __html: renderInline(prosCons.body) }}
                            />
                          </div>
                        )}
                        <Footer />
                      </A4PageWrapper>

                      {/* PAGE 2 */}
                      {!singlePageSheet && (prosCons || costSection) && (
                        <A4PageWrapper isLast>
                          <Header />
                          <div className="grid grid-cols-1 gap-2.5">
                            {prosCons && (
                              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                                <div className="flex items-center gap-1 border-l-4 border-blue-600 pl-1.5 text-[15px] font-bold text-slate-900 mb-1">
                                  <AlertTriangle size={14} className="text-rose-500" />
                                  {prosCons.heading}
                                </div>
                                <div
                                  className="text-[13.5px] leading-loose text-slate-800"
                                  dangerouslySetInnerHTML={{ __html: renderInline(prosCons.body) }}
                                />
                              </div>
                            )}
                            {costSection && (
                              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                                <div className="flex items-center gap-1 border-l-4 border-blue-600 pl-1.5 text-[15px] font-bold text-slate-900 mb-1">
                                  <Sparkles size={14} className="text-blue-600" />
                                  {costSection.heading}
                                </div>
                                <div
                                  className="text-[13.5px] leading-loose text-slate-800"
                                  dangerouslySetInnerHTML={{ __html: renderInline(costSection.body) }}
                                />
                              </div>
                            )}
                          </div>
                          <Footer />
                        </A4PageWrapper>
                      )}
                    </>
                  );
                })()}

                {/* トークカンペ（要点⇄全文 切替対応） */}
                {activeTab === "talk" && (() => {
                  // 新フォーマット（【キーワード】あり）は要点・全文ともにカード表示。旧形式は従来のプレーン表示にフォールバック
                  const parsed = parseTalkKeywords(result.talkScript);
                  const kwData = talkView === "keyword" ? parsed : null;
                  return (
                    <div className="no-print bg-amber-50/80 p-5 rounded-xl border border-amber-200 w-full max-w-3xl">
                      <div className="bg-amber-100 text-amber-900 p-3 rounded-lg text-xs font-bold flex items-center gap-2 mb-4 border border-amber-300">
                        <AlertTriangle size={16} /> 患者様には見せないでください（衛生士専用トークガイド））
                      </div>
                      {kwData ? (
                        <div className="space-y-3">
                          {kwData.preamble && (
                            <div
                              className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap"
                              dangerouslySetInnerHTML={{ __html: renderTalkInline(kwData.preamble) }}
                            />
                          )}
                          {kwData.steps.map((step, i) => (
                            <div key={i} className="bg-white rounded-lg border border-amber-200 p-3 shadow-xs">
                              <h3 className="font-bold text-amber-900 text-sm mb-2">{step.heading}</h3>
                              {step.keywords.length > 0 ? (
                                <ul className="space-y-1.5">
                                  {step.keywords.map((kw, j) => (
                                    <li key={j} className="text-sm font-bold text-slate-800 flex items-start gap-1.5 leading-snug">
                                      <span className="text-amber-500 shrink-0">◆</span>
                                      <span>{kw}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div
                                  className="text-xs leading-relaxed text-slate-700 space-y-4 whitespace-pre-wrap"
                                  dangerouslySetInnerHTML={{ __html: renderTalkInline(step.fullText) }}
                                />
                              )}
                              {step.kokorogamae && (
                                <div className="mt-2.5 text-xs bg-blue-50 border border-blue-200 text-blue-900 rounded-lg p-2.5 leading-relaxed font-medium">
                                  💡 {step.kokorogamae}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : parsed ? (
                        <div className="space-y-3">
                          {parsed.preamble && (
                            <div
                              className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap"
                              dangerouslySetInnerHTML={{ __html: renderTalkInline(parsed.preamble) }}
                            />
                          )}
                          {parsed.steps.map((step, i) => (
                            <div key={i} className="bg-white rounded-lg border border-amber-200 p-3.5 shadow-xs">
                              <h3 className="font-bold text-amber-900 text-sm border-b border-amber-200 pb-1.5 mb-2">{step.heading}</h3>
                              {step.keywords.length > 0 && (
                                <div className="text-[11px] text-slate-500 mb-2">
                                  <span className="font-bold text-amber-700">キーワード：</span>
                                  {step.keywords.join("／")}
                                </div>
                              )}
                              {step.kokorogamae && (
                                <div className="mb-2.5 text-xs bg-blue-50 border border-blue-200 text-blue-900 rounded-lg p-2.5 leading-relaxed font-medium">
                                  💡 {step.kokorogamae}
                                </div>
                              )}
                              {step.fullText && (
                                <div
                                  className="text-[13px] leading-loose text-slate-700 whitespace-pre-wrap"
                                  dangerouslySetInnerHTML={{ __html: renderTalkInline(step.fullText) }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div
                          className="text-xs leading-relaxed text-slate-700 space-y-4 whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{ __html: renderTalkInline(result.talkScript) }}
                        />
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="no-print flex-1 flex flex-col items-center justify-center text-slate-400 gap-3 border-2 border-dashed border-slate-200 rounded-xl bg-white p-8">
              <FileText size={48} className="opacity-20 text-slate-600" />
              <p className="text-xs font-medium text-slate-500">条件を選択して「カウンセリングシート生成」を押してください</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}