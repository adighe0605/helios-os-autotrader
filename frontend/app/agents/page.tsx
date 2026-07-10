"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import { api } from "@/lib/api";
import { AgentDebate } from "@/components/AgentDebate";
import { LegacyAgentDebate } from "@/components/LegacyAgentDebate";
import { cn } from "@/lib/format";
import type { TradeDecision } from "@/lib/types";

type CommitteeSection = {
  id: string;
  title: string;
  scoreLabel: string;
  blocks: { heading: string; items: string[] }[];
};

const COMMITTEE_SECTIONS: CommitteeSection[] = [
  {
    id: "market-intelligence",
    title: "Market Intelligence Agent",
    scoreLabel: "Opportunity Score",
    blocks: [
      { heading: "Scans", items: ["High relative volume", "Breakouts", "Gap-ups", "Gap-downs", "Relative strength", "Liquidity", "Unusual volume", "Momentum shifts", "Institutional accumulation"] },
      { heading: "Outputs", items: ["Opportunity score", "Confidence", "Supporting data"] },
    ],
  },
  {
    id: "technical-analysis",
    title: "Technical Analysis Agent",
    scoreLabel: "Technical Score",
    blocks: [
      { heading: "Analyzes", items: ["RSI", "EMA", "SMA", "VWAP", "MACD", "ATR", "Bollinger Bands", "ADX", "Supertrend", "Ichimoku Cloud", "Fibonacci"] },
      { heading: "Generates", items: ["Buy / Hold / Sell", "Entry", "Stop loss", "Target prices", "Confidence"] },
    ],
  },
  {
    id: "news-intelligence",
    title: "News Intelligence Agent",
    scoreLabel: "Impact Score",
    blocks: [
      { heading: "Analyzes", items: ["Company news", "Earnings", "SEC filings", "Economic news", "Analyst upgrades", "Analyst downgrades", "Fed announcements"] },
      { heading: "Summarizes", items: ["Bullish", "Neutral", "Bearish", "Overall impact score"] },
    ],
  },
  {
    id: "social-sentiment",
    title: "Social Sentiment Agent",
    scoreLabel: "Sentiment Score",
    blocks: [
      { heading: "Monitors", items: ["Reddit", "X", "StockTwits", "YouTube"] },
      { heading: "Detects", items: ["Trending tickers", "Retail sentiment", "Fear", "Greed", "Meme activity"] },
    ],
  },
  {
    id: "options-flow",
    title: "Options Flow Agent",
    scoreLabel: "Flow Score",
    blocks: [
      { heading: "Analyzes", items: ["Large block trades", "Sweeps", "Open interest", "Put/Call ratio", "Gamma exposure", "Dark pool activity"] },
      { heading: "Objective", items: ["Institutional positioning"] },
    ],
  },
  {
    id: "pattern-recognition",
    title: "Pattern Recognition Agent",
    scoreLabel: "Pattern Score",
    blocks: [
      { heading: "Identifies", items: ["Bull Flag", "Cup & Handle", "Double Bottom", "Double Top", "Ascending Triangle", "Descending Triangle", "Head & Shoulders", "Wedges", "Channels"] },
      { heading: "Output", items: ["Visual pattern overlays on charts"] },
    ],
  },
  {
    id: "earnings",
    title: "Earnings Agent",
    scoreLabel: "Earnings Risk Score",
    blocks: [
      { heading: "Tracks", items: ["Upcoming earnings", "Historical reactions", "Expected move", "Implied volatility", "Analyst revisions"] },
      { heading: "Output", items: ["Earnings risk score"] },
    ],
  },
  {
    id: "macro",
    title: "Macro Agent",
    scoreLabel: "Macro Risk Score",
    blocks: [
      { heading: "Monitors", items: ["CPI", "PPI", "Interest rates", "Treasury yields", "VIX", "Oil", "Gold", "USD Index"] },
      { heading: "Output", items: ["Macro market risk estimate"] },
    ],
  },
  {
    id: "quant",
    title: "Quant Agent",
    scoreLabel: "Quant Score",
    blocks: [
      { heading: "Calculates", items: ["Sharpe Ratio", "Expected Value", "Kelly Criterion", "Historical Win Rate"] },
      { heading: "Output", items: ["Quant score and edge quality"] },
    ],
  },
  {
    id: "strategy",
    title: "Strategy Agent",
    scoreLabel: "Strategy Score",
    blocks: [
      { heading: "Combines", items: ["All agent outputs"] },
      { heading: "Produces", items: ["BUY / SELL / HOLD", "Confidence score", "Reasoning", "Supporting evidence", "Risk level"] },
    ],
  },
  {
    id: "risk-management",
    title: "Risk Management Agent",
    scoreLabel: "Risk Control Score",
    blocks: [
      { heading: "Calculates", items: ["Position size", "Max loss", "Portfolio exposure", "Sector exposure", "Correlation", "Portfolio heat", "Daily drawdown", "VaR", "Kelly Criterion"] },
      { heading: "Rule", items: ["Reject trades exceeding configured limits"] },
    ],
  },
  {
    id: "portfolio-manager",
    title: "Portfolio Manager Agent",
    scoreLabel: "Portfolio Health Score",
    blocks: [
      { heading: "Tracks", items: ["Holdings", "Allocation", "Sector exposure", "Cash", "Realized gains", "Unrealized gains", "Dividend income", "Performance"] },
      { heading: "Output", items: ["Optimization suggestions"] },
    ],
  },
  {
    id: "execution",
    title: "Execution Agent",
    scoreLabel: "Execution Quality Score",
    blocks: [
      { heading: "Prepares", items: ["Market", "Limit", "Stop", "Trailing Stop"] },
      { heading: "Supports", items: ["Scaling in", "Scaling out", "Partial exits", "Risk-based sizing"] },
    ],
  },
  {
    id: "learning",
    title: "Learning Agent",
    scoreLabel: "Learning Score",
    blocks: [
      { heading: "Records after each trade", items: ["Entry", "Exit", "Profit", "Loss", "Strategy", "Indicators", "Market conditions", "Mistakes"] },
      { heading: "Goal", items: ["Continuously improve recommendations"] },
    ],
  },
  {
    id: "explainability",
    title: "Explainability Agent",
    scoreLabel: "Explainability Score",
    blocks: [
      { heading: "Must include", items: ["Why this trade", "Indicators that agree", "Indicators that disagree", "Historical success rate", "Major risks", "Alternative scenarios"] },
      { heading: "Rule", items: ["Never provide unexplained recommendations"] },
    ],
  },
  {
    id: "ai-debate",
    title: "AI Debate System",
    scoreLabel: "Debate Quality Score",
    blocks: [
      { heading: "Debate roles", items: ["Bull Agent argues FOR", "Bear Agent argues AGAINST", "Neutral Agent highlights risks", "Judge Agent gives final recommendation"] },
    ],
  },
  {
    id: "command-center",
    title: "AI Command Center",
    scoreLabel: "Assistant Quality Score",
    blocks: [
      { heading: "Conversational assistant prompts", items: ["Why should I buy NVDA?", "Show today's strongest momentum stocks.", "Explain today's portfolio risk.", "What changed since yesterday?", "Summarize today's market."] },
    ],
  },
];

const AGENT_SOURCES: Record<string, { source: string; details: string }> = {
  "market-intelligence": {
    source: "Alpaca Market Data v2 & Penny Scanner",
    details: "Pulls live pricing, relative volumes, and intraday momentum across a universe of small-caps using Alpaca's REST endpoints and local scanner algorithms."
  },
  "technical-analysis": {
    source: "Alpaca Candles API",
    details: "Calculates mathematical indicators (RSI, EMA, SMA, MACD, VWAP) in real-time from high-resolution historical OHLCV candle feeds."
  },
  "news-intelligence": {
    source: "Alpaca News Stream",
    details: "Queries real-time company announcements, regulatory events, SEC filings, and global financial press releases matching the target symbol."
  },
  "social-sentiment": {
    source: "StockTwits & Reddit Streams",
    details: "Aggregates real-time comments, message frequency, and bullish/bearish ratios directly from the StockTwits stream with sub-reddit momentum fallback."
  },
  "options-flow": {
    source: "CBOE Delayed Options Chain",
    details: "Analyzes option contract volumes, puts/calls volume ratios, open interest shifts, and block sweep trades."
  },
  "pattern-recognition": {
    source: "OHLC Chart Pattern Classifier",
    details: "Applies computer-vision and price-action heuristics to candle charts to detect flags, triangles, and support/resistance zones."
  },
  "earnings": {
    source: "Yahoo Finance Earnings Calendar",
    details: "Retrieves upcoming announcement dates, consensus EPS estimates, historical earnings surprises, and expected post-earnings moves."
  },
  "macro": {
    source: "Yahoo Finance Global Benchmarks",
    details: "Extracts live indicators for global interest rates (10Y Treasury), market volatility (VIX), US Dollar (DXY), Crude Oil, and Spot Gold."
  },
  "quant": {
    source: "Helios Statistics Engine",
    details: "Applies Sharpe ratio, Kelly Criterion sizing, and mathematical expectation equations directly to systemic performance history."
  },
  "strategy": {
    source: "Helios Weighting Hub",
    details: "Consolidates individual agent scores into a single weighted composite recommendations using confidence and signal strengths."
  },
  "risk-management": {
    source: "Local Database & Alpaca Account API",
    details: "Validates order sizes against user-defined risk limits, max sector exposure caps, and active trailing drawdowns."
  },
  "portfolio-manager": {
    source: "Alpaca Positions API",
    details: "Monitors active portfolio holdings, asset weights, and sector distribution to maintain optimal risk-balanced allocations."
  },
  "execution": {
    source: "Alpaca Orders API & Order Book",
    details: "Monitors real-time bid/ask spreads, liquidity slippage estimates, and order book depth before dispatching trade executions."
  },
  "learning": {
    source: "Local Trade Log Database",
    details: "Analyzes previous fill logs to assess model precision, track wins/losses, and dynamically self-calibrate future agent weights."
  },
  "explainability": {
    source: "Anthropic Claude LLM Engine",
    details: "Generates clear, human-intelligible justifications translating complex multi-agent quantitative verdicts into structured, logical reasoning."
  },
  "ai-debate": {
    source: "Adversarial AI Debate Protocol",
    details: "Spins up independent adversarial LLM nodes (Bull, Bear, Neutral, Judge) to clash, debate, and verify the robustness of every market signal."
  },
  "command-center": {
    source: "Conversational NLP Chatbot API",
    details: "Translates high-level natural language instructions and user queries into precise actions, scanner queries, or analytical briefings."
  }
};

const AGENTS_PAGE_STATE_KEY = "helios_agents_state_v1";
const PAGE_VIEWS = ["committee", "stock-analysis-old"] as const;
type AgentsPageView = typeof PAGE_VIEWS[number];

type PersistedAgentsPageState = {
  symbol: string;
  activeTab: string;
  decision: TradeDecision | null;
  view: AgentsPageView;
};

export default function AgentsPage() {
  const [symbol,   setSymbol]   = useState("");
  const [decision, setDecision] = useState<TradeDecision | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(COMMITTEE_SECTIONS[0].id);
  const [pageView, setPageView] = useState<AgentsPageView>("committee");
  const [stateHydrated, setStateHydrated] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState<string | null>(null);
  const symbolReady = symbol.trim().length > 0;

  useEffect(() => {
    const raw = window.sessionStorage.getItem(AGENTS_PAGE_STATE_KEY);
    if (!raw) {
      setStateHydrated(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<PersistedAgentsPageState>;
      if (typeof parsed.symbol === "string") setSymbol(parsed.symbol);
      if (typeof parsed.activeTab === "string" && COMMITTEE_SECTIONS.some((s) => s.id === parsed.activeTab)) {
        setActiveTab(parsed.activeTab);
      }
      if (typeof parsed.view === "string" && PAGE_VIEWS.includes(parsed.view as AgentsPageView)) {
        setPageView(parsed.view as AgentsPageView);
      }
      if (parsed.decision && typeof parsed.decision === "object") {
        setDecision(parsed.decision as TradeDecision);
      }
    } catch {
      window.sessionStorage.removeItem(AGENTS_PAGE_STATE_KEY);
      setErrorText("Saved AI committee session could not be restored and was reset.");
    } finally {
      setStateHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!stateHydrated) return;
    const payload: PersistedAgentsPageState = { symbol, activeTab, decision, view: pageView };
    window.sessionStorage.setItem(AGENTS_PAGE_STATE_KEY, JSON.stringify(payload));
  }, [stateHydrated, symbol, activeTab, decision, pageView]);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    if (!symbolReady) return;
    setLoading(true);
    setErrorText(null);
    try {
      setDecision(await api.analyze(symbol));
    } catch (error) {
      setDecision(null);
      setErrorText(error instanceof Error ? error.message : "Unable to run committee analysis right now.");
    }
    finally { setLoading(false); }
  }

  const sectionScores = COMMITTEE_SECTIONS.map((section) => {
    const score = decision?.section_scores?.[section.id];
    const isRealData = decision?.section_data_status?.[section.id] === true;
    return { id: section.id, score: typeof score === "number" ? score : null, isRealData };
  });
  const aggregateScore = decision?.score ?? null;
  const activeSection = COMMITTEE_SECTIONS.find((s) => s.id === activeTab) ?? COMMITTEE_SECTIONS[0];
  const activeScore = sectionScores.find((s) => s.id === activeSection.id)?.score ?? null;
  const hasDecision = decision !== null;

  return (
    <div className="space-y-4 max-w-[1400px]">
      {/* Page header */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-[18px] font-bold text-wb-text tracking-tight">AI Trading Committee</h1>
          <p className="text-[13px] text-wb-muted mt-0.5">
            Multi-agent debate: momentum · mean-reversion · sentiment · risk · portfolio manager
          </p>
        </div>
        <form onSubmit={analyze} className="flex items-center gap-2 w-full sm:w-auto">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="flex-1 sm:w-32 h-10 px-3 bg-wb-surface border border-wb-border text-wb-text font-mono uppercase
                       text-[16px] sm:text-[14px] font-bold focus:outline-none focus:ring-1 focus:ring-wb-orange/40
                       focus:border-wb-orange/60 rounded-lg transition-all duration-150"
            placeholder="Enter ticker (e.g. NVDA)"
            autoCapitalize="characters"
          />
          <button type="submit" disabled={loading || !symbolReady}
            className="btn btn-primary disabled:opacity-50 whitespace-nowrap">
            <Sparkles className="w-3.5 h-3.5" />
            {loading ? "Debating…" : "Analyze"}
          </button>
        </form>
      </div>

      <div className="bg-wb-surface border border-wb-border rounded-xl p-2 shadow-card">
        <div className="flex flex-wrap gap-2">
          {[
            { id: "committee", label: "AI Committee" },
            { id: "stock-analysis-old", label: "Stock Analysis (Old)" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPageView(tab.id as AgentsPageView)}
              className={cn(
                "px-3 py-2 rounded-lg text-[12px] font-semibold border transition-colors",
                pageView === tab.id
                  ? "bg-wb-orange/10 border-wb-orange/40 text-wb-orange"
                  : "bg-wb-surface2/40 border-wb-border text-wb-muted hover:text-wb-text hover:bg-wb-surface2"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {errorText && (
        <div className="bg-wb-red/10 border border-wb-red/30 rounded-xl px-4 py-3 text-[12px] text-red-200">
          {errorText}
        </div>
      )}

      {pageView === "committee" ? (
        <>
          <div className="bg-wb-surface border border-wb-border rounded-xl p-4 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[13px] font-semibold text-wb-text">Committee Verdict</div>
                <div className="text-[12px] text-wb-muted mt-1">
                  Final aggregate score across all committee sections.
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-wb-dim">Aggregate Score</div>
                <div className="text-[28px] font-black tracking-tight num text-wb-text">
                  {aggregateScore ?? "—"}
                  <span className="text-[16px] text-wb-dim ml-1">/100</span>
                </div>
                <div className="text-[11px] text-wb-muted">
                  {decision ? `${decision.symbol} · ${decision.recommendation}` : "Run analysis to calculate"}
                </div>
              </div>
            </div>
          </div>

          <section className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
            <div className="overflow-x-auto border-b border-wb-border bg-wb-surface2/40">
              <div className="px-3 pt-2 text-[11px] text-wb-dim flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-wb-green" /> Real data</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-wb-red" /> Proxy / missing data</span>
              </div>
              <div className="flex gap-2 p-2 min-w-max">
                {COMMITTEE_SECTIONS.map((section) => {
                  const sectionMeta = sectionScores.find((s) => s.id === section.id);
                  const score = sectionMeta?.score ?? null;
                  const isRealData = sectionMeta?.isRealData === true;
                  const isActive = activeTab === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveTab(section.id)}
                      className={cn(
                        "rounded-lg px-3 py-2 text-left min-w-[190px] border transition-colors",
                        isActive
                          ? "bg-wb-orange/10 border-wb-orange/40"
                          : "bg-wb-surface border-wb-border hover:bg-wb-surface2"
                      )}
                    >
                      <div className={cn("text-[12px] font-semibold flex items-center gap-1.5", isActive ? "text-wb-orange" : "text-wb-text")}>
                        <span className={cn("w-2 h-2 rounded-full shrink-0", isRealData ? "bg-wb-green" : "bg-wb-red")} />
                        {section.title}
                      </div>
                      <div className="text-[11px] text-wb-dim mt-1">
                        {section.scoreLabel}: <span className="num text-wb-text">{score ?? "—"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[16px] font-bold text-wb-text flex items-center gap-2">
                  <span className={cn("w-2.5 h-2.5 rounded-full", sectionScores.find((s) => s.id === activeSection.id)?.isRealData ? "bg-wb-green" : "bg-wb-red")} />
                  {activeSection.title}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSourceModal(activeSection.id)}
                    className="btn btn-sm btn-ghost cursor-pointer text-[11px] h-7 px-2.5"
                  >
                    Info Source
                  </button>
                  <span className="badge badge-orange num">
                    {activeSection.scoreLabel}: {activeScore ?? "—"}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeSection.blocks.map((block) => (
                  <div key={block.heading} className="rounded-lg border border-wb-border bg-wb-surface2/40 p-3">
                    <div className="text-[12px] font-semibold text-wb-text mb-2">{block.heading}</div>
                    <ul className="space-y-1.5">
                      {block.items.map((item) => (
                        <li key={item} className="text-[12px] text-wb-muted leading-relaxed">• {item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {hasDecision ? (
            <AgentDebate decision={decision} />
          ) : (
            <ReadyState
              title="Ready to analyze"
              body="Enter a ticker above to convene the committee"
            />
          )}
        </>
      ) : (
        <>
          <div className="bg-wb-surface border border-wb-border rounded-xl p-4 shadow-card">
            <div className="space-y-1.5">
              <div>
                <div className="text-[13px] font-semibold text-wb-text">Stock Analysis (Old)</div>
                <div className="text-[12px] text-wb-muted mt-1">
                  Classic single-ticker analysis with the legacy verdict and agent signal view.
                </div>
              </div>
              <div className="text-left">
                <div className="text-[11px] text-wb-dim">Current Symbol</div>
                <div className="text-[20px] font-bold tracking-tight num text-wb-text">
                  {decision?.symbol ?? (symbolReady ? symbol : "—")}
                </div>
                <div className="text-[11px] text-wb-muted">
                  {decision ? "Uses only real-data agent signals for this legacy analysis." : "Analyze a ticker to restore the old experience"}
                </div>
              </div>
            </div>
          </div>

          {hasDecision ? (
            <LegacyAgentDebate decision={decision} />
          ) : (
            <ReadyState
              title="Stock Analysis (Old) is ready"
              body="Search for a ticker above to open the legacy stock analysis view."
            />
          )}
        </>
      )}

      {showSourceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-wb-surface border border-wb-border rounded-xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="px-4 py-3 border-b border-wb-border flex justify-between items-center bg-wb-surface2/60">
              <span className="text-[14px] font-bold text-wb-text">Data Provenance</span>
              <button
                type="button"
                onClick={() => setShowSourceModal(null)}
                className="text-wb-muted hover:text-wb-text text-[18px] font-semibold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="section-label">AI Agent</label>
                <div className="text-[15px] font-bold text-wb-orange mt-1">
                  {COMMITTEE_SECTIONS.find(s => s.id === showSourceModal)?.title}
                </div>
              </div>
              <div>
                <label className="section-label">Primary Info Source</label>
                <div className="text-[13px] font-semibold text-wb-text mt-1">
                  {AGENT_SOURCES[showSourceModal]?.source}
                </div>
              </div>
              <div>
                <label className="section-label">Technical Pipeline Details</label>
                <p className="text-[12px] text-wb-muted mt-1 leading-relaxed">
                  {AGENT_SOURCES[showSourceModal]?.details}
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowSourceModal(null)}
                  className="w-full btn btn-primary h-9 text-[13px] font-semibold cursor-pointer"
                >
                  I Understand
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReadyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-wb-surface border border-wb-border rounded-xl py-16 text-center shadow-card">
      <div className="w-12 h-12 rounded-2xl bg-wb-orange/10 flex items-center justify-center mx-auto mb-4">
        <Sparkles className="w-6 h-6 text-wb-orange" />
      </div>
      <div className="text-[15px] font-semibold text-wb-text mb-1">{title}</div>
      <div className="text-[13px] text-wb-muted">{body}</div>
    </div>
  );
}
