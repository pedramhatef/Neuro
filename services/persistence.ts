import { CryptoSymbol, TradeSignal, StrategyParams, Candle, MarketRegime, AIAnalysisResult } from '../types';
import { INITIAL_STRATEGY } from '../constants';

const DB_PREFIX = 'neurotrade_db_v1_';

interface AssetState {
  signals: TradeSignal[];
  lastPrice: number;
  cachedCandles: Candle[];
  strategy: StrategyParams;
  regime: MarketRegime;
  aiAnalysis?: AIAnalysisResult | null;
}

// --- Core Persistence Logic ---

export const saveAssetState = (
  symbol: CryptoSymbol, 
  data: {
    signals: TradeSignal[];
    candles: Candle[];
    strategy: StrategyParams;
    regime: MarketRegime;
    aiAnalysis?: AIAnalysisResult | null;
  }
) => {
  try {
    // Store up to 300 candles to ensure we have enough history for 
    // indicators (EMA200) and backtesting immediately upon reload.
    const candlesToStore = data.candles.slice(-300); 
    
    const state: AssetState = {
      signals: data.signals,
      lastPrice: data.candles[data.candles.length - 1]?.close || 0,
      cachedCandles: candlesToStore,
      strategy: data.strategy,
      regime: data.regime,
      aiAnalysis: data.aiAnalysis
    };

    localStorage.setItem(`${DB_PREFIX}${symbol}`, JSON.stringify(state));
  } catch (e) {
    console.error("Database Save Failed (Quota Exceeded?)", e);
  }
};

export const loadAssetState = (symbol: CryptoSymbol): AssetState | null => {
  try {
    const data = localStorage.getItem(`${DB_PREFIX}${symbol}`);
    if (!data) return null;
    return JSON.parse(data);
  } catch (e) {
    console.error("Database Load Failed", e);
    return null;
  }
};

export const clearDatabase = () => {
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith(DB_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
  window.location.reload();
};

// --- Helper to get initial strategy if DB is empty ---
export const getStrategyFor = (symbol: CryptoSymbol): StrategyParams => {
  const state = loadAssetState(symbol);
  return state?.strategy || INITIAL_STRATEGY;
};
