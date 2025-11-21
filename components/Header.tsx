import React from 'react';
import { BrainCircuit, Activity } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-indigo-500/20">
            <BrainCircuit className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-100">NeuroTrade</h1>
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">AI Signal Engine</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-medium text-emerald-500">System Online</span>
          </div>
        </div>
      </div>
    </header>
  );
};