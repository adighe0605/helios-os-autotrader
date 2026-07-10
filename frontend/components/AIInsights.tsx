"use client";

import { Sparkles } from "lucide-react";

export function AIInsights({ headline, body }: { headline: string; body: string }) {
  return (
    <div className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-wb-border">
        <div className="w-7 h-7 rounded-lg bg-wb-orange/10 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-wb-orange" />
        </div>
        <span className="text-[13px] font-semibold text-wb-text">AI Market Summary</span>
      </div>
      <div className="p-4 space-y-2">
        <p className="text-[14px] font-semibold text-wb-text leading-snug">{headline}</p>
        <p className="text-[13px] leading-relaxed text-wb-muted">{body}</p>
      </div>
    </div>
  );
}

