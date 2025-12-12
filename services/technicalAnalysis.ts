
import { Candle, StrategyParams, SignalType, MarketRegime } from '../types';

// --- Core Math Helpers ---

export const calculateSMA = (prices: number[], period: number): number[] => {
  const sma: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
      continue;
    }
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma.push(sum / period);
  }
  return sma;
};

export const calculateEMA = (prices: number[], period: number): number[] => {
  if (prices.length === 0) return [];
  const k = 2 / (period + 1);
  const emaArray: number[] = [prices[0]];
  
  for (let i = 1; i < prices.length; i++) {
    const ema = prices[i] * k + emaArray[i - 1] * (1 - k);
    emaArray.push(ema);
  }
  return emaArray;
};

export const calculateRSI = (prices: number[], period: number): number[] => {
  if (prices.length <= period) return Array(prices.length).fill(50);
  
  const rsiArray: number[] = [];
  let gains = 0;
  let losses = 0;

  // Initial calculation
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  rsiArray[period] = 100 - (100 / (1 + (avgGain / avgLoss)));

  // Smoothed calculation
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const currentGain = diff > 0 ? diff : 0;
    const currentLoss = diff < 0 ? -diff : 0;

    avgGain = ((avgGain * (period - 1)) + currentGain) / period;
    avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;

    const rs = avgGain / avgLoss;
    rsiArray[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
  }

  // Fill initial NaNs
  for(let i=0; i<=period; i++) {
      if(!rsiArray[i]) rsiArray[i] = 50;
  }

  return rsiArray; 
};

// --- Advanced Indicators (ADX/ATR/Bollinger) ---

export const calculateBollingerBands = (prices: number[], period: number = 20, stdDev: number = 2) => {
  const sma = calculateSMA(prices, period);
  const bands: { upper: number; lower: number; bandwidth: number }[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      bands.push({ upper: NaN, lower: NaN, bandwidth: 0 });
      continue;
    }

    const mean = sma[i];
    // Safe variance calc
    const slice = prices.slice(i - period + 1, i + 1);
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const sd = Math.sqrt(variance);

    const upper = mean + (sd * stdDev);
    const lower = mean - (sd * stdDev);
    const bandwidth = mean > 0 ? (upper - lower) / mean : 0;

    bands.push({ upper, lower, bandwidth });
  }
  return bands;
};

export const calculateADX = (candles: Candle[], period: number): number[] => {
  if (candles.length < period * 2) return Array(candles.length).fill(0);

  const plusDM: number[] = [0];
  const minusDM: number[] = [0];
  const tr: number[] = [0];

  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i-1].high;
    const downMove = candles[i-1].low - candles[i].low;

    plusDM.push((upMove > downMove && upMove > 0) ? upMove : 0);
    minusDM.push((downMove > upMove && downMove > 0) ? downMove : 0);
    
    tr.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i-1].close),
      Math.abs(candles[i].low - candles[i-1].close)
    ));
  }

  const smooth = (data: number[], p: number) => {
    const res: number[] = [];
    let sum = 0;
    for(let i=0; i<data.length; i++) {
      if (i < p) {
        sum += data[i];
        if (i === p - 1) res[i] = sum / p;
        else res[i] = 0;
      } else {
        res[i] = ((res[i-1] * (p - 1)) + data[i]) / p;
      }
    }
    return res;
  };

  const smoothTR = smooth(tr, period);
  const smoothPlusDM = smooth(plusDM, period);
  const smoothMinusDM = smooth(minusDM, period);

  const dx: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (!smoothTR[i] || smoothTR[i] === 0) {
      dx.push(0);
      continue;
    }
    const plusDI = 100 * smoothPlusDM[i] / smoothTR[i];
    const minusDI = 100 * smoothMinusDM[i] / smoothTR[i];
    
    const sum = plusDI + minusDI;
    dx.push(sum === 0 ? 0 : 100 * Math.abs(plusDI - minusDI) / sum);
  }

  return smooth(dx, period);
};

// --- Signal Generator ---

export const generateSignal = (
  candles: Candle[],
  params: StrategyParams,
  regime: MarketRegime
): { type: SignalType; reason: string } => {
  // Need enough data for Volume SMA(20) and Long EMAs
  if (candles.length < 50) return { type: SignalType.HOLD, reason: "Insufficient data" };

  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const currentPrice = closes[closes.length - 1];
  const currentVolume = volumes[volumes.length - 1];
  
  // 1. Calculate Key Indicators
  const rsiArr = calculateRSI(closes, params.rsiPeriod);
  const rsi = rsiArr[rsiArr.length - 1];
  const prevRsi = rsiArr[rsiArr.length - 2];
  const twoBarAgoRsi = rsiArr.length > 2 ? rsiArr[rsiArr.length - 3] : prevRsi;
  
  const emaShortArr = calculateEMA(closes, params.emaShort);
  const emaShort = emaShortArr[emaShortArr.length - 1];
  const prevEmaShort = emaShortArr.length > 1 ? emaShortArr[emaShortArr.length - 2] : emaShort;
  
  const emaLongArr = calculateEMA(closes, params.emaLong);
  const emaLong = emaLongArr[emaLongArr.length - 1];
  const prevEmaLong = emaLongArr[emaLongArr.length - 2];

  if (isNaN(rsi) || isNaN(emaLong)) return { type: SignalType.HOLD, reason: "Computing..." };

  // 2. Noise Filters
  
  // A. Volume Confirmation (Relative Volume)
  const volSMA = calculateSMA(volumes, 20);
  const avgVol = volSMA[volSMA.length - 1] || 0;
  
  // Robust Avg Volume to prevent division by zero errors
  const safeAvgVol = avgVol < 1 ? 100 : avgVol; 
  const relativeVolume = currentVolume / safeAvgVol;
  
  const hasVolumeSupport = relativeVolume >= 0.5; 

  // B. Bollinger Squeeze Filter
  const bb = calculateBollingerBands(closes, 20, 2);
  const currentBB = bb[bb.length - 1];
  // Block signals if bandwidth is extremely tight (waiting for explosion)
  const isSqueezing = currentBB.bandwidth < 0.0015; 

  if (isSqueezing && regime !== MarketRegime.VOLATILE) {
    return { type: SignalType.HOLD, reason: "Market Squeeze (Low Volatility)" };
  }

  // C. EMA Slope (Trend Direction)
  const isLongTrendUp = emaLong > prevEmaLong;
  const isLongTrendDown = emaLong < prevEmaLong;

  // Formatting helpers
  const rsiFmt = rsi.toFixed(1);
  const volFmt = relativeVolume.toFixed(2);

  // --- Logic per Regime ---
  
  if (regime === MarketRegime.TRENDING_UP) {
    const isPullback = rsi < params.rsiTrendBuyThreshold; 
    const isStructureIntact = currentPrice > emaLong;
    const isTrendHealthy = isLongTrendUp; 
    const isAlignment = emaShort > emaLong; 
    const isHookingUp = rsi > prevRsi; 

    if (isPullback && isStructureIntact && isTrendHealthy && isAlignment && isHookingUp) { 
      return { 
        type: SignalType.BUY, 
        reason: `Trend Pullback Buy: RSI ${rsiFmt} < ${params.rsiTrendBuyThreshold}.`
      };
    }
  } 
  else if (regime === MarketRegime.TRENDING_DOWN) {
    const isRally = rsi > params.rsiTrendSellThreshold; 
    const isStructureIntact = currentPrice < emaLong;
    const isTrendHealthy = isLongTrendDown;
    const isAlignment = emaShort < emaLong;
    const isHookingDown = rsi < prevRsi;

    if (isRally && isStructureIntact && isTrendHealthy && isAlignment && isHookingDown) {
      return { 
        type: SignalType.SELL, 
        reason: `Trend Rally Sell: RSI ${rsiFmt} > ${params.rsiTrendSellThreshold}.`
      };
    }
  }
  else if (regime === MarketRegime.RANGING) {
    // MEAN REVERSION
    // Check if we are re-entering from extremes
    if (prevRsi < params.rsiOversold && rsi > prevRsi && rsi > params.rsiOversold) {
      return { 
        type: SignalType.BUY, 
        reason: `Mean Reversion Buy: RSI ${rsiFmt} hooking up from Oversold.`
      };
    }
    if (prevRsi > params.rsiOverbought && rsi < prevRsi && rsi < params.rsiOverbought) {
      return { 
        type: SignalType.SELL, 
        reason: `Mean Reversion Sell: RSI ${rsiFmt} hooking down from Overbought.`
      };
    }
  }
  else if (regime === MarketRegime.VOLATILE) {
    // MOMENTUM BREAKOUTS
    // We look for price breaking AWAY from EMAs with volume
    if (currentPrice > emaShort && rsi > 60 && rsi < 85 && relativeVolume > 1.2) { 
      return { 
        type: SignalType.BUY, 
        reason: `Momentum Breakout: Price > EMA. Surge Vol ${volFmt}x.`
      };
    }
    if (currentPrice < emaShort && rsi < 40 && rsi > 15 && relativeVolume > 1.2) {
      return { 
        type: SignalType.SELL, 
        reason: `Momentum Breakdown: Price < EMA. Surge Vol ${volFmt}x.`
      };
    }
  }

  // --- Fallback: Golden/Death Cross ---
  if (!isSqueezing) {
      const prevEmaShort = emaShortArr[emaShortArr.length - 2];

      if (prevEmaShort <= prevEmaLong && emaShort > emaLong && hasVolumeSupport && isLongTrendUp) {
         return { 
           type: SignalType.BUY, 
           reason: `Golden Cross: EMA${params.emaShort} crossed EMA${params.emaLong}.`
         };
      }
      
      if (prevEmaShort >= prevEmaLong && emaShort < emaLong && hasVolumeSupport && isLongTrendDown) {
         return { 
           type: SignalType.SELL, 
           reason: `Death Cross: EMA${params.emaShort} crossed below EMA${params.emaLong}.`
         };
      }
  }

  return { type: SignalType.HOLD, reason: "" };
};
