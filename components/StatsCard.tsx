import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  subValue, 
  icon: Icon,
  trend,
  color = "text-zinc-100" 
}) => {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 shadow-sm backdrop-blur-sm transition-all hover:bg-zinc-900/70">
      <div className="flex items-center justify-between space-y-0 pb-2">
        <p className="text-sm font-medium text-zinc-400">{title}</p>
        <Icon className={`h-4 w-4 text-zinc-500`} />
      </div>
      <div className="flex flex-col gap-1">
        <div className={`text-2xl font-bold tracking-tight ${color}`}>{value}</div>
        {subValue && (
          <p className={`text-xs font-medium ${
            trend === 'up' ? 'text-emerald-500' : 
            trend === 'down' ? 'text-rose-500' : 
            'text-zinc-500'
          }`}>
            {subValue}
          </p>
        )}
      </div>
    </div>
  );
};