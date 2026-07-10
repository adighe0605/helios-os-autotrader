import { BacktestForm } from "@/components/BacktestForm";

export default function BacktestPage() {
  return (
    <div className="space-y-3">
      <div className="border-b border-wb-border pb-2">
        <h1 className="text-[13px] font-semibold text-wb-text">Backtest</h1>
        <p className="text-[11px] text-wb-muted mt-0.5">
          Run a strategy against historical daily bars — reports total return, Sharpe, max drawdown, win rate.
        </p>
      </div>
      <BacktestForm />
    </div>
  );
}

