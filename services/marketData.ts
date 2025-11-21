
import { Candle, CryptoSymbol } from '../types';
import { generateInitialHistory, generateNextCandle } from './marketSimulator';

// Map our internal symbols to Binance Pairs
const SYMBOL_MAP: Record<CryptoSymbol, string> = {
  [CryptoSymbol.BTC]: 'BTCUSDT',
  [CryptoSymbol.ETH]: 'ETHUSDT',
  [CryptoSymbol.SOL]: 'SOLUSDT',
  [CryptoSymbol.DOGE]: 'DOGEUSDT',
  [CryptoSymbol.XRP]: 'XRPUSDT',
  [CryptoSymbol.ADA]: 'ADAUSDT',
};

// Simulation State
let useSimulationFallback = false;
const simulationState: Record<string, Candle> = {}; // Stores the last candle for each symbol

// Track last known real prices to seed simulation preventing jumps
const lastKnownPrices: Record<string, number> = {};

export const fetchMarketData = async (symbol: CryptoSymbol, limit = 100): Promise<Candle[]> => {
  // 1. SIMULATION MODE HANDLER
  if (useSimulationFallback) {
    const lastCandle = simulationState[symbol];
    
    // If we don't have history yet, generate full history
    if (!lastCandle) {
      // TRY TO USE LAST KNOWN PRICE to prevent chart spikes
      const startPrice = lastKnownPrices[symbol];
      const history = generateInitialHistory(symbol, limit, startPrice);
      simulationState[symbol] = history[history.length - 1];
      return history;
    }

    // If we have history, generate only NEW candles since last fetch
    const newCandles: Candle[] = [];
    let current = lastCandle;
    const count = Math.floor(Math.random() * 2) + 1; // Generate 1 or 2 candles per tick

    for (let i = 0; i < count; i++) {
      current = generateNextCandle(current);
      newCandles.push(current);
    }
    
    simulationState[symbol] = current; // Update tip
    return newCandles;
  }

  // 2. REAL API MODE
  try {
    const pair = SYMBOL_MAP[symbol];
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1m&limit=${limit}`);
    
    if (!response.ok) throw new Error('API Error');
    
    const data = await response.json();
    
    const parsedData: Candle[] = data.map((d: any) => ({
      time: d[0],
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5])
    }));

    // Update state for potential fallback
    if (parsedData.length > 0) {
        const lastDataPoint = parsedData[parsedData.length - 1];
        simulationState[symbol] = lastDataPoint;
        lastKnownPrices[symbol] = lastDataPoint.close;
    }

    return parsedData;

  } catch (error) {
    console.warn("Failed to fetch real data. Switching to Simulation Mode.", error);
    useSimulationFallback = true;
    
    // Recursive retry in simulation mode immediately
    return fetchMarketData(symbol, limit);
  }
};

export const mergeCandles = (existing: Candle[], newCandles: Candle[]): Candle[] => {
  if (existing.length === 0) return newCandles;
  if (newCandles.length === 0) return existing;
  
  const lastTime = existing[existing.length - 1].time;
  const newFirstTime = newCandles[0].time;

  // GAP DETECTION:
  // If the new data is more than 60 minutes ahead of the old data, 
  // it means the user was offline for a while. 
  // connecting them would create a huge flat line. 
  // In this case, we prefer the FRESH data and discard the old cache.
  if (newFirstTime - lastTime > 60 * 60 * 1000) {
    return newCandles;
  }

  // Filter strictly newer candles
  const newer = newCandles.filter(c => c.time > lastTime);
  
  // Live update logic: Update the very last candle if timestamps match (real-time price update)
  if (newer.length === 0 && newCandles.length > 0) {
    const latestFromFetch = newCandles[newCandles.length - 1];
    if (latestFromFetch.time === lastTime) {
       const updated = [...existing];
       updated[updated.length - 1] = latestFromFetch;
       return updated;
    }
  }

  return [...existing, ...newer];
};

export const initSimulationState = (symbol: CryptoSymbol, lastCandle: Candle) => {
  simulationState[symbol] = lastCandle;
  lastKnownPrices[symbol] = lastCandle.close;
};
