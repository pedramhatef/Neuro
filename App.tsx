
import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { AssetSelector } from './components/AssetSelector';
import { StatsCard } from './components/StatsCard';
import { PriceChart } from './components/PriceChart';
import { GlobalSignalFeed } from './components/GlobalSignalFeed';
import { AIOptimizer } from './components/AIOptimizer';
import { SUPPORTED_ASSETS, INITIAL_STRATEGY } from './constants';
import { Candle, CryptoSymbol, StrategyParams, TradeSignal, AIAnalysisResult, MarketRegime, AssetState } from './types';
import { auth, db } from './src/firebaseConfig';
import { signInAnonymously } from 'firebase/auth';
import { collection, onSnapshot, doc } from 'firebase/firestore';

import { TrendingUp, BarChart2, DollarSign, Activity } from 'lucide-react';

// --- Utility Functions ---
const getPriceDecimals = (symbol: CryptoSymbol) => {
    switch (symbol) {
        case CryptoSymbol.DOGE:
        case CryptoSymbol.XRP:
        case CryptoSymbol.ADA:
            return 4;
        default:
            return 2;
    }
};

// --- Main App Component ---
const App: React.FC = () => {
  // --- State ---
  const [selectedSymbol, setSelectedSymbol] = useState<CryptoSymbol>(CryptoSymbol.BTC);
  
  // Data State - All sourced from Firestore now
  const [assetState, setAssetState] = useState<AssetState | null>(null);
  const [globalSignals, setGlobalSignals] = useState<TradeSignal[]>([]);
  
  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);

  // --- 0. Authentication ---
  useEffect(() => {
    signInAnonymously(auth)
      .then(() => setIsAuth(true))
      .catch((error) => console.error("Anonymous authentication failed:", error));
  }, []);

  // --- 1. Global Signal Listener ---
  useEffect(() => {
    if (!isAuth) return;

    const q = collection(db, "assetStates");
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const allSignals: TradeSignal[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as AssetState;
        if (data.signals) {
          allSignals.push(...data.signals);
        }
      });
      // Sort by most recent and take top 15
      const sortedSignals = allSignals.sort((a, b) => b.timestamp - a.timestamp);
      setGlobalSignals(sortedSignals.slice(0, 15));
    });

    return () => unsubscribe();
  }, [isAuth]);

  // --- 2. Selected Asset State Listener ---
  useEffect(() => {
    if (!isAuth) return;
    
    setIsLoading(true);
    const assetDocRef = doc(db, "assetStates", selectedSymbol);

    const unsubscribe = onSnapshot(assetDocRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data() as AssetState;
            setAssetState({
                ...data,
                // Ensure candles and signals are always arrays
                cachedCandles: data.cachedCandles || [],
                signals: data.signals || []
            });
        } else {
            // Handle case where asset has no data yet
            setAssetState(null);
        }
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [selectedSymbol, isAuth]);

  // --- Asset Selection Handler ---
  const handleAssetChange = useCallback((symbol: CryptoSymbol) => {
    if (symbol !== selectedSymbol) {
        setSelectedSymbol(symbol);
    }
  }, [selectedSymbol]);


  // --- Render Logic ---
  if (!isAuth) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <Activity className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="ml-3 text-zinc-400">Connecting...</span>
      </div>
    );
  }
  
  const candles = assetState?.cachedCandles || [];
  const signals = assetState?.signals || [];
  const currentStrategy = assetState?.strategy || INITIAL_STRATEGY;
  const currentRegime = assetState?.regime || MarketRegime.UNKNOWN;
  const aiAnalysis = assetState?.aiAnalysis || null;

  const lastPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
  const prevPrice = candles.length > 1 ? candles[candles.length - 2].close : 0;
  const priceDecimals = getPriceDecimals(selectedSymbol);
  const totalVolume = candles.reduce((acc, c) => acc + c.volume, 0);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
      <Header />
      <main className="flex-1 p-4 md:p-6 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          <AssetSelector selectedSymbol={selectedSymbol} onSelect={handleAssetChange} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
            <div className="lg:col-span-2 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatsCard title="Current Price" value={`$${lastPrice.toFixed(priceDecimals)}`} icon={DollarSign} subValue={`${lastPrice - prevPrice >= 0 ? '+' : ''}${(lastPrice - prevPrice).toFixed(priceDecimals)}`} trend={lastPrice - prevPrice >= 0 ? 'up' : 'down'} />
                <StatsCard title="Market Regime" value={currentRegime.replace('_', ' ')} icon={Activity} color="text-purple-400" />
                <StatsCard title="Active Strategy" value={`RSI ${currentStrategy.rsiPeriod} / EMA ${currentStrategy.emaLong}`} icon={TrendingUp} />
                <StatsCard title="24h Volume" value={`${(totalVolume / 1000).toFixed(1)}k`} icon={BarChart2} color="text-emerald-400" />
              </div>
              <div className="flex-1 min-h-[450px]">
                 {isLoading ? (
                   <div className="h-full flex items-center justify-center bg-zinc-900/50 rounded-xl border border-zinc-800">
                     <Activity className="w-8 h-8 text-indigo-500 animate-spin" />
                     <span className="ml-3 text-zinc-400">Syncing Market Data for {selectedSymbol}...</span>
                   </div>
                 ) : (
                   <PriceChart symbol={selectedSymbol} data={candles} signals={signals} color={SUPPORTED_ASSETS.find(a => a.symbol === selectedSymbol)?.color || '#6366f1'} />
                 )}
              </div>
            </div>
            <div className="flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-1">
              <div className="flex-1 min-h-[500px]">
                <AIOptimizer 
                  selectedSymbol={selectedSymbol}
                  analysis={aiAnalysis}
                  isAnalyzing={false} // This is now handled by the backend cron job
                  marketData={candles}
                  currentStrategy={currentStrategy}
                  currentRegime={currentRegime}
                />
              </div>
              <GlobalSignalFeed signals={globalSignals} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
