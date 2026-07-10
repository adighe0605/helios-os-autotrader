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
      <div className="flex items-center justify-between border-b border-wb-border pb-2">
        <div>
          <h1 className="text-[13px] font-semibold text-wb-text">AI Trading Committee</h1>
          <p className="text-[11px] text-wb-muted mt-0.5">
            Multi-agent debate: momentum · mean-reversion · sentiment · risk · portfolio manager
          </p>
        </div>
        <form onSubmit={analyze} className="flex items-center gap-2">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="w-32 px-3 py-1.5 bg-wb-surface2 border border-wb-border text-wb-text font-mono uppercase text-sm focus:outline-none focus:border-wb-orange transition-colors"
            placeholder="SNDL"
          />
          <button type="submit" disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-wb-orange text-black text-[12px] font-bold disabled:opacity-50 hover:brightness-110 transition">
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

