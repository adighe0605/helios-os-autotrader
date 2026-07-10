type AutoTradeRuntimeState = {
  enabled: boolean;
  min_confidence: number;
  max_price: number;
  min_volume: number;
  max_position_pct: number;
  max_concurrent_positions: number;
  penny_allocation_pct: number;
  other_allocation_pct: number;
  last_scan_at: string | null;
  scan_count: number;
  trades_today: number;
};

const AUTO_TRADE_STATE_KEY = "__helios_auto_trade_state__";

function defaults(): AutoTradeRuntimeState {
  const pennyRaw = parseFloat(process.env.AUTO_PENNY_ALLOCATION_PCT ?? "70");
  const otherRaw = parseFloat(process.env.AUTO_OTHER_ALLOCATION_PCT ?? "30");
  const penny = Number.isNaN(pennyRaw) ? 70 : clamp(pennyRaw, 0, 100);
  const other = Number.isNaN(otherRaw) ? 30 : clamp(otherRaw, 0, 100);
  const total = penny + other;
  const normalizedPenny = total > 0 ? Math.round((penny / total) * 100) : 70;
  const normalizedOther = 100 - normalizedPenny;
  return {
    enabled: process.env.AUTONOMOUS_MODE === "true",
    min_confidence: parseFloat(process.env.AUTO_MIN_CONFIDENCE ?? "0.70"),
    max_price: parseFloat(process.env.PENNY_MAX_PRICE ?? "5.0"),
    min_volume: parseInt(process.env.PENNY_MIN_VOLUME ?? "300000", 10),
    max_position_pct: parseFloat(process.env.AUTO_MAX_POSITION_PCT ?? "3.0"),
    max_concurrent_positions: parseInt(process.env.AUTO_MAX_CONCURRENT_POSITIONS ?? "5", 10),
    penny_allocation_pct: normalizedPenny,
    other_allocation_pct: normalizedOther,
    last_scan_at: null,
    scan_count: 0,
    trades_today: 0,
  };
}

function getState(): AutoTradeRuntimeState {
  const g = globalThis as typeof globalThis & {
    [AUTO_TRADE_STATE_KEY]?: AutoTradeRuntimeState;
  };
  if (!g[AUTO_TRADE_STATE_KEY]) g[AUTO_TRADE_STATE_KEY] = defaults();
  return g[AUTO_TRADE_STATE_KEY]!;
}

export function isMarketOpenNow(): boolean {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay();
  const hour = et.getHours();
  const min = et.getMinutes();
  const totalMin = hour * 60 + min;
  return day >= 1 && day <= 5 && totalMin >= 9 * 60 + 30 && totalMin < 16 * 60;
}

export function getAutoTradeState() {
  const s = getState();
  return {
    enabled: s.enabled,
    min_confidence: s.min_confidence,
    max_price: s.max_price,
    min_volume: s.min_volume,
    max_position_pct: s.max_position_pct,
    max_concurrent_positions: s.max_concurrent_positions,
    penny_allocation_pct: s.penny_allocation_pct,
    other_allocation_pct: s.other_allocation_pct,
    market_open: isMarketOpenNow(),
    last_scan_at: s.last_scan_at,
    scan_count: s.scan_count,
    trades_today: s.trades_today,
  };
}

export function setAutoTradeEnabled(enabled: boolean) {
  const s = getState();
  s.enabled = enabled;
  return getAutoTradeState();
}

export function updateAutoTradeSettings(patch: Partial<AutoTradeRuntimeState>) {
  const s = getState();
  if (typeof patch.min_confidence === "number" && !Number.isNaN(patch.min_confidence)) s.min_confidence = patch.min_confidence;
  if (typeof patch.max_price === "number" && !Number.isNaN(patch.max_price)) s.max_price = patch.max_price;
  if (typeof patch.min_volume === "number" && !Number.isNaN(patch.min_volume)) s.min_volume = patch.min_volume;
  if (typeof patch.max_position_pct === "number" && !Number.isNaN(patch.max_position_pct)) s.max_position_pct = patch.max_position_pct;
  if (typeof patch.max_concurrent_positions === "number" && !Number.isNaN(patch.max_concurrent_positions)) {
    s.max_concurrent_positions = patch.max_concurrent_positions;
  }
  const hasPenny = typeof patch.penny_allocation_pct === "number" && !Number.isNaN(patch.penny_allocation_pct);
  const hasOther = typeof patch.other_allocation_pct === "number" && !Number.isNaN(patch.other_allocation_pct);
  if (hasPenny || hasOther) {
    let penny = hasPenny ? patch.penny_allocation_pct! : s.penny_allocation_pct;
    let other = hasOther ? patch.other_allocation_pct! : s.other_allocation_pct;
    penny = clamp(penny, 0, 100);
    other = clamp(other, 0, 100);
    if (hasPenny && !hasOther) other = 100 - penny;
    if (hasOther && !hasPenny) penny = 100 - other;
    const total = penny + other;
    if (total <= 0) {
      penny = 70;
      other = 30;
    } else {
      penny = Math.round((penny / total) * 100);
      other = 100 - penny;
    }
    s.penny_allocation_pct = penny;
    s.other_allocation_pct = other;
  }
  return getAutoTradeState();
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
