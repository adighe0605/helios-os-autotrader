import { NextRequest, NextResponse } from "next/server";
import { dataFetch, isAlpacaConnected } from "@/lib/alpaca-server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "10"), 50);

  if (!isAlpacaConnected()) return NextResponse.json([]);
  try {
    const data = await dataFetch<{ news: any[] }>(
      `/v1beta1/news?symbols=${encodeURIComponent(sym)}&limit=${limit}&sort=desc`
    );
    const items = data?.news ?? [];
    return NextResponse.json(
      items.map((n) => ({
        headline: n.headline,
        source: n.source,
        url: n.url,
        published_at: n.created_at,
        sentiment: n.sentiment ?? 0,
      }))
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
