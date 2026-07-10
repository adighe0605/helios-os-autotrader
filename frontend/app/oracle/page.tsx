"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Bot, User, Trash2, ArrowUpRight, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/format";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTED_PROMPTS = [
  "Analyze SNDL — what do the agents say?",
  "What stocks should I trade today?",
  "Why are we holding open positions?",
  "How much money did I make today?",
  "What is my win rate?",
  "Intraday signal on AAPL?",
  "Should I buy TSLA?",
  "How much risk am I currently taking?",
];

export default function OraclePage() {
  const WELCOME = "Hello! I am **Oracle AI** — powered by the industry trading knowledge & AI agents that run your trading bot.\n\nI can answer questions using **real agent signals** (PennyMomentumAgent · MeanReversionAgent · SentimentAgent · RiskAgent · IntradayAgent):\n\n• *\"Analyze SNDL\"* — runs the full agent debate\n• *\"What stocks should I trade?\"* — live penny + blue chip scan\n• *\"Why are we holding TSLA?\"* — agent re-evaluation of open positions\n• *\"Intraday signal on NVDA?\"* — 5m VWAP/ORB check\n• *\"How much did I make today?\"* — live account data\n\nAsk me anything!";

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: WELCOME,
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(textToSend?: string) {
    const text = (textToSend ?? input).trim();
    if (!text) return;

    if (!textToSend) setInput("");

    // Add user message
    const nextMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const history = nextMessages.slice(1, -1).map((m) => ({
        role: m.role,
        content: m.content
      }));

      const res = await api.oracleChat({ prompt: text, history });
      setMessages((prev) => [...prev, { role: "assistant", content: res.response }]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I had trouble reaching the analytical engine. Please try again in a few moments."
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function clearHistory() {
    setMessages([
      {
        role: "assistant",
        content: WELCOME,
      }
    ]);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-[18px] font-bold text-wb-text tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-wb-orange" />
            Oracle AI Analyst
          </h1>
          <p className="text-[12px] text-wb-muted mt-0.5">Conversational quantitative analysis & auditing</p>
        </div>
        <button
          onClick={clearHistory}
          disabled={messages.length <= 1}
          className="btn btn-ghost btn-sm text-[12px] gap-1.5 disabled:opacity-40"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>

      {/* Main chat window */}
      <div className="flex-1 min-h-0 card flex flex-col overflow-hidden bg-wb-surface">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
          {messages.map((m, idx) => {
            const isBot = m.role === "assistant";
            return (
              <div
                key={idx}
                className={cn(
                  "flex gap-3 max-w-[85%] animate-fadeIn",
                  isBot ? "self-start" : "self-end flex-row-reverse ml-auto"
                )}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
                  style={isBot
                    ? { backgroundColor: "rgb(var(--wb-orange)/0.1)", borderColor: "rgb(var(--wb-orange)/0.2)", color: "rgb(var(--wb-orange))" }
                    : { backgroundColor: "#e2e8f0", borderColor: "#cbd5e1", color: "#475569" }}
                >
                  {isBot ? <Bot className="w-4.5 h-4.5" /> : <User className="w-4.5 h-4.5" />}
                </div>
                <div
                  className={cn("rounded-xl px-4 py-3 text-[13px] leading-relaxed shadow-sm border", isBot ? "bg-wb-surface2/50 border-wb-border/40 text-wb-text" : "")}
                  style={isBot ? {} : { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0", color: "#1e293b", fontWeight: 500 }}
                >
                  {/* Handle newlines and markdown-like bold text */}
                  {m.content.split("\n").map((para, pIdx) => {
                    // Simple regex for bold text replacement (**text**)
                    const parts = para.split(/(\*\*[^*]+\*\*)/g);
                    return (
                      <p key={pIdx} className={cn(pIdx > 0 && "mt-2")}>
                        {parts.map((part, partIdx) => {
                          if (part.startsWith("**") && part.endsWith("**")) {
                            return <strong key={partIdx} className="font-extrabold">{part.slice(2, -2)}</strong>;
                          }
                          // Handle inline code formatting (`text`)
                          const codeParts = part.split(/(`[^`]+`)/g);
                          return codeParts.map((cp, cpIdx) => {
                            if (cp.startsWith("`") && cp.endsWith("`")) {
                              return <code key={cpIdx} className="bg-black/20 px-1.5 py-0.5 rounded text-[11px] font-mono">{cp.slice(1, -1)}</code>;
                            }
                            return cp;
                          });
                        })}
                      </p>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex gap-3 max-w-[80%] animate-pulse">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-wb-orange/10 border border-wb-orange/20 text-wb-orange">
                <Bot className="w-4.5 h-4.5" />
              </div>
              <div className="bg-wb-surface2/50 border border-wb-border/40 rounded-xl px-4 py-3.5 flex items-center gap-1.5 h-9">
                <span className="w-1.5 h-1.5 rounded-full bg-wb-orange animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-wb-orange animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-wb-orange animate-bounce" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested prompts — always visible below messages */}
        {!loading && (
          <div className="p-3 border-t border-wb-border/30 bg-wb-surface2/20 flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                className="btn btn-ghost btn-sm text-[11px] h-7 px-3 rounded-full cursor-pointer hover:border-wb-orange/30 hover:bg-wb-orange/5 text-wb-muted hover:text-wb-text flex items-center gap-1"
              >
                {prompt}
                <ArrowUpRight className="w-3 h-3 text-wb-orange" />
              </button>
            ))}
          </div>
        )}

        {/* Input form */}
        <div className="p-3 border-t border-wb-border bg-wb-surface2/40 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Oracle: 'Analyze SNDL', 'top picks today', 'why holding TSLA?', 'intraday signal on AAPL'..."
              className="flex-1 px-4 h-10 bg-wb-surface border border-wb-border text-wb-text placeholder:text-wb-dim focus:outline-none focus:ring-1 focus:ring-wb-orange/40 focus:border-wb-orange/60 rounded-xl text-[13px] transition-all"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="btn btn-primary h-10 w-10 p-0 flex items-center justify-center rounded-xl disabled:opacity-40"
            >
              <Send className="w-4.5 h-4.5 text-black" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
