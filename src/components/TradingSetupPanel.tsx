import { useState, useEffect } from 'react';

interface TradingSetupPanelProps {
  ticker: string;
}

interface TradingSetup {
  symbol: string;
  momentum: {
    rsi: number;
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    condition: 'OVERSOLD' | 'OVERBOUGHT' | 'NORMAL';
  };
  levels: {
    pivot: number;
    support1: number;
    support2: number;
    resistance1: number;
    resistance2: number;
  };
  recommendation: {
    action: 'BUY' | 'SELL' | 'WAIT';
    entryArea: string;
    stopLoss: number;
    takeProfit: number;
    aiNarrative: string;
  };
  lastPrice: number;
}

export default function TradingSetupPanel({ ticker }: TradingSetupPanelProps) {
  const [setup, setSetup] = useState<TradingSetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    
    fetch(`/api/trading-setup?symbol=${ticker}`)
      .then(res => res.json())
      .then(res => {
        if (!cancelled) {
          if (res.ok) setSetup(res.data);
          else setError(true);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
      
    return () => { cancelled = true; };
  }, [ticker]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-4 animate-pulse">
        <div className="w-1/3 h-4 bg-white/10 rounded" />
        <div className="h-24 bg-white/5 rounded-xl" />
      </div>
    );
  }

  if (error || !setup) return null;

  const { momentum, levels, recommendation } = setup;
  const isBuy = recommendation.action === 'BUY';
  const isSell = recommendation.action === 'SELL';

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 shadow-sm transition-all hover:border-white/[0.1]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-200 tracking-tight flex items-center gap-2">
            Trader Mode Insights
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-teal-500/10 text-teal-400 border border-teal-500/20">
              OPERATIONAL
            </span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Momentum, Support & Resistance, dan Area Eksekusi (Ting AI Operational Model).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Tactical Levels & Action */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl border border-white/[0.04] bg-white/[0.01]">
            <span className="text-[10px] font-mono text-slate-500 uppercase">Sinyal Utama</span>
            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase ${
              isBuy ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
              isSell ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
              'bg-slate-500/10 text-slate-300 border border-slate-500/20'
            }`}>
              {recommendation.action}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-xl border border-white/[0.04] bg-white/[0.01]">
              <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Entry Area</p>
              <p className="text-xs font-semibold font-mono text-slate-200 mt-1">{recommendation.entryArea}</p>
            </div>
            <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.02]">
              <p className="text-[9px] font-mono text-emerald-500/70 uppercase tracking-wider">Take Profit (R1)</p>
              <p className="text-xs font-semibold font-mono text-emerald-400 mt-1">{levels.resistance1.toFixed(0)}</p>
            </div>
            <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/[0.02]">
              <p className="text-[9px] font-mono text-red-500/70 uppercase tracking-wider">Stop Loss (S2)</p>
              <p className="text-xs font-semibold font-mono text-red-400 mt-1">{levels.support2.toFixed(0)}</p>
            </div>
          </div>
        </div>

        {/* Right: Technical AI Insight (Data Storyteller) */}
        <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01] flex flex-col justify-between h-full">
          <div>
            <p className="text-[10px] font-mono text-teal-500/70 uppercase tracking-widest mb-2">Ting AI Technical Insight</p>
            <p className="text-xs text-slate-300 leading-relaxed">
              {recommendation.aiNarrative}
            </p>
          </div>
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/[0.04]">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono text-slate-500 uppercase">RSI</span>
              <span className={`text-[10px] font-bold ${momentum.rsi < 30 ? 'text-emerald-400' : momentum.rsi > 70 ? 'text-red-400' : 'text-slate-300'}`}>
                {momentum.rsi} ({momentum.condition})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono text-slate-500 uppercase">Trend (SMA 20)</span>
              <span className={`text-[10px] font-bold ${momentum.trend === 'BULLISH' ? 'text-emerald-400' : momentum.trend === 'BEARISH' ? 'text-red-400' : 'text-slate-300'}`}>
                {momentum.trend}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
