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
    if (!currentEntry) {
      console.log(`[Q-Learning] No entry for ${key}. Creating new entry.`);
      const newEntry: QTableEntry = {
        params,
        analysis,
        score,
        timestamp: Date.now()
      };
      await setDoc(docRef, newEntry);
      console.log(`[Q-Learning] Saved new analysis for ${key} with score ${score}`);
    } else if (score >= currentEntry.score) {
        console.log(`[Q-Learning] New score ${score} is better than old score ${currentEntry.score} for ${key}. Updating entry.`);
        const newEntry: QTableEntry = {
            params,
            analysis,
            score,
            timestamp: Date.now()
        };
        await setDoc(docRef, newEntry);
        console.log(`[Q-Learning] Updated analysis for ${key} with new score ${score}`);
    } else if ((Date.now() - currentEntry.timestamp > 1000 * 60 * 60)) {
        console.log(`[Q-Learning] Entry for ${key} is stale. Updating entry.`);
        const newEntry: QTableEntry = {
            params,
            analysis,
            score,
            timestamp: Date.now()
        };
        await setDoc(docRef, newEntry);
        console.log(`[Q-Learning] Updated stale analysis for ${key} with new score ${score}`);
    } else {
        console.log(`[Q-Learning] New score ${score} is not better than old score ${currentEntry.score} for ${key}. Not updating.`);
    }

  } catch (e) {
    console.error("Q-Learning Save Failed", e);
  }
};

export const getFromQTable = async (symbol: CryptoSymbol, regime: MarketRegime): Promise<QTableEntry | null> => {
  try {
    const key = getQKey(symbol, regime);
    console.log(`[Q-Learning] Getting entry for ${key}`);
    const docRef = doc(db, "qTable", key);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      console.log(`[Q-Learning] Found entry for ${key}`);
      return docSnap.data() as QTableEntry;
    } else {
      console.log(`[Q-Learning] No entry found for ${key}`);
      return null;
    }
  } catch (e) {
    console.error("Q-Learning Load Failed", e);
    return null;
  }
};