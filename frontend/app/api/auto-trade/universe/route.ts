import { NextRequest, NextResponse } from "next/server";

const PENNY_UNIVERSE = [
  "SNDL","MMAT","CLOV","ACB","TLRY","SENS","XELA","ATER","SOFI","GPRO",
  "NOK","BB","WISH","EXPR","NAKD","SPRT","BBIG","PROG","CEI","PHIL",
  "OCGN","BNGO","IDEX","JAGX","AVXL","SIGA","HCDI","LODE","ATXI","NKLA",
  "SOLO","RIDE","ARVL","GOEV","FSR","BLNK","PLUG","FCEL","BLDP","BE",
];

export async function GET() {
  return NextResponse.json({ symbols: PENNY_UNIVERSE });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({ symbols: [] }))) as { symbols?: string[] };
  const added = (body.symbols ?? []).map((s) => s.toUpperCase()).filter(Boolean);
  const universeSize = new Set([...PENNY_UNIVERSE, ...added]).size;
  return NextResponse.json({ ok: true, universe_size: universeSize });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json().catch(() => ({ symbols: [] }))) as { symbols?: string[] };
  const removeSet = new Set((body.symbols ?? []).map((s) => s.toUpperCase()));
  const remaining = PENNY_UNIVERSE.filter((s) => !removeSet.has(s));
  return NextResponse.json({ ok: true, universe_size: remaining.length });
}
