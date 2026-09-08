# Kimi Code 指示書：医院別価格設定（Phase 1）

発行日：2026-09-09
対象リポジトリ：denpist-ai（Next.js 16.3.1 App Router on Vercel + Supabase）

---

## 0. この指示書の読み方

- **§2「事前確認事項」を実装着手前に必ず確認し、結果を報告してから実装を開始すること。** 報告内容によっては仕様の微調整をユーザーへ確認する。
- push・デプロイ・npm install はユーザーが手動で行う。Kimi Codeはコード変更とローカルテストまで。
- **表示文言の追加・変更は禁止。** 必要になった場合は実装せずユーザーへ確認を返すこと（2026-09-01確定の運用ルール）。
- Supabaseのテーブル作成はユーザーの手動工程（§7 工程表）。Kimi CodeはSQLの用意と、テーブル存在を前提としたコード実装のみ。

---

## 1. 背景と目的

自費率の高い新規トライアル医院（あずさ歯科）の価格が、ツール内蔵の価格定数と+14〜27%乖離している。シートは医院名・担当者名入りで発行される文書であり、この乖離は信用問題となるため、**医院ごとに価格を上書きできる仕組み**を実装する。

設計の確定事項（ユーザー決定済み・変更禁止）：

- 価格モデルは **min/max 方式**。**`price_min` が NULL で `price_max` に値がある場合 = 単一価格**。両方に値がある場合 = レンジ（「min〜max円」表示）。
- 日割り（義歯のみ）は **常に `price_max` ÷ 耐用年数** で一本化（レンジでもレンジ表示にしない）。
- 耐用年数（日割りの分母）は**システム定数のまま**。医院別にしない。
- **選択肢の削減機能は実装しない**（見送り決定済み）。
- **医院識別は既存のトークン照合を流用する**（新規の識別機構は作らない）。
- 価格を持たない医院のため、**既存の価格定数はデフォルト値としてフロントに残す**（完全置き換えではなく二層構造）。

---

## 2. 事前確認事項（実装前に報告すること）

1. **義歯メニュー定数の所在**：義歯側の価格定数・耐用年数・`pricePerDay` の計算箇所を特定すること。`grep "インプラント"` はヒットゼロ（インプラントは未実装・義歯のみの仕様）。`app/app/page.tsx` 以外（components/ 等）に存在する可能性がある。なお `app/app/page.tsx:2011` で `(decision as Decision).pricePerDay` を参照しているため、Decision を生成するロジックの所在を追うこと。
2. **クラウン価格定数の構造**：`app/app/page.tsx:824-836` に `price: "95,000円（税込）"` 等の文字列リテラルがある。周辺のデータ構造（素材キー・表示名・説明文等）を確認し、`decision.candidatePriceRange`（page.tsx:1976）がこの構造からどう生成されているかを報告すること。
3. **clinics テーブルの構造**：`app/api/counseling/route.ts:238-245` で使用中。`id` の型（uuid / int 等）を確認し、新テーブルの外部キー型を合わせること。
4. **Supabase アクセス経路**：サーバー側クライアントの設定（service role / RLS の有無）を確認し、新テーブルが同じ経路で読めることを確認すること。

---

## 3. 変更1：Supabase テーブル新設（SQLを用意・実行はユーザー）

以下の CREATE TABLE 文を用意し、指示書への回答として提示すること（実行はユーザーがSupabase SQL editorで行う）。

```sql
create table clinic_material_prices (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  app_kind text not null check (app_kind in ('denture', 'crown')),
  material_key text not null,
  price_min integer,
  price_max integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, app_kind, material_key),
  -- 登録バリデーション：min単独禁止・min <= max
  check (price_min is null or price_min <= price_max)
);
```

- `material_key` はコード側の素材識別子と一致させること（§2-1, 2-2の確認後に確定。既存の定数キーをそのまま使う）。
- 「min単独禁止」は上記CHECK制約では表現できないため（minのみ記入は `price_max` NOT NULL 制約で事実上防止される）、**単一価格は必ず `price_max` に入れる運用**であることをSQLのコメントと回答文に明記すること。

---

## 4. 変更2：`/api/clinic-prices` 新設

- パス：`app/api/clinic-prices/route.ts`
- 入力：クエリパラメータまたはPOSTボディの `token`（`access_token` も許容）。**既存の照合ロジック（`app/api/counseling/route.ts:238-245` の `clinics.access_token` 照合）と同じパターンで clinic を特定すること。**
- 出力：
  - トークン未送信・未登録 → `{ prices: [] }` を200で返す（エラーにしない。フロントはフォールバックする）。
  - 登録あり → `{ prices: [{ app_kind, material_key, price_min, price_max }, ...] }`
- 読み取り専用。認証は既存トークン方式の範囲（価格は公開情報のため追加認証不要）。
- **ログ記録・バリデータ等、counseling route の既存処理には一切触れないこと。**

---

## 5. 変更3：フロント価格定数の二層化（`app/app/page.tsx`）

### 5-1. 定数構造の置き換え

現行の `price: "95,000円（税込）"` 等の文字列を、素材ごとに `{ priceMin: number | null, priceMax: number }` 構造へ置き換える。**現行のデフォルト価格はすべて単一価格なので `priceMin: null`・`priceMax` に現行値を入れる。**

| material_key（例） | priceMin | priceMax |
|---|---|---|
| フルジルコニア | null | 95000 |
| e.max | null | 100000 |
| ジルコニアセラミック | null | 145000 |
| ゴールド | null | 180000 |

※義歯側も同様（§2-1の確認後、現行値をそのまま移すこと）。

### 5-2. 表示文字列はコード生成に統一

- 単一価格（priceMin === null）→ `"{priceMaxカンマ区切り}円（税込）"`
- レンジ → `"{priceMinカンマ区切り}〜{priceMaxカンマ区切り}円（税込）"`
- **現行の表記（「（税込）」の有無・位置等）を完全に踏襲すること。** 表記の変更は表示文言変更にあたるため禁止。
- 生成関数を1箇所に定義し、比較表描画・`candidatePriceRange` 生成の双方がこの関数だけを使うこと（分岐を散らさない）。

### 5-3. 医院別価格の取得とフォールバック

- ページ初期ロード時に `/api/clinic-prices` を呼び、現在のアプリ種別（`mode: "denture" | "crown"`）と material_key が一致する行があれば、その値で該当素材の priceMin/priceMax を上書きする。
- **行なし・通信失敗・タイムアウト時は現行定数のまま動作継続**（エラー表示・画面ブロックはしない）。
- 価格解決は「デフォルト定数 → 医院行で上書き」の一つの経路に一元化し、判定ロジック（部位×優先度・`insurance_first` 等）には**一切手を入れない**。
- `insurance_first` で `candidatePriceRange` が空欄になる既存仕様は変更しない。

---

## 6. 変更4：日割り計算の一本化（義歯のみ）

- `pricePerDay` = **`priceMax` ÷ 耐用年数**（耐用年数は現行のシステム定数を維持）。
- レンジ価格でも単一の数値を出す（「XX〜YY円」にはしない）。
- **端数処理をコード側で固定すること**（現行の処理を確認し、現行と同じ丸め方を維持。現行が未固定なら10円単位切り上げとし、採用したルールを回答で報告すること）。
- 義歯の `candidate_price_range` / `price_per_day` がバリデータの許可集合（`app/api/counseling/route.ts:97-101`）に使われているため、**注入文字列と表示が必ず一致する**よう、§5-2の生成関数と日割り計算を共有すること。

---

## 7. 工程表（順序厳守）

| # | 工程 | 実施者 |
|---|---|---|
| 1 | `clinic_material_prices` テーブル作成（§3のSQL） | **ユーザー（Supabase SQL editor）** |
| 2 | コード実装・ローカルテスト（§8全件） | Kimi Code |
| 3 | push・本番デプロイ | ユーザー |
| 4 | あずさ歯科の価格行の登録（価格表入手後でよい） | ユーザー |

**順序の理由：コードは初期ロード時にテーブルを参照する。テーブル不存在はフォールバックの対象外（クエリエラー）となるため、必ずテーブル作成が先。** 行が空の状態ならフォールバックで従来通り動作する。

---

## 8. テストマトリクス（ローカル・全件PASS必須）

| # | 条件 | 期待結果 |
|---|---|---|
| T1 | トークン未送信 or 未登録医院 | 現行定数で表示・注入（従来と同一出力） |
| T2 | 医院行あり（単一価格：min=NULL, max=121000, crown/フルジルコニア） | 比較表とcandidate_price_rangeが「121,000円（税込）」 |
| T3 | 医院行あり（レンジ：min=100000, max=120000） | 「100,000〜120,000円（税込）」表示・注入 |
| T4 | 一部素材のみ医院行あり | 該当素材のみ上書き、他はデフォルト |
| T5 | 義歯：医院行あり（max=300000, 耐用年数=現行値） | pricePerDay = 300000÷耐用年数（端数処理ルール通り）で表示・注入が一致 |
| T6 | API通信失敗を再現（エンドポイント停止） | デフォルトにフォールバックし画面は正常動作 |
| T7 | crown insurance_first（candidate_price_range空欄） | 従来通り金額表現なし・バリデータ誤検出なし |
| T8 | crown careful（has_pain） | 従来通り候補なし出力・回帰なし |
| T9 | 既存バリデータ照合 | 医院価格注入時に、AI出力の金額が注入値と一致すればPASS、創作金額はブロック（従来の真陽性テスト再現） |

加えて既存の回帰テスト（義歯D1-D3・クラウンC1-C3）を全件再実施すること。

---

## 9. 変更対象外（触らないこと）

- バリデータ（`app/api/counseling/route.ts` の照合ロジック全般）— 注入値が変わるだけで照合経路は無変更
- Difyプロンプト（義歯版v2.6・クラウン版v1.4）— 価格は注入値のため変更不要
- 判定ロジック本体（部位×優先度・P0-P3・insurance_first等）
- LP（`app/page.tsx`。`:452` の「クラウン 1件成約 約100,000円〜」はマーケ文言・対象外）
- 見出しコード化（SHEET_FIXED_HEADINGS）・TALK_MINDSET_LINE 関連

---

## 10. 回答に含めること

1. §2 事前確認事項の結果（ファイル名・行番号つき）
2. §3 のSQL（ユーザーがSupabaseで実行する用）
3. 変更ファイル一覧とdiff要約
4. §8 テスト結果（全件）
5. 採用した端数処理ルール（§6）
6. 表示文言の追加・変更が必要になった場合は、その旨（実装はしない）
