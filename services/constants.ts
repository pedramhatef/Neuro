
import { CryptoSymbol, StrategyParams } from './types';

export const SUPPORTED_ASSETS = [
  { symbol: CryptoSymbol.BTC, name: 'Bitcoin', color: '#f59e0b' }, // Amber
  { symbol: CryptoSymbol.ETH, name: 'Ethereum', color: '#6366f1' }, // Indigo
  { symbol: CryptoSymbol.SOL, name: 'Solana', color: '#14f195' }, // Greenish
  { symbol: CryptoSymbol.DOGE, name: 'Dogecoin', color: '#fbbf24' }, // Yellow
  { symbol: CryptoSymbol.XRP, name: 'Ripple', color: '#38bdf8' }, // Sky
  { symbol: CryptoSymbol.ADA, name: 'Cardano', color: '#3b82f6' }, // Blue
];

export const INITIAL_STRATEGY: StrategyParams = {
  rsiPeriod: 14,
  rsiOverbought: 70,
  rsiOversold: 30,
  // CHANGED: Created a 10-point spread (45-55) to prevent 50/50 flickering
  rsiTrendBuyThreshold: 45, // Buy dips only when they are actually dips
  rsiTrendSellThreshold: 55, // Sell rallies only when they are actually rallies
  emaShort: 9,
  emaLong: 21,
  adxPeriod: 14,
  adxThreshold: 25,
  stopLoss: 0.02,
  takeProfit: 0.04
};

export const MAX_HISTORY_LENGTH = 200; // Longer history for backtesting
export const TICK_INTERVAL_MS = 5000; // Poll every 5s for real data
