import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// 💡 医院別価格設定（Phase1）: トークン照合で医院を特定し、素材別価格の上書き行を返す読み取り専用API。
//    - 入力: クエリパラメータまたはPOSTボディの token（t / access_token も許容）
//    - 出力: { prices: [{ app_kind, material_key, price_min, price_max }, ...] }
//    - トークン未送信・未登録・DBエラーのいずれも { prices: [] } を200で返す
//      （フロントは既存のデフォルト価格定数でフォールバック動作する。エラーにしない）
//    - 価格は患者向けシートに表示される公開情報のため、トークン照合以上の認証は不要。
//    - counseling route の既存処理（ログ・バリデータ等）とは一切関係ない独立経路。

type PriceRow = {
  app_kind: string;
  material_key: string;
  price_min: number | null;
  price_max: number;
};

async function handle(token: string) {
  const t = (token || "").trim();
  if (!t) {
    return NextResponse.json({ prices: [] });
  }

  try {
    const supabase = getSupabaseAdmin();

    // 既存の照合パターンと同じく clinics.access_token で医院を特定する
    // （app/api/counseling/route.ts のトークン照合と同一パターン）
    const { data: clinic } = await supabase
      .from("clinics")
      .select("id")
      .eq("access_token", t)
      .single();

    if (!clinic) {
      // 未登録トークン: 空配列で返す（エラーにしない）
      return NextResponse.json({ prices: [] });
    }

    const { data, error } = await supabase
      .from("clinic_material_prices")
      .select("app_kind, material_key, price_min, price_max")
      .eq("clinic_id", clinic.id);

    if (error) {
      // テーブル不存在等のDB側異常もフロントのフォールバック動作を優先し空配列で返す
      console.error("ClinicPrices API Query Error:", error);
      return NextResponse.json({ prices: [] });
    }

    const prices: PriceRow[] = [];
    for (const row of data || []) {
      if (
        !row ||
        (row.app_kind !== "denture" && row.app_kind !== "crown") ||
        typeof row.material_key !== "string" ||
        typeof row.price_max !== "number"
      ) {
        continue;
      }
      const min = typeof row.price_min === "number" ? row.price_min : null;
      // CHECK制約（min <= max）違反相当の不正データは無視する
      if (min !== null && min > row.price_max) continue;
      prices.push({
        app_kind: row.app_kind,
        material_key: row.material_key,
        price_min: min,
        price_max: row.price_max,
      });
    }

    return NextResponse.json({ prices });
  } catch (err) {
    console.error("ClinicPrices API Error:", err);
    return NextResponse.json({ prices: [] });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token =
    searchParams.get("token") ||
    searchParams.get("t") ||
    searchParams.get("access_token") ||
    "";
  return handle(token);
}

export async function POST(req: Request) {
  let token = "";
  try {
    const body = await req.json();
    token = (body?.token || body?.access_token || "").toString();
  } catch {
    // ボディがJSONでない場合はクエリ側のみで判定する
  }
  return handle(token);
}
