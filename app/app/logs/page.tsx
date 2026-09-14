import { Suspense } from "react";
import LogsClient from "./logs-client";

// ============================================================
// 発行ログ一覧ページ（/app/logs?t=xxx）
// - 既存 generation_logs テーブルの読み取り表示のみ（保存側・スキーマは変更しない）
// - noindex は app/app/layout.tsx の metadata（robots）を継承
// ============================================================

export default function LogsPage() {
  return (
    <Suspense fallback={null}>
      <LogsClient />
    </Suspense>
  );
}
