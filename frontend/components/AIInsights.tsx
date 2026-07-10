"use client";

import { Sparkles } from "lucide-react";

export function AIInsights({ headline, body }: { headline: string; body: string }) {
  return (
    <div className="bg-wb-surface border border-wb-border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-wb-border bg-wb-surface2">
        <Sparkles className="size-3.5 text-wb-orange" />
        <span className="text-[11px] font-semibold text-wb-text">AI Market Summary</span>
      </div>
      <div className="p-4">
        <p className="text-[13px] font-semibold text-wb-text leading-snug mb-2">{headline}</p>
        <p className="text-[12px] leading-relaxed text-wb-muted">{body}</p>
      </div>
    </div>
  );
}

