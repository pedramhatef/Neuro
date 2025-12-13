
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';
import { Candle, CryptoSymbol, SignalType, TradeSignal } from '../types';
import { getPriceDecimals } from '../utils/utils';

interface PriceChartProps {
  data: Candle[];
  signals: TradeSignal[];
  color: string;
  symbol: CryptoSymbol;
}

const CustomTooltip = ({ active, payload, label, symbol }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const priceDecimals = getPriceDecimals(symbol);
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/95 p-3 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-zinc-950/80">
        <div className="mb-1 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400"></span>
          <span className="text-xs font-medium text-zinc-400">{new Date(label).toLocaleTimeString()}</span>
        </div>
        <div className="space-y-1">
           <div className="flex items-center justify-between gap-4">
             <span className="text-xs text-zinc-500">Price</span>
             <span className="font-mono text-sm font-bold text-zinc-100">${data.close.toFixed(priceDecimals)}</span>
           </div>
           <div className="flex items-center justify-between gap-4">
             <span className="text-xs text-zinc-500">Volume</span>
             <span className="font-mono text-xs text-zinc-400">{data.volume}</span>
           </div>
           <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-zinc-800 pt-2">
             <div className="flex justify-between gap-2">
               <span className="text-[10px] text-zinc-600">H</span>
               <span className="font-mono text-[10px] text-emerald-400/80">${data.high.toFixed(priceDecimals)}</span>
             </div>
             <div className="flex justify-between gap-2">
               <span className="text-[10px] text-zinc-600">L</span>
               <span className="font-mono text-[10px] text-rose-400/80">${data.low.toFixed(priceDecimals)}</span>
             </div>
           </div>
        </div>
      </div>
    );
  }
  return null;
};

export const PriceChart: React.FC<PriceChartProps> = ({ data, signals, color, symbol }) => {
  const visibleSignals = signals.filter(s => s.timestamp >= data[0].time);
  const priceDecimals = getPriceDecimals(symbol);

  return (
    <div className="relative h-[500px] w-full rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 shadow-sm backdrop-blur-sm">
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-1 backdrop-blur-sm">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-xs font-medium text-zinc-400">Live Market Data</span>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.2}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis 
            dataKey="time" 
            tickFormatter={(tick) => new Date(tick).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 
            stroke="#52525b"
            tick={{ fontSize: 11, fill: '#71717a' }}
            axisLine={false}
            tickLine={false}
            minTickGap={30}
            dy={10}
          />
          <YAxis 
            domain={['auto', 'auto']} 
            orientation="right"
            stroke="#52525b"
            tick={{ fontSize: 11, fill: '#71717a' }}
            tickFormatter={(val) => val.toFixed(priceDecimals)}
            axisLine={false}
            tickLine={false}
            dx={5}
            width={60}
          />
          <Tooltip content={<CustomTooltip symbol={symbol} />} cursor={{ stroke: '#52525b', strokeDasharray: '3 3' }} />
          <Area 
            type="monotone" 
            dataKey="close" 
            stroke={color} 
            fillOpacity={1} 
            fill="url(#colorPrice)" 
            isAnimationActive={false}
            strokeWidth={2}
          />
          
          {visibleSignals.map((signal) => {
             const isBuy = signal.type === SignalType.BUY;
             const signalColor = isBuy ? '#10b981' : '#f43f5e'; // Emerald-500 or Rose-500
             
             return (
               <React.Fragment key={signal.id}>
                 {/* Vertical Line to show exact time */}
                 <ReferenceLine
                   x={signal.timestamp}
                   stroke={signalColor}
                   strokeDasharray="3 3"
                   strokeOpacity={0.3}
                   strokeWidth={1}
                 />
                 {/* Simple Dot at exact price */}
                 <ReferenceDot
                    x={signal.timestamp}
                    y={signal.price}
                    r={0} // Using custom shape
                    isFront={true}
                    shape={(props: any) => {
                        const { cx, cy } = props;
                        // Guard against initial render NaNs
                        if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;

                        return (
                          <g>
                             {/* Outer glow ring for better visibility against chart line */}
                             <circle cx={cx} cy={cy} r={6} fill={signalColor} fillOpacity={0.3} />
                             {/* Solid center dot */}
                             <circle cx={cx} cy={cy} r={3.5} fill={signalColor} stroke="#09090b" strokeWidth={1} />
                          </g>
                        );
                    }}
                 />
               </React.Fragment>
             );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
