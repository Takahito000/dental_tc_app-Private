"use client";

import { useState } from "react";

// ============================================================
// VOICEセクションの「全文を読む ▼ / 閉じる ▲」トグル
// - 要約と全文は同時表示しない（open で全文5段落に切り替わる）
// - 展開時のフェードイン（300ms）は globals.css の .voice-toggle-expand
// ============================================================

export default function VoiceToggle({
  summary,
  children,
}: {
  summary: React.ReactNode; // 要約（2段落）
  children: React.ReactNode; // 全文（5段落）
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div>
        {summary}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 block text-xs text-accent underline underline-offset-2"
        >
          全文を読む ▼
        </button>
      </div>
    );
  }

  return (
    <div className="voice-toggle-expand">
      {children}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-4 block text-xs text-accent underline underline-offset-2"
      >
        閉じる ▲
      </button>
    </div>
  );
}
