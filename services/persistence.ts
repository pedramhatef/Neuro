import { CryptoSymbol, TradeSignal, StrategyParams, Candle, MarketRegime, AIAnalysisResult, AssetState } from '../types';
import { INITIAL_STRATEGY } from '../constants';
import { db } from '../src/firebaseConfig';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';

// --- Core Persistence Logic ---

export const saveAssetState = async (
  symbol: CryptoSymbol,
  data: {
    signals: TradeSignal[];
    candles: Candle[];
    strategy: StrategyParams;
    regime: MarketRegime;
    aiAnalysis?: AIAnalysisResult | null;
  }
) => {
  try {
    const candlesToStore = data.candles.slice(-300);

    const state: AssetState = {
      signals: data.signals || [], // Ensure signals is always an array
      cachedCandles: candlesToStore,
      strategy: data.strategy,
      regime: data.regime,
      aiAnalysis: data.aiAnalysis || null // Ensure aiAnalysis is null if undefined
    };

    await setDoc(doc(db, "assetStates", symbol), state);
  } catch (e) {
    console.error("Firestore Save Failed", e);
  }
};

export const loadAssetState = async (symbol: CryptoSymbol): Promise<AssetState | null> => {
  try {
    const docRef = doc(db, "assetStates", symbol);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as AssetState;
    } else {
      return null;
    }
  } catch (e) {
    console.error("Firestore Load Failed", e);
    return null;
  }
};

export const clearAssetState = async (symbol: CryptoSymbol) => {
  try {
    await deleteDoc(doc(db, "assetStates", symbol));
  } catch (e) {
    console.error("Firestore Delete Failed", e);
  }
};

// --- Helper to get initial strategy if DB is empty ---
export const getStrategyFor = async (symbol: CryptoSymbol): Promise<StrategyParams> => {
  const state = await loadAssetState(symbol);
  return state?.strategy || INITIAL_STRATEGY;
};