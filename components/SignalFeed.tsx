import React from 'react';
import { TradeSignal, SignalType } from '../types';
import { ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

interface SignalFeedProps {
  signals: TradeSignal[];
}

export const SignalFeed: React.FC<SignalFeedProps> = ({ signals }) => {
  const reversedSignals = [...signals].reverse(); // Newest first

  return (
    <div className="flex h-[500px] flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          <Activity className="h-4 w-4 text-zinc-400" />
          Signal History
        </h3>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
          {signals.length} Total
        </span>
      </div>
      
      <div className="custom-scrollbar flex-1 overflow-y-auto p-2">
        {reversedSignals.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center space-y-3 text-center">
            <div className="rounded-full bg-zinc-800/50 p-3">
               <Activity className="h-6 w-6 text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-500">No signals generated yet...</p>
          </div>
        ) : (
          <div className="space-y-1">
            {reversedSignals.map((signal) => (
              <div 
                key={signal.id} 
                className="group relative flex flex-col gap-2 rounded-lg border border-transparent bg-transparent p-3 transition-colors hover:bg-zinc-800/50 hover:border-zinc-800"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-md border ${
                      signal.type === SignalType.BUY 
                        ? 'border-emerald-500/20 bg-emerald-500/10' 
                        : 'border-rose-500/20 bg-rose-500/10'
                    }`}>
                      {signal.type === SignalType.BUY ? (
                        <ArrowUpRight className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <ArrowDownRight className="h-5 w-5 text-rose-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${
                          signal.type === SignalType.BUY ? 'text-emerald-500' : 'text-rose-500'
                        }`}>
                          {signal.type}
                        </span>
                        <span className="font-mono text-xs text-zinc-400">
                          @ ${signal.price.toFixed(4)}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500">{new Date(signal.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="block font-mono text-xs font-medium text-zinc-300">
                      {signal.symbol}
                    </span>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-zinc-400">
                  {signal.reason}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};