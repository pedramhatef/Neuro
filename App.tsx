import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { AssetSelector } from './components/AssetSelector';
import { StatsCard } from './components/StatsCard';
import { PriceChart } from './components/PriceChart';
import { SignalFeed } from './components/SignalFeed';
import { AIOptimizer } from './components/AIOptimizer';
import { SUPPORTED_ASSETS, INITIAL_STRATEGY, TICK_INTERVAL_MS } from './constants';
import { Candle, CryptoSymbol, StrategyParams, TradeSignal, AIAnalysisResult, MarketRegime, SignalType, BacktestResult } from './types';

// Services
import { fetchMarketData, mergeCandles, initSimulationState } from './services/marketData';
import { generateSignal } from './services/technicalAnalysis';
import { detectMarketRegime } from './services/marketRegime';
import { runGeneticOptimization } from './services/optimizer';
import { saveToQTable, getFromQTable } from './services/qLearning';
import { analyzeMarketWithGemini } from './services/geminiService';
import { saveAssetState, loadAssetState } from './services/persistence';
import { runBacktest } from './services/backtesting';

import { TrendingUp, BarChart2, DollarSign, Activity } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [selectedSymbol, setSelectedSymbol] = useState<CryptoSymbol>(CryptoSymbol.BTC);
  
  // Data State
  const [data, setData] = useState<Candle[]>([]);
  const [signals, setSignals] = useState<TradeSignal[]>([]);
  
  // The "Brain" State
  const [currentStrategy, setCurrentStrategy] = useState<StrategyParams>(INITIAL_STRATEGY);
  const [currentRegime, setCurrentRegime] = useState<MarketRegime>(MarketRegime.UNKNOWN);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  
  // UI State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [optimizationStatus, setOptimizationStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Refs for intervals/loops to prevent stale closures and race conditions
  const dataRef = useRef<Candle[]>([]);
  const signalsRef = useRef<TradeSignal[]>([]);
  const strategyRef = useRef<StrategyParams>(INITIAL_STRATEGY);
  const regimeRef = useRef<MarketRegime>(MarketRegime.UNKNOWN);
  const selectedSymbolRef = useRef<CryptoSymbol>(CryptoSymbol.BTC);
  const aiAnalysisRef = useRef<AIAnalysisResult | null>(null);
  
  // Index for background optimization rotation
  const optimizationIndexRef = useRef(0);

  // Sync refs with state
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { signalsRef.current = signals; }, [signals]);
  useEffect(() => { strategyRef.current = currentStrategy; }, [currentStrategy]);
  useEffect(() => { regimeRef.current = currentRegime; }, [currentRegime]);
  useEffect(() => { selectedSymbolRef.current = selectedSymbol; }, [selectedSymbol]);
  useEffect(() => { aiAnalysisRef.current = aiAnalysis; }, [aiAnalysis]);

  // --- 1. Init & Asset Switching (Robust) ---
  useEffect(() => {
    let isActive = true; // Prevent race conditions

    const loadAssetData = async () => {
      // 1. Optimistic Load from Cache
      const savedState = loadAssetState(selectedSymbol);
      
      if (!isActive) return; // If user switched symbol while reading cache, stop.

      if (savedState) {
        // Init simulation with last saved candle to prevent jumps
        if (savedState.cachedCandles.length > 0) {
          initSimulationState(selectedSymbol, savedState.cachedCandles[savedState.cachedCandles.length - 1]);
        }

        // RENDER IMMEDIATELY
        setData(savedState.cachedCandles);
        setSignals(savedState.signals);
        setCurrentStrategy(savedState.strategy);
        setCurrentRegime(savedState.regime);
        setAiAnalysis(savedState.aiAnalysis || null);
        setIsLoading(false); 
      } else {
        // CLEAN STATE IMMEDIATELY if no cache, to avoid showing previous coin's data
        setData([]);
        setSignals([]);
        setAiAnalysis(null);
        setCurrentStrategy(INITIAL_STRATEGY);
        setIsLoading(true); 
      }

      // 2. Background Fetch & Merge
      // Fetch full history if no cache, small update if cache exists
      const fetchAmount = savedState && savedState.cachedCandles.length > 0 ? 50 : 200; 
      
      try {
        const freshData = await fetchMarketData(selectedSymbol, fetchAmount);
        
        if (!isActive) return; // Check again after await

        // Merge logic
        const currentData = savedState ? savedState.cachedCandles : [];
        const mergedData = mergeCandles(currentData, freshData);
        
        // Update Regime with latest data
        const regimeInfo = detectMarketRegime(mergedData);
        
        // Determine strategy (if fresh load)
        let strategyToUse = savedState ? savedState.strategy : INITIAL_STRATEGY;
        
        // Fallback to Q-Table memory if we have no saved state for this coin
        if (!savedState) {
           const learnedEntry = getFromQTable(selectedSymbol, regimeInfo.regime);
           if (learnedEntry) {
             strategyToUse = learnedEntry.params;
             // Restore the AI analysis from memory so the box isn't empty
             setAiAnalysis(learnedEntry.analysis); 
           }
        }

        // Update State safely
        setData(mergedData);
        setCurrentRegime(regimeInfo.regime);
        
        if (!savedState) {
          setCurrentStrategy(strategyToUse);
        }

      } catch (error) {
        console.error("Failed to sync fresh market data", error);
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    loadAssetData();

    // Cleanup function ensures we ignore results if the component unmounts or symbol changes
    return () => {
      isActive = false;
    };
  }, [selectedSymbol]);

  // --- 2. Live Data Loop (The Heartbeat for Data) ---
  useEffect(() => {
    let isActive = true;
    let backgroundAssetIndex = 0; // Round robin cursor for data updates

    const tick = async () => {
      if (!isActive) return;

      // A. Update ACTIVE Asset (High Priority)
      try {
        const freshData = await fetchMarketData(selectedSymbol, 5); 
        
        if (isActive) {
          setData(prev => {
            const updated = mergeCandles(prev, freshData);
            return updated.slice(-300); // Keep array size consistent
          });
        }
      } catch (e) {
        console.error("Active tick failed", e);
      }

      // B. Update ONE Background Asset (Low Priority)
      const bgAssets = SUPPORTED_ASSETS.filter(a => a.symbol !== selectedSymbol);
      if (bgAssets.length > 0) {
        const bgAsset = bgAssets[backgroundAssetIndex % bgAssets.length];
        backgroundAssetIndex++;

        try {
          const saved = loadAssetState(bgAsset.symbol);
          if (saved && saved.cachedCandles.length > 0) {
             const freshBgData = await fetchMarketData(bgAsset.symbol, 5);
             const updatedBgCandles = mergeCandles(saved.cachedCandles, freshBgData).slice(-300);
             
             // Recalculate Regime & Backtest Metrics for background assets
             const regimeInfo = detectMarketRegime(updatedBgCandles);
             const updatedMetrics = runBacktest(updatedBgCandles, saved.strategy, regimeInfo.regime);
             
             const updatedAnalysis = saved.aiAnalysis ? {
               ...saved.aiAnalysis,
               backtestResult: updatedMetrics,
               lastLiveUpdate: Date.now()
             } : null;

             saveAssetState(bgAsset.symbol, {
               ...saved,
               candles: updatedBgCandles,
               regime: regimeInfo.regime,
               aiAnalysis: updatedAnalysis
             });
          }
        } catch (bgError) {
          // console.warn(`Background update skipped for ${bgAsset.symbol}`);
        }
      }
    };

    const intervalId = setInterval(tick, TICK_INTERVAL_MS);
    return () => { isActive = false; clearInterval(intervalId); };
  }, [selectedSymbol]);

  // --- 3. Automated Strategy Optimization Loop (The Brain Heartbeat) ---
  useEffect(() => {
    let isActive = true;

    // Runs every 30 seconds to match the Service Safe Mode
    // This ensures we stick to ~2 requests per minute which is super safe for Free Tier
    const OPTIMIZATION_INTERVAL = 30000;

    const runOptimizationStep = async () => {
        if (!isActive) return;

        // Pick next asset in the list (Round Robin)
        const assets = SUPPORTED_ASSETS;
        const assetIndex = optimizationIndexRef.current % assets.length;
        const targetAsset = assets[assetIndex];
        optimizationIndexRef.current++;

        // Check initially just to update the UI text if it matches
        if (targetAsset.symbol === selectedSymbolRef.current) {
            setIsAnalyzing(true);
            setOptimizationStatus(`AI Optimizing ${targetAsset.name}...`);
        }

        try {
            // 1. Load Data for Target Asset
            let assetCandles: Candle[] = [];
            let assetStrategy = INITIAL_STRATEGY;
            let assetSignals: TradeSignal[] = [];
            
            const isCurrentlyViewing = targetAsset.symbol === selectedSymbolRef.current;
            
            if (isCurrentlyViewing) {
                assetCandles = dataRef.current;
                assetStrategy = strategyRef.current;
                assetSignals = signalsRef.current;
            } else {
                const saved = loadAssetState(targetAsset.symbol);
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

            // 2. Gemini Analysis
            const geminiResult = await analyzeMarketWithGemini(targetAsset.symbol, assetCandles, assetStrategy);

            // 3. Genetic Optimization
            const { params: optimizedParams, result: backtestStats } = await runGeneticOptimization(
                assetCandles,
                geminiResult.regime
            );

            // 4. Construct Result
            const finalAnalysis: AIAnalysisResult = {
                ...geminiResult,
                symbol: targetAsset.symbol, 
                suggestedParams: optimizedParams,
                backtestResult: backtestStats,
                lastLiveUpdate: Date.now()
            };

            // 5. Save & Sync
            // Save to Q-Table with full analysis so we can recall it later
            saveToQTable(
              targetAsset.symbol, 
              finalAnalysis.regime, 
              optimizedParams, 
              backtestStats.netProfit,
              finalAnalysis
            );
            
            // Refresh latest state before saving to avoid overwriting data from main loop
            const currentState = loadAssetState(targetAsset.symbol);
            
            saveAssetState(targetAsset.symbol, {
                signals: currentState?.signals || assetSignals,
                candles: currentState?.cachedCandles || assetCandles,
                strategy: optimizedParams,
                regime: finalAnalysis.regime,
                aiAnalysis: finalAnalysis
            });

            const isStillViewing = isActive && targetAsset.symbol === selectedSymbolRef.current;

            if (isStillViewing) {
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

    // Start the loop
    const timer = setInterval(runOptimizationStep, OPTIMIZATION_INTERVAL);
    
    // Run first step after short delay
    const initialTimer = setTimeout(runOptimizationStep, 2000);

    return () => {
        isActive = false;
        clearInterval(timer);
        clearTimeout(initialTimer);
    };
  }, []); 


  // --- 4. Signal Processing Loop (Active Asset Only) ---
  useEffect(() => {
    if (data.length === 0) return;

    const processSignals = () => {
      const currentData = data; 
      const latestCandle = currentData[currentData.length - 1];
      
      // Detect Regime changes in real-time
      const regimeInfo = detectMarketRegime(currentData);
      if (regimeInfo.regime !== currentRegime) {
        setCurrentRegime(regimeInfo.regime);
        
        // Retrieve Memory from Q-Table
        // If we've seen this regime before, load the best parameters AND the analysis text
        const learnedEntry = getFromQTable(selectedSymbol, regimeInfo.regime);
        if (learnedEntry) {
           setCurrentStrategy(learnedEntry.params);
           setAiAnalysis(learnedEntry.analysis); // Update UI with context for this regime
        }
      }

      const signalResult = generateSignal(currentData, currentStrategy, currentRegime);

      const lastSignal = signals[signals.length - 1];
      const timeSinceLast = lastSignal ? latestCandle.time - lastSignal.timestamp : Infinity;
      const cooldown = 60 * 1000; 

      if (signalResult.type !== SignalType.HOLD && timeSinceLast > cooldown) {
        const newSignal: TradeSignal = {
          id: crypto.randomUUID(),
          type: signalResult.type,
          price: latestCandle.close,
          timestamp: latestCandle.time,
          reason: signalResult.reason,
          symbol: selectedSymbol,
          regimeAtCreation: currentRegime
        };
        const updatedSignals = [...signals, newSignal];
        setSignals(updatedSignals);
        
        // Refresh state before saving
        const freshState = loadAssetState(selectedSymbol);
        
        saveAssetState(selectedSymbol, {
          signals: updatedSignals,
          candles: currentData,
          strategy: currentStrategy,
          regime: currentRegime,
          aiAnalysis: freshState?.aiAnalysis || aiAnalysisRef.current 
        });
      } else {
        // Just save current data
        const freshState = loadAssetState(selectedSymbol);
        saveAssetState(selectedSymbol, {
          signals: signals,
          candles: currentData,
          strategy: currentStrategy,
          regime: currentRegime,
          aiAnalysis: freshState?.aiAnalysis || aiAnalysisRef.current
        });
      }
    };
    processSignals();
  }, [data, currentStrategy, currentRegime, selectedSymbol]);

  // --- 5. Live Metric Sync ---
  const handleUpdateMetrics = useCallback((metrics: BacktestResult) => {
    if (!aiAnalysisRef.current) return; 

    const updatedAnalysis: AIAnalysisResult = {
      ...aiAnalysisRef.current,
      backtestResult: metrics,
      lastLiveUpdate: Date.now()
    };

    setAiAnalysis(updatedAnalysis);
    
    const freshState = loadAssetState(selectedSymbolRef.current);

    saveAssetState(selectedSymbolRef.current, {
       signals: signalsRef.current,
       candles: dataRef.current,
       strategy: strategyRef.current,
       regime: regimeRef.current,
       aiAnalysis: updatedAnalysis // Save the updated analysis with live stats
    });
  }, []);

  // --- Render ---
  const lastPrice = data.length > 0 ? data[data.length - 1].close : 0;
  const prevPrice = data.length > 1 ? data[data.length - 2].close : 0;
  const priceChange = lastPrice - prevPrice;
  const priceTrend = priceChange >= 0 ? 'up' : 'down';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
      <Header />
      
      <main className="flex-1 p-4 md:p-6 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          
          {/* Top Controls */}
          <AssetSelector selectedSymbol={selectedSymbol} onSelect={setSelectedSymbol} />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
            
            {/* Left Column: Chart & Stats */}
            <div className="lg:col-span-2 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
              {/* Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatsCard 
                  title="Current Price" 
                  value={`$${lastPrice.toFixed(4)}`} 
                  icon={DollarSign}
                  subValue={`${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(4)}`}
                  trend={priceTrend}
                />
                 <StatsCard 
                  title="Market Regime" 
                  value={currentRegime.replace('_', ' ')} 
                  icon={Activity}
                  color="text-purple-400"
                />
                <StatsCard 
                  title="Active Strategy" 
                  value={`RSI ${currentStrategy.rsiPeriod} / EMA ${currentStrategy.emaLong}`} 
                  icon={TrendingUp}
                />
                <StatsCard 
                  title="24h Volume" 
                  value={(data.reduce((acc, c) => acc + c.volume, 0) / 1000).toFixed(1) + 'k'} 
                  icon={BarChart2}
                  color="text-emerald-400"
                />
              </div>

              {/* Main Chart */}
              <div className="flex-1 min-h-[450px]">
                 {isLoading ? (
                   <div className="h-full flex items-center justify-center bg-zinc-900/50 rounded-xl border border-zinc-800">
                     <Activity className="w-8 h-8 text-indigo-500 animate-spin" />
                     <span className="ml-3 text-zinc-400">Syncing Market Data...</span>
                   </div>
                 ) : (
                   <PriceChart 
                      data={data} 
                      signals={signals} 
                      color={SUPPORTED_ASSETS.find(a => a.symbol === selectedSymbol)?.color || '#6366f1'} 
                   />
                 )}
              </div>
            </div>

            {/* Right Column: Signals & AI */}
            <div className="flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-1">
              {/* Position Swapped: AIOptimizer now above SignalFeed */}
              <div className="flex-1 min-h-[500px]">
                <AIOptimizer 
                  selectedSymbol={selectedSymbol} // PASSED PROP
                  analysis={aiAnalysis}
                  isAnalyzing={isAnalyzing}
                  optimizationStatus={optimizationStatus}
                  marketData={data}
                  currentStrategy={currentStrategy}
                  currentRegime={currentRegime}
                  onUpdateMetrics={handleUpdateMetrics}
                />
              </div>
              
              <SignalFeed signals={signals} />
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default App;