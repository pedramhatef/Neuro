
import { StrategyParams, Candle, MarketRegime, BacktestResult } from '../types';
import { runBacktest } from './backtesting';
import { INITIAL_STRATEGY } from '../constants';

const POPULATION_SIZE = 20;
const GENERATIONS = 10;

// Helper to create random params within reasonable bounds
const randomParams = (): StrategyParams => ({
  rsiPeriod: Math.floor(Math.random() * 10) + 7, // 7-17
  rsiOverbought: Math.floor(Math.random() * 15) + 65, // 65-80
  rsiOversold: Math.floor(Math.random() * 15) + 20, // 20-35
  
  // Adaptive Thresholds
  rsiTrendBuyThreshold: Math.floor(Math.random() * 20) + 40, // 40-60
  rsiTrendSellThreshold: Math.floor(Math.random() * 20) + 40, // 40-60
  
  emaShort: Math.floor(Math.random() * 10) + 5, // 5-15
  emaLong: Math.floor(Math.random() * 30) + 20, // 20-50
  adxPeriod: 14,
  adxThreshold: 25,
  stopLoss: Math.random() * 0.04 + 0.01, // 1-5%
  takeProfit: Math.random() * 0.08 + 0.02 // 2-10%
});

// The Mutation Logic
const mutate = (params: StrategyParams): StrategyParams => {
  const p = { ...params };
  const mutationRate = 0.5; // 50% chance to mutate a given gene

  if (Math.random() < mutationRate) p.rsiPeriod = Math.max(2, p.rsiPeriod + (Math.random() > 0.5 ? 1 : -1));
  if (Math.random() < mutationRate) p.rsiOverbought = Math.min(99, Math.max(51, p.rsiOverbought + (Math.random() > 0.5 ? 2 : -2)));
  if (Math.random() < mutationRate) p.rsiOversold = Math.min(p.rsiOverbought - 10, Math.max(1, p.rsiOversold + (Math.random() > 0.5 ? 2 : -2)));
  
  if (Math.random() < mutationRate) p.rsiTrendBuyThreshold = Math.min(70, Math.max(30, p.rsiTrendBuyThreshold + (Math.random() > 0.5 ? 2 : -2)));
  if (Math.random() < mutationRate) p.rsiTrendSellThreshold = Math.min(70, Math.max(30, p.rsiTrendSellThreshold + (Math.random() > 0.5 ? 2 : -2)));

  if (Math.random() < mutationRate) p.emaShort = Math.max(2, p.emaShort + (Math.random() > 0.5 ? 1 : -1));
  if (Math.random() < mutationRate) p.emaLong = Math.max(p.emaShort + 5, p.emaLong + (Math.random() > 0.5 ? 2 : -2));
  
  if (Math.random() < mutationRate) p.stopLoss = Math.max(0.005, p.stopLoss * (Math.random() > 0.5 ? 1.1 : 0.9));
  if (Math.random() < mutationRate) p.takeProfit = Math.max(p.stopLoss + 0.01, p.takeProfit * (Math.random() > 0.5 ? 1.1 : 0.9));

  return p;
};

// The Crossover Logic
const crossover = (parent1: StrategyParams, parent2: StrategyParams): StrategyParams => {
    const child: Partial<StrategyParams> = {};
    const keys = Object.keys(parent1) as (keyof StrategyParams)[];
    for (const key of keys) {
        child[key] = Math.random() > 0.5 ? parent1[key] : parent2[key];
    }
    return child as StrategyParams;
};

// Fitness Function: Quality Score
// Updated to prioritize reliability (Win Rate + Profit Factor) over pure Net Profit.
// This prevents the AI from picking a strategy that just "got lucky" once.
const calculateFitness = (r: BacktestResult): number => {
    if (r.tradeCount === 0) return -1000;
    
    // Heavy Penalty for low trade count (Overfitting)
    const tradeCountPenalty = r.tradeCount < 5 ? 0.2 : 1;
    
    // Heavy Penalty for bad Profit Factor (Losing money due to fees)
    const pfScore = Math.min(r.profitFactor, 3); // Cap benefit at PF 3.0
    
    // Balance score: Profitability * Efficiency * Reliability
    // If PF < 1.0 (Losing system), score drops negative fast.
    const score = r.netProfit * pfScore * (r.winRate / 50) * tradeCountPenalty;
    
    return score;
};

export const runGeneticOptimization = async (
  data: Candle[], 
  regime: MarketRegime,
  onProgress?: (gen: number, bestProfit: number) => void
): Promise<{ params: StrategyParams, result: BacktestResult }> => {
  
  // 1. Initialize Population
  let population = Array(POPULATION_SIZE).fill(null).map(() => randomParams());
  population[0] = INITIAL_STRATEGY;

  let bestSolution = { params: INITIAL_STRATEGY, result: runBacktest(data, INITIAL_STRATEGY, regime) };

  // 2. Evolution Loop
  for (let gen = 0; gen < GENERATIONS; gen++) {
    
    // Evaluate Fitness
    const results = population.map(p => ({
      params: p,
      result: runBacktest(data, p, regime)
    }));

    // Sort by NEW Fitness Calculation
    results.sort((a, b) => calculateFitness(b.result) - calculateFitness(a.result));

    // Update Global Best
    if (calculateFitness(results[0].result) > calculateFitness(bestSolution.result)) {
      bestSolution = results[0];
    }

    if (onProgress) onProgress(gen + 1, results[0].result.netProfit);

    const survivors = results.slice(0, POPULATION_SIZE / 2).map(r => r.params);
    
    const nextGen: StrategyParams[] = [...survivors];
    while (nextGen.length < POPULATION_SIZE) {
      const p1 = survivors[Math.floor(Math.random() * survivors.length)];
      const p2 = survivors[Math.floor(Math.random() * survivors.length)];
      let child = crossover(p1, p2);
      if (Math.random() > 0.2) child = mutate(child); 
      nextGen.push(child);
    }
    
    population = nextGen;
    
    await new Promise(r => setTimeout(r, 10));
  }

  return bestSolution;
};
