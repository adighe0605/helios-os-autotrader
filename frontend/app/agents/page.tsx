"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { api } from "@/lib/api";
import { AgentDebate } from "@/components/AgentDebate";
import type { TradeDecision } from "@/lib/types";

export default function AgentsPage() {
  const [symbol,   setSymbol]   = useState("SNDL");
  const [decision, setDecision] = useState<TradeDecision | null>(null);
  const [loading,  setLoading]  = useState(false);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try { setDecision(await api.analyze(symbol)); }
    finally { setLoading(false); }
  }

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
                       text-[14px] font-bold focus:outline-none focus:ring-1 focus:ring-wb-orange/40
                       focus:border-wb-orange/60 rounded-lg transition-all duration-150"
            placeholder="SNDL"
            autoCapitalize="characters"
          />
          <button type="submit" disabled={loading}
            className="btn btn-primary disabled:opacity-50 whitespace-nowrap">
            <Sparkles className="w-3.5 h-3.5" />
            {loading ? "Debating…" : "Analyze"}
          </button>
        </form>
      </div>

      {decision ? (
        <AgentDebate decision={decision} />
      ) : (
        <div className="bg-wb-surface border border-wb-border rounded-xl py-16 text-center shadow-card">
          <div className="w-12 h-12 rounded-2xl bg-wb-orange/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-6 h-6 text-wb-orange" />
          </div>
          <div className="text-[15px] font-semibold text-wb-text mb-1">Ready to analyze</div>
          <div className="text-[13px] text-wb-muted">Enter a ticker above to convene the committee</div>
        </div>
      )}
    </div>
  );
}

