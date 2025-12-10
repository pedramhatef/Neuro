import { StrategyParams, CryptoSymbol, MarketRegime, AIAnalysisResult } from '../types';
import { db } from '../src/firebaseConfig';
import { doc, setDoc, getDoc } from 'firebase/firestore';

interface QTableEntry {
  params: StrategyParams;
  analysis: AIAnalysisResult;
  score: number; // Net Profit from last training
  timestamp: number;
}

const getQKey = (symbol: CryptoSymbol, regime: MarketRegime) => `${symbol}_${regime}`;

export const saveToQTable = async (
  symbol: CryptoSymbol,
  regime: MarketRegime,
  params: StrategyParams,
  score: number,
  analysis: AIAnalysisResult
) => {
  try {
    const key = getQKey(symbol, regime);
    const docRef = doc(db, "qTable", key);
    const docSnap = await getDoc(docRef);
    
    let currentEntry: QTableEntry | null = null;
    if (docSnap.exists()) {
      currentEntry = docSnap.data() as QTableEntry;
    }

    // Always update with the latest analysis for this regime if it's fresh
    // Or if score is better.
    // We prioritize recency + performance.
    if (!currentEntry || score >= currentEntry.score || (Date.now() - currentEntry.timestamp > 1000 * 60 * 60)) {
      const newEntry: QTableEntry = {
        params,
        analysis,
        score,
        timestamp: Date.now()
      };
      await setDoc(docRef, newEntry);
      // console.log(`[Q-Learning] Saved analysis for ${key}`);
    }
  } catch (e) {
    console.error("Q-Learning Save Failed", e);
  }
};

export const getFromQTable = async (symbol: CryptoSymbol, regime: MarketRegime): Promise<QTableEntry | null> => {
  try {
    const key = getQKey(symbol, regime);
    const docRef = doc(db, "qTable", key);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as QTableEntry;
    } else {
      return null;
    }
  } catch (e) {
    console.error("Q-Learning Load Failed", e);
    return null;
  }
};