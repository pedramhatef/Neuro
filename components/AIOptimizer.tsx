
import React, { useState, useEffect } from 'react';
import { AIAnalysisResult, MarketRegime, StrategyParams, Candle, BacktestResult, CryptoSymbol } from '../types';
import { Cpu, TrendingUp, Activity, BarChart3, ArrowRight, Award, RefreshCw, ShieldCheck, Zap, Clock } from 'lucide-react';
import { runBacktest } from '../services/backtesting';

interface AIOptimizerProps {
  selectedSymbol: CryptoSymbol;
  analysis: AIAnalysisResult | null;
  isAnalyzing: boolean;
  optimizationStatus?: string | null;
  marketData: Candle[];
  currentStrategy: StrategyParams;
  currentRegime: MarketRegime;
  onUpdateMetrics?: (metrics: BacktestResult) => void;
}

export const AIOptimizer: React.FC<AIOptimizerProps> = ({ 
  selectedSymbol,
  analysis, 
  isAnalyzing, 
  optimizationStatus, 
  marketData,
  currentStrategy,
  currentRegime,
  onUpdateMetrics
}) => {
  // We calculates performance locally to ensure the numbers on screen 
  // are mathematically true for the current chart data.
  const [liveResult, setLiveResult] = useState<BacktestResult | null>(null);
  
  const validAnalysis = (analysis && analysis.symbol === selectedSymbol) ? analysis : null;

  // Auto-run backtest when data updates OR when strategy changes
  // This ensures the stats displayed matches the strategy currently being simulated
  useEffect(() => {
    if (!marketData || marketData.length < 50) return;
    
    // Debounce slightly to avoid churning cpu on every tick if not needed
    const timer = setTimeout(() => {
        try {
            const result = runBacktest(marketData, currentStrategy, currentRegime);
            setLiveResult(result);
            if (onUpdateMetrics && result) {
                onUpdateMetrics(result);
            }
        } catch (e) {
            console.error("Auto backtest failed", e);
        }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [marketData, currentStrategy, currentRegime, onUpdateMetrics]);

  const getRegimeColor = (regime?: MarketRegime) => {
    switch (regime) {
      case MarketRegime.TRENDING_UP: return 'text-emerald-400';
      case MarketRegime.TRENDING_DOWN: return 'text-rose-400';
      case MarketRegime.RANGING: return 'text-amber-400';
      case MarketRegime.VOLATILE: return 'text-purple-400';
      default: return 'text-zinc-400';
    }
  };

  const displayResult = liveResult || {
      netProfit: 0,
      winRate: 0,
      profitFactor: 0,
      sharpeRatio: 0
  };

  return (
    <div className="flex h-full w-full flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 shadow-sm backdrop-blur-sm overflow-hidden">
        
        {/* Header Section */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10 ${isAnalyzing ? 'animate-pulse' : ''}`}>
              <Cpu className={`h-4 w-4 ${isAnalyzing ? 'text-indigo-400' : 'text-indigo-500'}`} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Strategy Optimizer</h2>
              <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[10px] font-medium text-zinc-400">Auto-Pilot Active</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-1">
             {optimizationStatus ? (
                <span className="text-xs font-medium text-indigo-400 animate-pulse">{optimizationStatus}</span>
             ) : (
                <span className="text-xs font-medium text-zinc-500">System Idle</span>
             )}
             {validAnalysis?.lastLiveUpdate && (
                <div className="flex items-center gap-1 text-[10px] text-zinc-600">
                  <Clock className="h-3 w-3" />
                  <span>Updated {new Date(validAnalysis.lastLiveUpdate).toLocaleTimeString()}</span>
                </div>
             )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            
            {/* 1. Performance Metrics Grid - GUARANTEED ACCURATE (Client Side Calc) */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                        <Award className="h-3 w-3" /> Net Profit
                    </div>
                    <div className={`mt-1 text-lg font-bold ${displayResult.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${displayResult.netProfit.toFixed(2)}
                    </div>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                        <CrosshairIcon className="h-3 w-3" /> Win Rate
                    </div>
                    <div className="mt-1 text-lg font-bold text-zinc-100">
                        {displayResult.winRate.toFixed(1)}%
                    </div>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                        <ShieldCheck className="h-3 w-3" /> Profit Factor
                    </div>
                    <div className="mt-1 text-lg font-bold text-zinc-100">
                        {displayResult.profitFactor.toFixed(2)}
                    </div>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                        <Activity className="h-3 w-3" /> Sharpe
                    </div>
                    <div className="mt-1 text-lg font-bold text-zinc-100">
                        {displayResult.sharpeRatio?.toFixed(2)}
                    </div>
                </div>
            </div>

            {/* 2. Market Analysis Card */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-4">
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                        <Zap className="h-3 w-3 text-amber-400" />
                        AI Market Analysis
                    </h3>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 ${getRegimeColor(validAnalysis?.regime)}`}>
                        {validAnalysis?.regime || 'ANALYZING...'}
                    </span>
                </div>
                <div className="text-xs leading-relaxed text-zinc-400 bg-zinc-950/50 p-3 rounded border border-zinc-800/50">
                    {validAnalysis?.reasoning || "Gathering market data for initial strategy hypothesis..."}
                </div>
            </div>

            {/* 3. Adaptive Strategy Parameters */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-4">
                <h3 className="mb-3 text-xs font-semibold text-zinc-300 flex items-center gap-2">
                    <TrendingUp className="h-3 w-3 text-indigo-400" />
                    Active Parameters
                </h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
                    <div className="flex justify-between items-center border-b border-zinc-800/50 pb-1">
                        <span className="text-zinc-500">RSI Period</span>
                        <span className="font-mono text-zinc-200">{currentStrategy.rsiPeriod}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-zinc-800/50 pb-1">
                        <span className="text-zinc-500">EMA Trend</span>
                        <span className="font-mono text-zinc-200">{currentStrategy.emaShort} / {currentStrategy.emaLong}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-zinc-800/50 pb-1">
                        <span className="text-zinc-500">RSI Buy Threshold</span>
                        <span className="font-mono text-emerald-400 font-bold">{currentStrategy.rsiTrendBuyThreshold}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-zinc-800/50 pb-1">
                        <span className="text-zinc-500">RSI Sell Threshold</span>
                        <span className="font-mono text-rose-400 font-bold">{currentStrategy.rsiTrendSellThreshold}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                        <span className="text-zinc-500">Take Profit</span>
                        <span className="font-mono text-zinc-200">{(currentStrategy.takeProfit * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                        <span className="text-zinc-500">Stop Loss</span>
                        <span className="font-mono text-zinc-200">{(currentStrategy.stopLoss * 100).toFixed(1)}%</span>
                    </div>
                </div>
            </div>

        </div>
    </div>
  );
};

// Helper Icon
const CrosshairIcon = ({ className }: { className?: string }) => (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="22" y1="12" x2="18" y2="12" />
      <line x1="6" y1="12" x2="2" y2="12" />
      <line x1="12" y1="6" x2="12" y2="2" />
      <line x1="12" y1="22" x2="12" y2="18" />
    </svg>
);
