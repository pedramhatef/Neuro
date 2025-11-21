
import { StrategyParams, CryptoSymbol, MarketRegime, AIAnalysisResult } from '../types';

const STORAGE_KEY = 'neurotrade_q_table_v2';

interface QTableEntry {
  params: StrategyParams;
  analysis: AIAnalysisResult;
  score: number; // Net Profit from last training
  timestamp: number;
}

type QTable = Record<string, QTableEntry>;

const getQKey = (symbol: CryptoSymbol, regime: MarketRegime) => `${symbol}_${regime}`;

export const saveToQTable = (
  symbol: CryptoSymbol, 
  regime: MarketRegime, 
  params: StrategyParams,
  score: number,
  analysis: AIAnalysisResult
) => {
  try {
    const currentTableStr = localStorage.getItem(STORAGE_KEY);
    const currentTable: QTable = currentTableStr ? JSON.parse(currentTableStr) : {};
    
    const key = getQKey(symbol, regime);
    
    // Always update with the latest analysis for this regime if it's fresh
    // Or if score is better. 
    // We prioritize recency + performance.
    if (!currentTable[key] || score >= currentTable[key].score || (Date.now() - currentTable[key].timestamp > 1000 * 60 * 60)) {
      currentTable[key] = {
        params,
        analysis,
        score,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentTable));
      // console.log(`[Q-Learning] Saved analysis for ${key}`);
    }
  } catch (e) {
    console.error("Q-Learning Save Failed", e);
  }
};

export const getFromQTable = (symbol: CryptoSymbol, regime: MarketRegime): QTableEntry | null => {
  try {
    const currentTableStr = localStorage.getItem(STORAGE_KEY);
    if (!currentTableStr) return null;
    
    const currentTable: QTable = JSON.parse(currentTableStr);
    const entry = currentTable[getQKey(symbol, regime)];
    
    return entry || null;
  } catch (e) {
    return null;
  }
};
