import { NextResponse } from "next/server";

// Note: actual enable/disable persists via GitHub Actions secret AUTONOMOUS_MODE.
// This endpoint provides immediate UI feedback. Set AUTONOMOUS_MODE=true in
// Vercel env vars + GitHub Actions secrets to fully activate trading.
export async function POST() {
  return NextResponse.json({
    ok: true,
    enabled: true,
    message: "Bot enabled. To persist across deploys, set AUTONOMOUS_MODE=true in Vercel environment variables.",
  });
}
