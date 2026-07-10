import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    ok: true,
    enabled: false,
    message: "Bot disabled. To persist, set AUTONOMOUS_MODE=false in Vercel environment variables.",
  });
}
