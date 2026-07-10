"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { api } from "@/lib/api";
import { AgentDebate } from "@/components/AgentDebate";
import type { TradeDecision } from "@/lib/types";

export default function AgentsPage() {
  const [symbol, setSymbol] = useState("SNDL");
  const [decision, setDecision] = useState<TradeDecision | null>(null);
  const [loading, setLoading] = useState(false);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try { setDecision(await api.analyze(symbol)); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-3 border-b border-wb-border pb-2">
        <div className="flex-1 min-w-0">
          <h1 className="text-[13px] font-semibold text-wb-text">AI Trading Committee</h1>
          <p className="text-[11px] text-wb-muted mt-0.5">
            Multi-agent debate: momentum · mean-reversion · sentiment · risk · portfolio manager
          </p>
        </div>
        <form onSubmit={analyze} className="flex items-center gap-2 w-full sm:w-auto">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="flex-1 sm:w-32 px-3 py-2.5 min-h-[40px] bg-wb-surface2 border border-wb-border text-wb-text font-mono uppercase text-[12px] focus:outline-none focus:border-wb-orange transition-colors"
            placeholder="SNDL"
          />
          <button type="submit" disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2.5 min-h-[40px] bg-wb-orange text-black text-[12px] font-bold disabled:opacity-50 hover:brightness-110 transition whitespace-nowrap">
            <Sparkles className="size-3.5" />
            {loading ? "Debating…" : "Analyze"}
          </button>
        </form>
      </div>

      {decision ? (
        <AgentDebate decision={decision} />
      ) : (
        <div className="bg-wb-surface border border-wb-border py-12 text-center text-wb-muted text-[12px]">
          Enter a ticker above to convene the committee.
        </div>
      )}
    </div>
  );
}

