import React from 'react';
import { TradeSignal, SignalType } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { SUPPORTED_ASSETS } from '../constants';

interface GlobalSignalFeedProps {
  signals: TradeSignal[];
}

const getSignalColor = (type: SignalType) => {
  switch (type) {
    case SignalType.BUY:
      return 'text-green-400';
    case SignalType.SELL:
      return 'text-red-400';
    default:
      return 'text-zinc-500';
  }
};

const getSignalIcon = (type: SignalType) => {
  switch (type) {
    case SignalType.BUY:
      return <ArrowUpCircle className="w-5 h-5 mr-3" />;
    case SignalType.SELL:
      return <ArrowDownCircle className="w-5 h-5 mr-3" />;
    default:
      return null;
  }
};

export const GlobalSignalFeed: React.FC<GlobalSignalFeedProps> = ({ signals }) => {
  const getAssetName = (symbol: string) => {
    return SUPPORTED_ASSETS.find(a => a.symbol === symbol)?.name || symbol;
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col h-[300px]">
      <h3 className="text-lg font-bold text-zinc-100 mb-4 flex items-center">
        <Zap className="w-5 h-5 mr-2 text-yellow-400" />
        Global Signal Feed
      </h3>
      <div className="overflow-y-auto flex-1 custom-scrollbar pr-2">
        <AnimatePresence initial={false}>
          {signals.length > 0 ? (
            signals.map((signal) => {
              if (!signal) return null; // Add this check
              return (
                <motion.div
                  key={signal.id}
                  layout
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -50, transition: { duration: 0.2 } }}
                  className={`flex items-center p-3 rounded-lg mb-2 bg-zinc-800/50 ${getSignalColor(signal.type)}`}
                >
                  {getSignalIcon(signal.type)}
                  <div className="flex-1">
                    <div className="font-bold flex justify-between">
                      <span>{getAssetName(signal.symbol)}: {signal.type}</span>
                      <span>${signal.price.toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">
                      {new Date(signal.timestamp).toLocaleTimeString()} - {signal.reason}
                    </div>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="text-center text-zinc-500 pt-10">
              <p>Listening for signals across all assets...</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};