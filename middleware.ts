import { NextRequest, NextResponse } from "next/server";

// 💡 LP新設に伴うツール本体の退避（/ → /app）
//    既存利用者に配布済みのトークンURL (?t=xxx) を引き継ぐため、
//    ルートへのアクセスでクエリパラメータ t が存在する場合のみ /app へリダイレクトする。
//    t なしのルートアクセスは LP を表示する。
export function middleware(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t");
  if (t) {
    const url = req.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
