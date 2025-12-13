
import { SUPPORTED_ASSETS, INITIAL_STRATEGY } from './constants';
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


const runCronJob = async () => {
    console.log('Starting cron job...');

    for (const asset of SUPPORTED_ASSETS) {
        try {
            console.log(`Processing asset: ${asset.symbol}`);

            // 1. Load asset state
            const savedState = await loadAssetState(asset.symbol);
            let candles = savedState?.cachedCandles || [];
            let strategy = savedState?.strategy || INITIAL_STRATEGY;
            let signals = savedState?.signals || [];
            let aiAnalysis = savedState?.aiAnalysis || null;

            // 2. Fetch fresh market data
            const freshData = await fetchMarketData(asset.symbol, 100);
            const mergedCandles = mergeCandles(candles, freshData);

            // 3. Detect market regime
            const regimeInfo = detectMarketRegime(mergedCandles);

            // 4. Generate signals
            const signalResult = generateSignal(mergedCandles, strategy, regimeInfo.regime);
            const latestCandle = mergedCandles[mergedCandles.length - 1];

            if (signalResult.type !== SignalType.HOLD) {
                const newSignal: TradeSignal = { id: crypto.randomUUID(), type: signalResult.type, price: latestCandle.close, timestamp: latestCandle.time, reason: signalResult.reason, symbol: asset.symbol, regimeAtCreation: regimeInfo.regime };
                signals = [...signals, newSignal];
            }

            // 5. Run AI optimization
            if (mergedCandles.length >= 200) {
                const geminiResult = await analyzeMarketWithGemini(asset.symbol, mergedCandles, strategy);
                const { params: optimizedParams, result: backtestStats } = await runGeneticOptimization(mergedCandles, geminiResult.regime);
                const finalAnalysis: AIAnalysisResult = { ...geminiResult, symbol: asset.symbol, suggestedParams: optimizedParams, backtestResult: backtestStats, lastLiveUpdate: Date.now() };

                await saveToQTable(asset.symbol, finalAnalysis.regime, optimizedParams, backtestStats.netProfit, finalAnalysis);
                strategy = optimizedParams;
                aiAnalysis = finalAnalysis;
            }

            // 6. Save updated state
            await saveAssetState(asset.symbol, {
                candles: mergedCandles,
                signals: signals,
                strategy: strategy,
                regime: regimeInfo.regime,
                aiAnalysis: aiAnalysis
            });

            console.log(`Successfully processed asset: ${asset.symbol}`);

        } catch (error) {
            console.error(`Error processing asset ${asset.symbol}:`, error);
        }
    }

    console.log('Cron job finished.');
};

runCronJob();
