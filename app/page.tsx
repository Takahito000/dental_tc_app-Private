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
  remaining_teeth: ["ほとんどある", "少しある", "ほとんど無い"],
  current_denture_complaints: ["痛い", "外れやすい", "噛めない", "見た目が悪い", "話づらい", "その他"],
  denture_duration: ["1年未満", "1〜5年", "5年以上"],
  adjustment_history: ["調整しても改善しない", "最近作ったが合わない", "何回も作り直している", "特になし"],
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
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-sky-900 bg-sky-100 px-1 rounded font-bold">$1</strong>')
    .replace(/\n/g, "<br/>");

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
    `<table style="table-layout: fixed; width: 100%; border-collapse: collapse;" class="w-full border-2 border-slate-300 text-[11.5px] my-1">${colgroupHtml}`
  );

  cleaned = cleaned
    .replace(/<th/gi, '<th class="border border-slate-300 p-1 bg-slate-900 text-white text-left font-bold"')
    .replace(/<td/gi, '<td class="border border-slate-300 p-1 text-slate-700 leading-tight font-normal"');

  cleaned = cleaned.replace(/<tr[^>]*>[\s\S]*?<\/(th|td)>/gi, (match) => {
    return match.replace(/<(th|td)/, '<$1 style="white-space: nowrap;"');
  });

  return cleaned;
};

export default function Page() {
  const [mounted, setMounted] = useState(false);
  
  // 💡 トークン・医院情報・衛生士名の管理
  const [token, setToken] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [staffName, setStaffName] = useState("");

  const [formData, setFormData] = useState({
    denture_status: "使っている",
    remaining_teeth: "ほとんど無い",
    current_denture_complaints: ["痛い"],
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
  const [activeTab, setActiveTab] = useState<"patient" | "talk">("patient");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [printingPdf, setPrintingPdf] = useState(false);

  const previewAreaRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);

  useEffect(() => {
    setMounted(true);
    console.log("[BUILD] 2026-08-20 17:00 dynamic-clinic-log");

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

      fetch(`/api/clinic?t=${encodeURIComponent(activeToken)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.name) {
            setClinicName(d.name);
            localStorage.setItem("clinic_name", d.name);
          } else {
            // 未登録トークン：シートには医院名を出さない（画面の接続状況バーで警告表示）
            setClinicName("");
            localStorage.removeItem("clinic_name");
          }
        })
        .catch(() => setClinicName(""));
    } else {
      setClinicName(""); // トークンなし：シートには医院名を出さない
    }

    // 2. 担当衛生士名を localStorage から復元
    const savedStaff = localStorage.getItem("staff_name") || "";
    setStaffName(savedStaff);
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
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleMultiSelect = (key: "current_denture_complaints" | "emotion_drivers" | "red_flag_words", value: string) => {
    setFormData((prev) => {
      const list = prev[key];
      if (value === "特になし") return { ...prev, [key]: ["特���なし"] };
      const filteredList = list.filter((item) => item !== "特になし");
      const newList = filteredList.includes(value)
        ? filteredList.filter((item) => item !== value)
        : [...filteredList, value];
      return { ...prev, [key]: newList.length === 0 ? ["特になし"] : newList };
    });
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
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
      } else {
        setError("AI生成エラー: " + (data.error || "通信エラー"));
      }
    } catch {
      setError("通信エラーが発生しました。");
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
        quality: 0.85,
        pixelRatio: 2,
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
      sendData.append("patient_anon_id", "A101");
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
        {children}
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
            height: 297mm !important;
            max-height: 297mm !important;
            padding: 12mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
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

      <header className="no-print bg-slate-900 border-b border-slate-800 text-white py-3.5 px-6 shadow-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/20 border border-sky-400/30">
              <Stethoscope className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-wide">AI自費義歯カウンセリング支援</h1>
              <p className="text-xs text-slate-400">Dental Treatment Coordinator Suite</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 border border-slate-700">
              <Building2 className="h-4 w-4 text-sky-400" />
              <span className="text-xs font-bold text-white">{clinicName || "CS.lab"}</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 border border-white/10">
              <Activity className="h-3.5 w-3.5 text-sky-400" />
              <span className="text-xs font-medium text-slate-200">衛生士モード</span>
            </div>
          </div>
        </div>
      </header>

      {/* 🏥 接続状況＆担当衛生士名入力バー（モバイル・PC共通） */}
      <div className="no-print max-w-[1600px] mx-auto px-4 md:px-6 pt-4">
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex flex-wrap justify-between items-center gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-sky-600" />
            <span className="text-xs text-slate-500">接続状況:</span>
            <span className={`text-xs font-bold ${token && clinicName ? "text-blue-900" : "text-rose-600"}`}>
              {token
                ? clinicName
                  ? `接続OK: ${clinicName}`
                  : `未登録のトークンです（${token}）— Supabaseのclinicsに登録してください`
                : "医院未設定（?t=トークン付きURLからアクセスしてください）"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600 font-bold">担当衛生士名:</label>
            <input
              type="text"
              value={staffName}
              onChange={(e) => {
                setStaffName(e.target.value);
                localStorage.setItem("staff_name", e.target.value);
              }}
              placeholder="お名前を入力"
              className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-medium text-slate-800 w-36 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      <div className="app-layout mx-auto grid max-w-[1600px] grid-cols-1 gap-6 p-4 md:p-6 lg:grid-cols-[400px_1fr]">
        <section className="no-print space-y-4 bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-fit">
          <div className="flex justify-between items-center border-b pb-3">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="text-sky-600" size={18} />
              患者条件の入力
            </h2>
            <span className="text-xs bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-md border border-slate-200">
              {cleanClinicName}
            </span>
          </div>

          <div className="space-y-3.5 text-xs">
            {/* 1. 入れ歯の使用状況 */}
            <div>
              <label className="block font-bold mb-1 text-slate-600">1. 入れ歯の使用状況</label>
              <div className="flex gap-1.5">
                {FORM_DATA.denture_status.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleSelect("denture_status", item)}
                    className={`flex-1 py-1.5 px-2 rounded-lg border font-medium transition text-center ${
                      formData.denture_status === item
                        ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. 残っている歯 */}
            <div>
              <label className="block font-bold mb-1 text-slate-600">2. 残っている歯</label>
              <div className="flex gap-1.5">
                {FORM_DATA.remaining_teeth.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleSelect("remaining_teeth", item)}
                    className={`flex-1 py-1.5 px-2 rounded-lg border font-medium transition text-center ${
                      formData.remaining_teeth === item
                        ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. 使用年数 & 4. 調整履歴 */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold mb-1 text-slate-600">3. 現義歯の使用年数</label>
                <select
                  value={formData.denture_duration}
                  onChange={(e) => handleSelect("denture_duration", e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white border-slate-200 text-xs"
                >
                  {FORM_DATA.denture_duration.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1 text-slate-600">4. 調整・履歴</label>
                <select
                  value={formData.adjustment_history}
                  onChange={(e) => handleSelect("adjustment_history", e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white border-slate-200 text-xs"
                >
                  {FORM_DATA.adjustment_history.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 5. 口の乾き & 6. 顎堤・粘膜の状態 */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold mb-1 text-slate-600">5. 口の乾き・唾液</label>
                <select
                  value={formData.oral_dryness}
                  onChange={(e) => handleSelect("oral_dryness", e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white border-slate-200 text-xs"
                >
                  {FORM_DATA.oral_dryness.map((od) => (
                    <option key={od} value={od}>{od}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1 text-slate-600">6. 顎堤・粘膜の状態</label>
                <select
                  value={formData.ridge_mucosa}
                  onChange={(e) => handleSelect("ridge_mucosa", e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white border-slate-200 text-xs"
                >
                  {FORM_DATA.ridge_mucosa.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 7. 期待値タイプ */}
            <div>
              <label className="block font-bold mb-1 text-slate-600">7. 期待値タイプ</label>
              <select
                value={formData.expectation_type}
                onChange={(e) => handleSelect("expectation_type", e.target.value)}
                className="w-full p-2 border rounded-lg bg-white border-slate-200 text-xs"
              >
                {FORM_DATA.expectation_type.map((ex) => (
                  <option key={ex} value={ex}>{ex}</option>
                ))}
              </select>
            </div>

            {/* 8. 費用感度 */}
            <div>
              <label className="block font-bold mb-1 text-slate-600">8. 費用感度</label>
              <div className="flex gap-1.5">
                {FORM_DATA.cost_sensitivity.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleSelect("cost_sensitivity", item)}
                    className={`flex-1 py-1.5 px-1 rounded-lg border font-medium transition text-center text-[11px] ${
                      formData.cost_sensitivity === item
                        ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* 9. 現義歯の主な不満 */}
            <div>
              <label className="block font-bold mb-1 text-slate-600">9. 現義歯の主な不満（複数可）</label>
              <div className="flex flex-wrap gap-1.5">
                {FORM_DATA.current_denture_complaints.map((item) => {
                  const isActive = formData.current_denture_complaints.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleMultiSelect("current_denture_complaints", item)}
                      className={`py-1 px-2.5 rounded-full border text-[11px] transition ${
                        isActive
                          ? "bg-amber-500 text-white border-amber-500 font-bold"
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
            <div>
              <label className="block font-bold mb-1 text-slate-600">10. 追求したい情緒価値（複数可）</label>
              <div className="flex flex-wrap gap-1.5">
                {FORM_DATA.emotion_drivers.map((item) => {
                  const isActive = formData.emotion_drivers.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleMultiSelect("emotion_drivers", item)}
                      className={`py-1 px-2.5 rounded-full border text-[11px] transition ${
                        isActive
                          ? "bg-emerald-600 text-white border-emerald-600 font-bold"
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
            <div>
              <label className="block font-bold mb-1 text-slate-600">11. 要注意ワード（慎重モード）</label>
              <div className="flex flex-wrap gap-1.5">
                {FORM_DATA.red_flag_words.map((item) => {
                  const isActive = formData.red_flag_words.includes(item);
                  const isRose = item !== "特になし";
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleMultiSelect("red_flag_words", item)}
                      className={`py-1 px-2.5 rounded-full border text-[11px] transition ${
                        isActive
                          ? isRose
                            ? "bg-rose-600 text-white border-rose-600 font-bold"
                            : "bg-slate-700 text-white border-slate-700 font-bold"
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
            <div>
              <label className="block font-bold mb-1 text-slate-600">12. 現場メモ（任意）</label>
              <input
                type="text"
                value={formData.free_memo}
                onChange={(e) => setFormData({ ...formData, free_memo: e.target.value })}
                placeholder="家族の同席希望、持病など"
                className="w-full p-2 border border-slate-200 rounded-lg bg-white text-xs"
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow transition disabled:opacity-50 text-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
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
        </section>

        {/* 右カラム：プレビュー */}
        <section aria-label="プレビュー領域" className="print-area h-full flex flex-col">
          {error && (
            <div className="no-print mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold">
              {error}
            </div>
          )}

          {result ? (
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col h-full">
              <div className="no-print flex justify-between items-center border-b pb-3 mb-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab("patient")}
                    className={`py-2 px-4 rounded-lg font-bold text-xs transition flex items-center gap-1.5 ${
                      activeTab === "patient"
                        ? "bg-slate-900 text-white shadow"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <FileText size={14} /> A4提案シート (患者用)
                  </button>
                  <button
                    onClick={() => setActiveTab("talk")}
                    className={`py-2 px-4 rounded-lg font-bold text-xs transition flex items-center gap-1.5 ${
                      activeTab === "talk"
                        ? "bg-amber-100 text-amber-900 border border-amber-300 shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <MessageSquare size={14} /> トークカンペ (画面専用)
                  </button>
                </div>

                {activeTab === "patient" && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleOpenPrintPdf}
                      disabled={printingPdf}
                      className="py-2 px-4 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg text-xs transition flex items-center gap-1.5 shadow disabled:opacity-50"
                    >
                      <Printer size={14} /> {printingPdf ? "PDF生成中..." : "A4印刷（PDFで開く）"}
                    </button>
                    <button
                      onClick={handleSendPrint}
                      disabled={sending}
                      className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition flex items-center gap-1.5 shadow disabled:opacity-50"
                    >
                      <Send size={14} /> {sending ? "送信中..." : "印刷（医院へ送信）"}
                    </button>
                  </div>
                )}
              </div>

              <div ref={previewAreaRef} className="flex-1 overflow-auto bg-slate-200 p-4 rounded-xl border border-slate-300 flex flex-col items-center gap-6">
                {activeTab === "patient" && (() => {
                  const sheet = parsePatientSheet(result.patientSheet);
                  const intro = sheet.sections.find((s) => s.heading.includes("悩み"));
                  const recommend = sheet.sections.find((s) => s.heading.includes("おすすめ"));
                  const tableSection = sheet.sections.find((s) => s.body.includes("<table"));
                  const prosCons = sheet.sections.find((s) => s.heading.includes("良い点") || s.heading.includes("注意点"));
                  const costSection = sheet.sections.find((s) => s.heading.includes("費用"));

                  const Header = () => (
                    <div className="rounded-lg bg-gradient-to-r from-slate-900 to-sky-800 p-2.5 text-white shadow-sm mb-2 border-b-2 border-sky-500">
                      <div className="flex items-center justify-between gap-3">
                        <h1 className="text-[16.0px] font-bold tracking-wide flex-1">{sheet.title}</h1>
                        <div className="text-right text-[9.5px] opacity-90 leading-tight shrink-0">
                          {cleanClinicName && (
                            <div className="font-semibold">{cleanClinicName}</div>
                          )}
                          <div className="text-[8px] text-slate-300 mt-0.5 space-y-0.5">
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
                    <div className="mt-auto border-t border-slate-300 pt-1.5 text-center text-[8.5px] text-slate-400 leading-normal">
                      {sheet.disclaimer}
                    </div>
                  );

                  return (
                    <>
                      {/* PAGE 1 */}
                      <A4PageWrapper>
                        <Header />
                        {intro && (
                          <div className="flex items-start gap-2 mb-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-sky-500 bg-sky-50 text-sky-600 shadow-sm">
                              <Bot size={25} />
                            </div>
                            <div
                              className="relative flex-1 rounded-xl border border-sky-100 bg-sky-50/50 p-2 text-[13.0px] leading-snug text-slate-800"
                              dangerouslySetInnerHTML={{ __html: renderInline(intro.body) }}
                            />
                          </div>
                        )}
                        {recommend && (
                          <div className="rounded-lg border border-slate-200 bg-white p-2 mb-2">
                            <div className="flex items-center gap-1 border-l-4 border-sky-600 pl-1.5 text-[14.0px] font-bold text-slate-900 mb-1">
                              <CheckCircle2 size={14} className="text-sky-600" />
                              {recommend.heading}
                            </div>
                            <div
                              className="text-[12.0px] leading-snug text-slate-700"
                              dangerouslySetInnerHTML={{ __html: renderInline(recommend.body) }}
                            />
                          </div>
                        )}
                        {tableSection && (
                          <div className="rounded-lg border border-slate-200 bg-white p-2">
                            <div className="flex items-center gap-1 border-l-4 border-sky-600 pl-1.5 text-[14.0px] font-bold text-slate-900 mb-1">
                              <Sparkles size={14} className="text-amber-500" />
                              {tableSection.heading}
                            </div>
                            <div
                              className="overflow-x-auto"
                              dangerouslySetInnerHTML={{ __html: cleanTableHtml(tableSection.body) }}
                            />
                          </div>
                        )}
                        <Footer />
                      </A4PageWrapper>

                      {/* PAGE 2 */}
                      {(prosCons || costSection) && (
                        <A4PageWrapper isLast>
                          <Header />
                          <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-2.5">
                            {prosCons && (
                              <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                                <div className="flex items-center gap-1 border-l-4 border-sky-600 pl-1.5 text-[14.0px] font-bold text-slate-900 mb-1">
                                  <AlertTriangle size={14} className="text-rose-500" />
                                  {prosCons.heading}
                                </div>
                                <div
                                  className="text-[12.0px] leading-relaxed text-slate-700"
                                  dangerouslySetInnerHTML={{ __html: renderInline(prosCons.body) }}
                                />
                              </div>
                            )}
                            {costSection && (
                              <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                                <div className="flex items-center gap-1 border-l-4 border-sky-600 pl-1.5 text-[14.0px] font-bold text-slate-900 mb-1">
                                  <Sparkles size={14} className="text-sky-600" />
                                  {costSection.heading}
                                </div>
                                <div
                                  className="text-[12.0px] leading-relaxed text-slate-700"
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

                {/* トークカンペ */}
                {activeTab === "talk" && (
                  <div className="no-print bg-amber-50/80 p-5 rounded-xl border border-amber-200 w-full max-w-3xl">
                    <div className="bg-amber-100 text-amber-900 p-3 rounded-lg text-xs font-bold flex items-center gap-2 mb-4 border border-amber-300">
                      <AlertTriangle size={16} /> 患者様には見せないでください（衛生士専用トークガイド）
                    </div>
                    <div
                      className="text-xs leading-relaxed text-slate-700 space-y-4 whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{
                        __html: result.talkScript
                          .replace(/### (.*)/g, '<h3 class="font-bold text-amber-900 border-b border-amber-200 pb-1 mt-4 mb-2 text-sm">$1</h3>')
                          .replace(/\*\*(.*?)\*\*/g, '<strong class="bg-amber-100 px-1 rounded">$1</strong>'),
                      }}
                    />
                  </div>
                )}
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