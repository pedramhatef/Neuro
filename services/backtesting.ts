
import { Candle, StrategyParams, BacktestResult, SignalType, MarketRegime } from '../types';
import { generateSignal } from './technicalAnalysis';

export const runBacktest = (
  data: Candle[], 
  params: StrategyParams, 
  regime: MarketRegime
): BacktestResult => {
  // Initial State
  const startingBalance = 10000;
  let balance = startingBalance;
  let position: { entryPrice: number; amount: number; costBasis: number } | null = null;
  
  // REALISM: Exchange Fees
  // 0.06% (Taker fee is more realistic for market orders than 0.04% blended)
  const FEE_RATE = 0.0006; 
  
  // Stats
  let tradeCount = 0;
  let wins = 0;
  let totalGrossProfit = 0;
  let totalGrossLoss = 0;
  let maxDrawdown = 0;
  let peakEquity = startingBalance;

  const equityCurve: number[] = [];

  // 1. Warmup Period
  const warmupPeriod = Math.max(params.rsiPeriod, params.emaLong, params.adxPeriod) + 20;
  
  if (data.length <= warmupPeriod) {
    return {
      netProfit: 0,
      winRate: 0,
      tradeCount: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      avgWin: 0,
      avgLoss: 0
    };
  }

  // 2. Simulation Loop
  for (let i = warmupPeriod; i < data.length; i++) {
    const currentCandle = data[i];
    
    // Generate signal based on data up to THIS candle
    const subset = data.slice(0, i + 1);
    const signal = generateSignal(subset, params, regime);

    // A. Manage Open Position (Intra-candle Check)
    if (position) {
      const entryPrice = position.entryPrice;
      const low = currentCandle.low;
      const high = currentCandle.high;
      
      // Calculate Hit Prices
      const stopLossPrice = entryPrice * (1 - params.stopLoss);
      const takeProfitPrice = entryPrice * (1 + params.takeProfit);

      let exitPrice = 0;
      let triggered = false;
      let exitType = '';

      // Conservative Testing:
      // If both SL and TP are within the High-Low range of this candle,
      // we assume Stop Loss was hit first to avoid over-optimism.
      const slHit = low <= stopLossPrice;
      const tpHit = high >= takeProfitPrice;

      if (slHit) {
        exitPrice = stopLossPrice; // We assume we get filled exactly at SL (slippage ignored for simplicity)
        triggered = true;
        exitType = 'SL';
      } else if (tpHit) {
        exitPrice = takeProfitPrice;
        triggered = true;
        exitType = 'TP';
      }

      // If not triggered by High/Low, check for Strategy Exit Signal (Reversal) at Close
      if (!triggered) {
        const isReversalSignal = signal.type === SignalType.SELL;
        
        // Only reverse if the reversal signal is strong and profitable enough to cover fees
        // Or if it's a hard "regime change" signal
        if (isReversalSignal) {
           exitPrice = currentCandle.close;
           triggered = true;
           exitType = 'SIGNAL';
        }
      }

      // Execute Exit
      if (triggered) {
        const grossExitValue = position.amount * exitPrice;
        const exitFee = grossExitValue * FEE_RATE;
        const netExitValue = grossExitValue - exitFee;
        
        // PnL calculation
        const pnl = netExitValue - position.costBasis;
        
        balance = netExitValue;
        
        if (pnl > 0) {
          wins++;
          totalGrossProfit += pnl;
        } else {
          totalGrossLoss += Math.abs(pnl);
        }
        tradeCount++;
        position = null; // Position Closed
      }
    } 
    
    // B. Open New Position
    // We enter if we have no position AND a Buy Signal
    if (!position && signal.type === SignalType.BUY) {
      // We simulate entering at the Close of the signal candle (Market Buy)
      const entryPrice = currentCandle.close;
      const costToEnter = balance;
      const entryFee = costToEnter * FEE_RATE;
      const netInvested = costToEnter - entryFee;
      
      position = {
        entryPrice: entryPrice,
        amount: netInvested / entryPrice,
        costBasis: costToEnter 
      };
    }

    // C. Track Equity for Metrics
    let currentEquity = balance;
    if (position) {
      // Mark-to-market using Close
      const currentValue = position.amount * currentCandle.close;
      const estFee = currentValue * FEE_RATE; // Exit fee
      currentEquity = currentValue - estFee;
    }
    equityCurve.push(currentEquity);

    if (currentEquity > peakEquity) peakEquity = currentEquity;
    const drawdown = (peakEquity - currentEquity) / peakEquity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // 3. Force Close at End
  if (position) {
     const lastPrice = data[data.length - 1].close;
     const grossExitValue = position!.amount * lastPrice;
     const exitFee = grossExitValue * FEE_RATE;
     const netExitValue = grossExitValue - exitFee;
     const pnl = netExitValue - position!.costBasis;
     
     balance = netExitValue;
     if (pnl > 0) {
       wins++;
       totalGrossProfit += pnl;
     } else {
       totalGrossLoss += Math.abs(pnl);
     }
     tradeCount++;
  }

  const netProfit = balance - startingBalance;

  // 4. Advanced Metrics
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const r = (equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1];
    returns.push(r);
  }

  let sharpeRatio = 0;

  if (returns.length > 0) {
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    // Annualize for 1m candles
    const ANNUAL_FACTOR = Math.sqrt(365 * 24 * 60); 

    if (stdDev > 0.00000001) {
      sharpeRatio = (meanReturn / stdDev) * ANNUAL_FACTOR;
    }
  }

  // Clamping
  if (sharpeRatio > 5) sharpeRatio = 5.0; 
  if (sharpeRatio < -5) sharpeRatio = -5.0;
  
  const losses = tradeCount - wins;
  const avgWin = wins > 0 ? totalGrossProfit / wins : 0;
  const avgLoss = losses > 0 ? totalGrossLoss / losses : 0;

  return {
    netProfit,
    winRate: tradeCount > 0 ? (wins / tradeCount) * 100 : 0,
    tradeCount,
    profitFactor: totalGrossLoss === 0 ? (totalGrossProfit > 0 ? 10 : 0) : totalGrossProfit / totalGrossLoss,
    maxDrawdown: maxDrawdown * 100,
    sharpeRatio,
    sortinoRatio: 0, // Simplified for now
    avgWin,
    avgLoss
  };
};
