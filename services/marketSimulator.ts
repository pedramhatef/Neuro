
import { Candle, CryptoSymbol } from '../types';

// Updated Base Prices to reflect late 2024 Market Conditions
const BASE_PRICES: Record<CryptoSymbol, number> = {
  [CryptoSymbol.BTC]: 94500,
  [CryptoSymbol.ETH]: 3100,
  [CryptoSymbol.SOL]: 240,
  [CryptoSymbol.DOGE]: 0.38,
  [CryptoSymbol.XRP]: 1.10,
  [CryptoSymbol.ADA]: 0.75
};

export const generateInitialHistory = (symbol: CryptoSymbol, length: number, startPriceOverride?: number): Candle[] => {
  const candles: Candle[] = [];
  let currentPrice = startPriceOverride || BASE_PRICES[symbol];
  let time = Date.now() - (length * 60 * 1000); // Ensure strictly 1 min intervals

  for (let i = 0; i < length; i++) {
    // REALISM FIX: 0.08% volatility per minute is realistic for crypto scalping (was 0.5%)
    const volatility = currentPrice * 0.0008; 
    
    // Bias logic: Random walk with slight trend persistence
    const change = (Math.random() - 0.5) * volatility;
    
    const open = currentPrice;
    const close = currentPrice + change;
    
    // Wicks
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    
    // Trend Persistence
    if (Math.random() > 0.90) currentPrice += change * 2; 
    else currentPrice += change;

    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume: Math.floor(Math.random() * 1000) + 100
    });
    time += 60 * 1000;
  }
  return candles;
};

export const generateNextCandle = (lastCandle: Candle): Candle => {
  // REALISM FIX: Reduced volatility for live ticks
  const volatility = lastCandle.close * 0.0008; 
  const change = (Math.random() - 0.48) * volatility; // 0.48 center creates extremely slight bullish bias
  
  const open = lastCandle.close;
  const close = open + change;
  const high = Math.max(open, close) + Math.random() * volatility * 0.4;
  const low = Math.min(open, close) - Math.random() * volatility * 0.4;

  return {
    time: lastCandle.time + 60 * 1000, // Strictly 1 minute later
    open,
    high,
    low,
    close,
    volume: Math.floor(Math.random() * 1500) + 50
  };
};
