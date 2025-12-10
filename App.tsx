import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { AssetSelector } from './components/AssetSelector';
import { StatsCard } from './components/StatsCard';
import { PriceChart } from './components/PriceChart';
import { GlobalSignalFeed } from './components/GlobalSignalFeed';
import { AIOptimizer } from './components/AIOptimizer';
import { SUPPORTED_ASSETS, INITIAL_STRATEGY, TICK_INTERVAL_MS } from './constants';
import { Candle, CryptoSymbol, StrategyParams, TradeSignal, AIAnalysisResult, MarketRegime, SignalType, BacktestResult, AssetState } from './types';

// Services
import { fetchMarketData, mergeCandles, initSimulationState } from './services/marketData';
import { generateSignal } from './services/technicalAnalysis';
import { detectMarketRegime } from './services/marketRegime';
import { runGeneticOptimization } from './services/optimizer';
import { saveToQTable, getFromQTable } from './services/qLearning';
import { analyzeMarketWithGemini } from './services/geminiService';
import { saveAssetState, loadAssetState } from './services/persistence';
import { runBacktest } from './services/backtesting';
import { auth, db } from './src/firebaseConfig';
import { signInAnonymously } from 'firebase/auth';
import { collection, onSnapshot, query } from 'firebase/firestore';

import { TrendingUp, BarChart2, DollarSign, Activity } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [selectedSymbol, setSelectedSymbol] = useState<CryptoSymbol>(CryptoSymbol.BTC);
  
  // Data State
  const [data, setData] = useState<Candle[]>([]);
  const [signals, setSignals] = useState<TradeSignal[]>([]);
  const [globalSignals, setGlobalSignals] = useState<TradeSignal[]>([]);
  
  // The "Brain" State
  const [currentStrategy, setCurrentStrategy] = useState<StrategyParams>(INITIAL_STRATEGY);
  const [currentRegime, setCurrentRegime] = useState<MarketRegime>(MarketRegime.UNKNOWN);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  
  // UI State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [optimizationStatus, setOptimizationStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(true); // Changed to true for development

  // Refs for intervals/loops
  const dataRef = useRef<Candle[]>([]);
  const signalsRef = useRef<TradeSignal[]>([]);
  const strategyRef = useRef<StrategyParams>(INITIAL_STRATEGY);
  const regimeRef = useRef<MarketRegime>(MarketRegime.UNKNOWN);
  const selectedSymbolRef = useRef<CryptoSymbol>(CryptoSymbol.BTC);
  const aiAnalysisRef = useRef<AIAnalysisResult | null>(null);
  const optimizationIndexRef = useRef(0);

  // Sync refs with state
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { signalsRef.current = signals; }, [signals]);
  useEffect(() => { strategyRef.current = currentStrategy; }, [currentStrategy]);
  useEffect(() => { regimeRef.current = currentRegime; }, [currentRegime]);
  useEffect(() => { selectedSymbolRef.current = selectedSymbol; }, [selectedSymbol]);
  useEffect(() => { aiAnalysisRef.current = aiAnalysis; }, [aiAnalysis]);

  // --- 0. Authentication ---
  // Temporarily disable auth for easier development
  useEffect(() => {
    // signInAnonymously(auth)
    //   .then(() => setIsAuth(true))
    //   .catch((error) => console.error("Anonymous authentication failed:", error));
  }, []);

  // --- NEW: Global Signal Listener ---
  useEffect(() => {
    if (!isAuth) return;

    // Corrected collection name from "asset_states" to "assetStates"
    const q = collection(db, "assetStates"); // Changed from query(collection(db, "asset_states"))
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const allSignals: TradeSignal[] = [];
      querySnapshot.forEach((doc) => {
        const docSignals = doc.data().signals as TradeSignal[] || [];
        console.log(`Signals for ${doc.id}:`, docSignals);
        allSignals.push(...docSignals);
      });
      // Sort by most recent and take top 15
      const sortedSignals = allSignals.sort((a, b) => b.timestamp - a.timestamp);
      setGlobalSignals(sortedSignals.slice(0, 15));
    });

    return () => unsubscribe();
  }, [isAuth]);

    // --- Asset Selection Handler ---
  const handleAssetChange = useCallback((symbol: CryptoSymbol) => {
    if (symbol === selectedSymbol) return;

    setData([]);
    setSignals([]);
    setAiAnalysis(null);
    setIsLoading(true); 
    
    setSelectedSymbol(symbol);
  }, [selectedSymbol]);


  // --- 1. Init & Asset Switching ---
  useEffect(() => {
    if (!isAuth) return;
    let isActive = true;

    const loadAssetData = async () => {
      // No need to set isLoading here, handleAssetChange does it.
      const savedState = await loadAssetState(selectedSymbol);
      if (!isActive) return;

      if (savedState) {
        if (savedState.cachedCandles.length > 0) {
          initSimulationState(selectedSymbol, savedState.cachedCandles[savedState.cachedCandles.length - 1]);
        }
        setData(savedState.cachedCandles);
        setSignals(savedState.signals);
        setCurrentStrategy(savedState.strategy);
        setCurrentRegime(savedState.regime);
        setAiAnalysis(savedState.aiAnalysis || null);
      } else {
        // This case is for brand new assets, state is already cleared
         setCurrentStrategy(INITIAL_STRATEGY);
      }

      const fetchAmount = savedState && savedState.cachedCandles.length > 0 ? 50 : 200;
      try {
        const freshData = await fetchMarketData(selectedSymbol, fetchAmount);
        if (!isActive) return;

        const mergedData = mergeCandles(savedState?.cachedCandles || [], freshData);
        const regimeInfo = detectMarketRegime(mergedData);
        let strategyToUse = savedState?.strategy || INITIAL_STRATEGY;

        if (!savedState) {
          const learnedEntry = await getFromQTable(selectedSymbol, regimeInfo.regime);
          if (learnedEntry) {
            strategyToUse = learnedEntry.params;
            setAiAnalysis(learnedEntry.analysis);
          }
        }

        setData(mergedData);
        setCurrentRegime(regimeInfo.regime);
        if (!savedState) setCurrentStrategy(strategyToUse);

      } catch (error) {
        console.error("Failed to sync fresh market data", error);
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    loadAssetData();
    return () => { isActive = false; };
  }, [selectedSymbol, isAuth]);

  // --- 2. Live Data & Background Signal Loop ---
  useEffect(() => {
    if (!isAuth) return;
    let isActive = true;
    let backgroundAssetIndex = 0;

    const tick = async () => {
      if (!isActive) return;

      // A. Update ACTIVE Asset
      try {
        const freshData = await fetchMarketData(selectedSymbolRef.current, 5);
        if (isActive && selectedSymbolRef.current === selectedSymbol) {
          setData(prev => mergeCandles(prev, freshData).slice(-300));
        }
      } catch (e) { console.error("Active tick failed", e); }

      // B. Update & Generate Signals for ONE Background Asset
      const bgAssets = SUPPORTED_ASSETS.filter(a => a.symbol !== selectedSymbolRef.current);
      if (bgAssets.length > 0) {
        const bgAsset = bgAssets[backgroundAssetIndex % bgAssets.length];
        backgroundAssetIndex++;

        try {
          const saved = await loadAssetState(bgAsset.symbol);
          if (saved && saved.cachedCandles.length > 0) {
            const freshBgData = await fetchMarketData(bgAsset.symbol, 5);
            const updatedBgCandles = mergeCandles(saved.cachedCandles, freshBgData).slice(-300);
            const latestCandle = updatedBgCandles[updatedBgCandles.length - 1];

            const regimeInfo = detectMarketRegime(updatedBgCandles);
            const signalResult = generateSignal(updatedBgCandles, saved.strategy, regimeInfo.regime);
            
            let updatedSignals = saved.signals;
            const lastSignal = saved.signals[saved.signals.length - 1];
            const timeSinceLast = lastSignal ? latestCandle.time - lastSignal.timestamp : Infinity;
            const cooldown = 60 * 1000 * 5; // 5 minute cooldown for background signals

            if (signalResult.type !== SignalType.HOLD && timeSinceLast > cooldown) {
              const newSignal: TradeSignal = { id: crypto.randomUUID(), type: signalResult.type, price: latestCandle.close, timestamp: latestCandle.time, reason: signalResult.reason, symbol: bgAsset.symbol, regimeAtCreation: regimeInfo.regime };
              updatedSignals = [...saved.signals, newSignal];
            }

            const updatedMetrics = runBacktest(updatedBgCandles, saved.strategy, regimeInfo.regime);
            const updatedAnalysis = saved.aiAnalysis ? { ...saved.aiAnalysis, backtestResult: updatedMetrics, lastLiveUpdate: Date.now() } : null;

            await saveAssetState(bgAsset.symbol, { candles: updatedBgCandles, signals: updatedSignals, strategy: saved.strategy, regime: regimeInfo.regime, aiAnalysis: updatedAnalysis });
          }
        } catch (bgError) {
           // console.warn(`Background update skipped for ${bgAsset.symbol}`);
        }
      }
    };

    const intervalId = setInterval(tick, TICK_INTERVAL_MS * 2);
    return () => { isActive = false; clearInterval(intervalId); };
  }, [isAuth, selectedSymbol]);

  // --- 3. Automated Strategy Optimization Loop ---
  useEffect(() => {
    if (!isAuth) return;
    let isActive = true;
    const OPTIMIZATION_INTERVAL = 30000; // 30 seconds

    const runOptimizationStep = async () => {
      if (!isActive) return;

      const assets = SUPPORTED_ASSETS;
      const targetAsset = assets[optimizationIndexRef.current % assets.length];
      optimizationIndexRef.current++;

      if (targetAsset.symbol === selectedSymbolRef.current) {
        setIsAnalyzing(true);
        setOptimizationStatus(`AI Optimizing ${targetAsset.name}...`);
      }

      try {
        let assetCandles: Candle[];
        let assetStrategy: StrategyParams;
        let assetSignals: TradeSignal[];
        const isViewing = targetAsset.symbol === selectedSymbolRef.current;

        if (isViewing) {
          assetCandles = dataRef.current;
          assetStrategy = strategyRef.current;
          assetSignals = signalsRef.current;
        } else {
          const saved = await loadAssetState(targetAsset.symbol);
          assetSignals = saved?.signals || [];
          if (saved && saved.cachedCandles.length >= 200) {
            assetCandles = saved.cachedCandles;
            assetStrategy = saved.strategy;
          } else {
            assetCandles = await fetchMarketData(targetAsset.symbol, 250);
            assetStrategy = saved?.strategy || INITIAL_STRATEGY;
          }
        }

        if (assetCandles.length < 50) return;

        const geminiResult = await analyzeMarketWithGemini(targetAsset.symbol, assetCandles, assetStrategy);
        const { params: optimizedParams, result: backtestStats } = await runGeneticOptimization(assetCandles, geminiResult.regime);
        const finalAnalysis: AIAnalysisResult = { ...geminiResult, symbol: targetAsset.symbol, suggestedParams: optimizedParams, backtestResult: backtestStats, lastLiveUpdate: Date.now() };

        await saveToQTable(targetAsset.symbol, finalAnalysis.regime, optimizedParams, backtestStats.netProfit, finalAnalysis);
        const currentState = await loadAssetState(targetAsset.symbol);
        
        await saveAssetState(targetAsset.symbol, {
          signals: currentState?.signals || assetSignals,
          candles: currentState?.cachedCandles || assetCandles,
          strategy: optimizedParams,
          regime: finalAnalysis.regime,
          aiAnalysis: finalAnalysis
        });

        if (isActive && isViewing) {
          setAiAnalysis(finalAnalysis);
          setCurrentStrategy(optimizedParams);
          setCurrentRegime(finalAnalysis.regime);
          setOptimizationStatus("Updated");
          setTimeout(() => { if(isActive) setOptimizationStatus(null); }, 2000);
        }
      } catch (error) {
        console.warn(`Background Optimization Skipped for ${targetAsset.symbol}`, error);
      } finally {
        if (isActive && targetAsset.symbol === selectedSymbolRef.current) {
          setIsAnalyzing(false);
        }
      }
    };

    const timer = setInterval(runOptimizationStep, OPTIMIZATION_INTERVAL);
    const initialTimer = setTimeout(runOptimizationStep, 2000);
    return () => { isActive = false; clearInterval(timer); clearTimeout(initialTimer); };
  }, [isAuth]);

  // --- 4. Signal Processing Loop (Active Asset Only) ---
  useEffect(() => {
    if (data.length === 0 || !isAuth) return;

    const processSignals = async () => {
      const latestCandle = data[data.length - 1];
      const regimeInfo = detectMarketRegime(data);
      
      if (regimeInfo.regime !== regimeRef.current) {
        setCurrentRegime(regimeInfo.regime);
        const learnedEntry = await getFromQTable(selectedSymbol, regimeInfo.regime);
        if (learnedEntry) {
           setCurrentStrategy(learnedEntry.params);
           setAiAnalysis(learnedEntry.analysis);
        }
      }

      const signalResult = generateSignal(data, strategyRef.current, regimeRef.current);
      const lastSignal = signalsRef.current[signalsRef.current.length - 1];
      const timeSinceLast = lastSignal ? latestCandle.time - lastSignal.timestamp : Infinity;
      const cooldown = 60 * 1000; // 1 minute cooldown for active signals

      if (signalResult.type !== SignalType.HOLD && timeSinceLast > cooldown) {
        const newSignal: TradeSignal = { id: crypto.randomUUID(), type: signalResult.type, price: latestCandle.close, timestamp: latestCandle.time, reason: signalResult.reason, symbol: selectedSymbol, regimeAtCreation: regimeRef.current };
        const updatedSignals = [...signalsRef.current, newSignal];
        setSignals(updatedSignals);
        
        await saveAssetState(selectedSymbol, {
          signals: updatedSignals,
          candles: data,
          strategy: strategyRef.current,
          regime: regimeRef.current,
          aiAnalysis: aiAnalysisRef.current
        });
      } else {
        // Just save candles on hold
        await saveAssetState(selectedSymbol, {
          signals: signalsRef.current,
          candles: data,
          strategy: strategyRef.current,
          regime: regimeRef.current,
          aiAnalysis: aiAnalysisRef.current
        });
      }
    };
    processSignals();
  }, [data, isAuth, selectedSymbol]);

  // --- 5. Live Metric Sync ---
  const handleUpdateMetrics = useCallback(async (metrics: BacktestResult) => {
    if (!aiAnalysisRef.current || !isAuth) return;
    const updatedAnalysis: AIAnalysisResult = { ...aiAnalysisRef.current, backtestResult: metrics, lastLiveUpdate: Date.now() };
    setAiAnalysis(updatedAnalysis);
    await saveAssetState(selectedSymbolRef.current, {
       signals: signalsRef.current,
       candles: dataRef.current,
       strategy: strategyRef.current,
       regime: regimeRef.current,
       aiAnalysis: updatedAnalysis
    });
  }, [isAuth]);

  // --- Render ---
  const lastPrice = data.length > 0 ? data[data.length - 1].close : 0;
  const prevPrice = data.length > 1 ? data[data.length - 2].close : 0;

  if (!isAuth) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <Activity className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="ml-3 text-zinc-400">Connecting to services...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
      <Header />
      <main className="flex-1 p-4 md:p-6 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          <AssetSelector selectedSymbol={selectedSymbol} onSelect={handleAssetChange} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
            <div className="lg:col-span-2 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatsCard title="Current Price" value={`$${lastPrice.toFixed(4)}`} icon={DollarSign} subValue={`${lastPrice - prevPrice >= 0 ? '+' : ''}${(lastPrice - prevPrice).toFixed(4)}`} trend={lastPrice - prevPrice >= 0 ? 'up' : 'down'} />
                <StatsCard title="Market Regime" value={currentRegime.replace('_', ' ')} icon={Activity} color="text-purple-400" />
                <StatsCard title="Active Strategy" value={`RSI ${currentStrategy.rsiPeriod} / EMA ${currentStrategy.emaLong}`} icon={TrendingUp} />
                <StatsCard title="24h Volume" value={`${(data.reduce((acc, c) => acc + c.volume, 0) / 1000).toFixed(1)}k`} icon={BarChart2} color="text-emerald-400" />
              </div>
              <div className="flex-1 min-h-[450px]">
                 {isLoading ? (
                   <div className="h-full flex items-center justify-center bg-zinc-900/50 rounded-xl border border-zinc-800">
                     <Activity className="w-8 h-8 text-indigo-500 animate-spin}" />
                     <span className="ml-3 text-zinc-400">Syncing Market Data...</span>
                   </div>
                 ) : (
                   <PriceChart data={data} signals={signals} color={SUPPORTED_ASSETS.find(a => a.symbol === selectedSymbol)?.color || '#6366f1'} />
                 )}
              </div>
            </div>
            <div className="flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-1">
              <div className="flex-1 min-h-[500px]">
                <AIOptimizer 
                  selectedSymbol={selectedSymbol}
                  analysis={aiAnalysis}
                  isAnalyzing={isAnalyzing}
                  optimizationStatus={optimizationStatus}
                  marketData={data}
                  currentStrategy={currentStrategy}
                  currentRegime={currentRegime}
                  onUpdateMetrics={handleUpdateMetrics}
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