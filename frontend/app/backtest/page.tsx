import { BacktestForm } from "@/components/BacktestForm";

export default function BacktestPage() {
  return (
    <div className="space-y-4 max-w-[1400px]">
      <div>
        <h1 className="text-[18px] font-bold text-wb-text tracking-tight">Backtest</h1>
        <p className="text-[13px] text-wb-muted mt-0.5">
          Run a strategy against historical daily bars — reports total return, Sharpe, max drawdown, win rate.
        </p>
      </div>
      <BacktestForm />
    </div>
  );
}

