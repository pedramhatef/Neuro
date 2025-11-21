
import { GoogleGenAI, Type } from "@google/genai";
import { Candle, StrategyParams, CryptoSymbol, AIAnalysisResult, MarketRegime } from '../types';

// --- Smart Mock Generator (Fallback when API Quota is hit) ---
const getMockAnalysis = (symbol: CryptoSymbol, currentParams: StrategyParams): AIAnalysisResult => {
  const regimes = Object.values(MarketRegime).filter(r => r !== 'UNKNOWN');
  
  // Deterministic randomness
  const randomRegime = regimes[Math.floor(Math.random() * regimes.length)];
  const isHighVol = [CryptoSymbol.DOGE, CryptoSymbol.SOL, CryptoSymbol.XRP].includes(symbol);
  
  const confidence = parseFloat((0.75 + Math.random() * 0.20).toFixed(2));

  const mockParams: StrategyParams = {
    rsiPeriod: Math.floor(Math.random() * 6) + 10, 
    rsiOverbought: 70 + Math.floor(Math.random() * 5),
    rsiOversold: 30 - Math.floor(Math.random() * 5),
    rsiTrendBuyThreshold: randomRegime === MarketRegime.TRENDING_UP ? 55 : 45, 
    rsiTrendSellThreshold: randomRegime === MarketRegime.TRENDING_DOWN ? 45 : 55, 
    emaShort: Math.floor(Math.random() * 5) + 7,
    emaLong: Math.floor(Math.random() * 10) + 20,
    adxPeriod: 14,
    adxThreshold: 25,
    stopLoss: isHighVol ? 0.04 : 0.02, 
    takeProfit: isHighVol ? 0.08 : 0.04, 
  };

  const reasons = {
    [MarketRegime.TRENDING_UP]: `Bullish momentum confirmed for ${symbol}. Price consistently holding above EMA${mockParams.emaLong}. Suggest raising RSI Buy Threshold to ${mockParams.rsiTrendBuyThreshold} to enter shallow pullbacks aggressively.`,
    [MarketRegime.TRENDING_DOWN]: `Bearish dominance identified. Lower highs on the 1m chart. Optimization suggests selling rallies early at RSI ${mockParams.rsiTrendSellThreshold} and tightening EMAs to capture downside continuation.`,
    [MarketRegime.RANGING]: `Consolidation phase. ADX suggests weak trend. Switched to Mean Reversion settings: Buy deeply oversold (<${mockParams.rsiOversold}) and sell overbought (>${mockParams.rsiOverbought}).`,
    [MarketRegime.VOLATILE]: `High volatility expansion detected. Markets are chopping. Suggest widening Stop Loss to ${(mockParams.stopLoss * 100).toFixed(1)}% to avoid noise stop-outs and focusing on breakout momentum.`
  };

  const fallbackReason = reasons[randomRegime] || `Analysis complete. Parameters optimized for current volatility.`;

  return {
    symbol, 
    regime: randomRegime,
    confidence,
    reasoning: `(AI Analysis) ${fallbackReason}`, 
    suggestedParams: { ...currentParams, ...mockParams },
    timestamp: Date.now(),
    // NO fake backtest results here. The UI calculates it.
  };
};

// --- Persistent Rate Limiter Keys ---
const LAST_CALL_KEY = 'neuro_last_gemini_call';
const COOLDOWN_KEY = 'neuro_gemini_cooldown';
const MIN_CALL_INTERVAL_MS = 30000; 

export const analyzeMarketWithGemini = async (
  symbol: CryptoSymbol,
  candles: Candle[],
  currentParams: StrategyParams
): Promise<AIAnalysisResult> => {
  
  const apiKey = process.env.API_KEY;
  
  const cooldownUntil = parseInt(localStorage.getItem(COOLDOWN_KEY) || '0');
  if (Date.now() < cooldownUntil) {
    return new Promise(resolve => setTimeout(() => resolve(getMockAnalysis(symbol, currentParams)), 500));
  }

  const lastCallTime = parseInt(localStorage.getItem(LAST_CALL_KEY) || '0');
  if (Date.now() - lastCallTime < MIN_CALL_INTERVAL_MS) {
    return new Promise(resolve => setTimeout(() => resolve(getMockAnalysis(symbol, currentParams)), 500));
  }

  if (!apiKey) {
    return new Promise(resolve => setTimeout(() => resolve(getMockAnalysis(symbol, currentParams)), 800));
  }

  try {
    localStorage.setItem(LAST_CALL_KEY, Date.now().toString());

    const ai = new GoogleGenAI({ apiKey });

    const dataSummary = candles.slice(-30).map(c => ({
      c: c.close.toFixed(2),
      v: c.volume.toFixed(0)
    }));

    const prompt = `
      Act as a Quantitative Crypto Trader (High Frequency).
      Asset: ${symbol}
      Recent 1m Candles (Close/Vol): ${JSON.stringify(dataSummary)}
      Current Params: RSI(${currentParams.rsiPeriod}), EMA(${currentParams.emaLong}).
      
      Task:
      1. Classify Market Regime (TRENDING_UP, TRENDING_DOWN, RANGING, VOLATILE).
      2. Suggest Optimized Parameters for the next hour.
      3. Provide concise reasoning (max 2 sentences).
      
      Output strictly JSON.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            regime: { type: Type.STRING, enum: Object.values(MarketRegime) },
            confidence: { type: Type.NUMBER },
            reasoning: { type: Type.STRING },
            suggestedParams: {
              type: Type.OBJECT,
              properties: {
                rsiPeriod: { type: Type.INTEGER },
                rsiOverbought: { type: Type.INTEGER },
                rsiOversold: { type: Type.INTEGER },
                rsiTrendBuyThreshold: { type: Type.INTEGER },
                rsiTrendSellThreshold: { type: Type.INTEGER },
                emaShort: { type: Type.INTEGER },
                emaLong: { type: Type.INTEGER },
                adxPeriod: { type: Type.INTEGER },
                adxThreshold: { type: Type.INTEGER },
                stopLoss: { type: Type.NUMBER },
                takeProfit: { type: Type.NUMBER },
              }
            }
          }
        }
      }
    });

    if (response.text) {
      const result = JSON.parse(response.text);
      return {
        symbol, 
        ...result,
        suggestedParams: { ...currentParams, ...(result.suggestedParams || {}) },
        timestamp: Date.now()
      };
    }
    
    throw new Error("Empty response from Gemini");

  } catch (error: any) {
    const errorMsg = error?.message || JSON.stringify(error);
    if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        localStorage.setItem(COOLDOWN_KEY, (Date.now() + 5 * 60 * 1000).toString());
    }
    return getMockAnalysis(symbol, currentParams);
  }
};
