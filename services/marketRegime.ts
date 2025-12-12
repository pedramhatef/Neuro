import { Candle, MarketRegime } from '../types';
import { calculateADX, calculateSMA } from './technicalAnalysis';

export const detectMarketRegime = (candles: Candle[]): { regime: MarketRegime; reason: string } => {
  if (candles.length < 50) {
    return { regime: MarketRegime.UNKNOWN, reason: "Insufficient data" };
  }

  const adxPeriod = 14;
  const adxValues = calculateADX(candles, adxPeriod);
  const currentADX = adxValues[adxValues.length - 1];

  const closes = candles.map(c => c.close);
  const sma50 = calculateSMA(closes, 50);
  const currentSMA = sma50[sma50.length - 1];
  const currentPrice = closes[closes.length - 1];

  // Volatility check 
  const recentCandles = candles.slice(-15);
  const high = Math.max(...recentCandles.map(c => c.high));
  const low = Math.min(...recentCandles.map(c => c.low));
  const percentRange = (high - low) / low;

  // Increased threshold to 2.5% to reduce false VOLATILE classifications
  // Prevents whipsaws from normal market fluctuations in choppy conditions
  if (percentRange > 0.025) { 
    return { regime: MarketRegime.VOLATILE, reason: `High Volatility detected (${(percentRange*100).toFixed(1)}% range)` };
  }

  // ADX logic
  if (currentADX > 20) { // Lowered from 25 to 20 to catch trends earlier
    const trendDirection = currentPrice > currentSMA ? MarketRegime.TRENDING_UP : MarketRegime.TRENDING_DOWN;
    return { 
      regime: trendDirection, 
      reason: `Strong Trend (ADX: ${currentADX.toFixed(1)} > 20). Price ${trendDirection === MarketRegime.TRENDING_UP ? 'above' : 'below'} SMA50.`
    };
  } else {
    return { 
      regime: MarketRegime.RANGING, 
      reason: `Choppy/Sideways Market (ADX: ${currentADX.toFixed(1)} < 20).` 
    };
  }
};