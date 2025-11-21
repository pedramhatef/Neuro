
export enum CryptoSymbol {
  BTC = 'BTC',
  ETH = 'ETH',
  SOL = 'SOL',
  DOGE = 'DOGE',
  XRP = 'XRP',
  ADA = 'ADA'
}

export enum SignalType {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD'
}

export enum MarketRegime {
  TRENDING_UP = 'TRENDING_UP',
  TRENDING_DOWN = 'TRENDING_DOWN',
  RANGING = 'RANGING',
  VOLATILE = 'VOLATILE',
  UNKNOWN = 'UNKNOWN'
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradeSignal {
  id: string;
  type: SignalType;
  price: number;
  timestamp: number;
  reason: string;
  symbol: CryptoSymbol;
  regimeAtCreation?: MarketRegime;
}

export interface StrategyParams {
  // RSI Indicators
  rsiPeriod: number;
  rsiOverbought: number; // For Ranging Sell
  rsiOversold: number;   // For Ranging Buy
  
  // Adaptive Trend Thresholds (NEW)
  // The AI will tune these. E.g., In strong trends, buy dips at RSI 60. In weak trends, wait for 40.
  rsiTrendBuyThreshold: number; 
  rsiTrendSellThreshold: number;

  // EMA Trends
  emaShort: number;
  emaLong: number;
  
  // ADX (Trend Strength)
  adxPeriod: number;
  adxThreshold: number; // Above this = Trending
  
  // Risk Management
  stopLoss: number; // % (e.g. 0.02 for 2%)
  takeProfit: number; // % (e.g. 0.04 for 4%)
}

export interface BacktestResult {
  netProfit: number;
  winRate: number;
  tradeCount: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  avgWin: number;
  avgLoss: number;
}

export interface OptimizationState {
  generation: number;
  bestFitness: number;
  populationSize: number;
  isOptimizing: boolean;
}

export interface AIAnalysisResult {
  symbol: CryptoSymbol; // ID Tag to prevent cross-contamination
  regime: MarketRegime;
  confidence: number;
  reasoning: string;
  suggestedParams: StrategyParams;
  timestamp: number;
  backtestResult?: BacktestResult;
  lastLiveUpdate?: number; // Timestamp of the last live backtest update
}
