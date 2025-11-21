import React from 'react';
import { SUPPORTED_ASSETS } from '../constants';
import { CryptoSymbol } from '../types';

interface AssetSelectorProps {
  selectedSymbol: CryptoSymbol;
  onSelect: (symbol: CryptoSymbol) => void;
}

export const AssetSelector: React.FC<AssetSelectorProps> = ({ selectedSymbol, onSelect }) => {
  return (
    <div className="mb-6">
      <div className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 p-1 text-zinc-400 border border-zinc-800">
        {SUPPORTED_ASSETS.map((asset) => {
          const isSelected = selectedSymbol === asset.symbol;
          return (
            <button
              key={asset.symbol}
              onClick={() => onSelect(asset.symbol)}
              className={`
                inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50
                ${isSelected 
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm' 
                  : 'hover:bg-zinc-800/50 hover:text-zinc-200'
                }
              `}
            >
              <span 
                className={`mr-2 h-2 w-2 rounded-full transition-opacity ${isSelected ? 'opacity-100' : 'opacity-70'}`} 
                style={{ backgroundColor: asset.color }}
              />
              {asset.name}
              <span className={`ml-1.5 text-xs ${isSelected ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {asset.symbol}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};