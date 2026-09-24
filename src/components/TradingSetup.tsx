import React, { useEffect, useState } from 'react'
import { Activity, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'

type SetupItem = {
  symbol: string
  name: string
  price: number
  rsi: number
  condition: string
  action: string
  color: string
}

export default function TradingSetup() {
  const [data, setData] = useState<SetupItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/market/setup/daily')
      .then(r => r.json())
      .then(d => {
        if (d.ok) setData(d.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-[#0b0d12] border border-white/10 rounded-lg p-6 animate-pulse h-64 flex items-center justify-center">
        <div className="text-sm font-mono text-[#a7b0bf] tracking-widest">SCANNING MARKETS...</div>
      </div>
    )
  }

  return (
    <div className="bg-[#0b0d12] border border-white/10 rounded-lg overflow-hidden font-mono">
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#080a0f]">
        <div className="flex items-center gap-3">
          <Activity className="w-4 h-4 text-[#4ade80]" />
          <h2 className="text-[11px] font-bold tracking-[0.15em] text-white uppercase">Daily Trading Setup</h2>
        </div>
        <div className="text-[9px] text-[#a7b0bf] tracking-[0.2em] uppercase">RSI Momentum Scanner</div>
      </div>

      <div className="divide-y divide-white/5">
        {data.length === 0 ? (
          <div className="p-8 text-center text-xs text-white/40">No setups found today.</div>
        ) : (
          data.map((item, idx) => (
            <div key={item.symbol} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-white/[0.02] transition-colors gap-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {item.symbol.substring(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-white">{item.symbol.replace('.JK', '')}</span>
                    <span 
                      className="text-[9px] px-2 py-0.5 rounded border tracking-wider uppercase font-bold"
                      style={{ color: item.color, borderColor: `${item.color}40`, backgroundColor: `${item.color}10` }}
                    >
                      {item.condition}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#a7b0bf] truncate max-w-[200px]">{item.name}</div>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-right">
                  <div className="text-[9px] text-[#a7b0bf] tracking-wider mb-1 uppercase">Latest Price</div>
                  <div className="text-sm font-bold text-white">
                    {item.price > 1000 ? item.price.toLocaleString('id-ID') : item.price.toFixed(2)}
                  </div>
                </div>
                
                <div className="text-right w-20">
                  <div className="text-[9px] text-[#a7b0bf] tracking-wider mb-1 uppercase">RSI (14)</div>
                  <div className="text-sm font-bold" style={{ color: item.color }}>
                    {item.rsi}
                  </div>
                </div>

                <div className="w-24 shrink-0 flex justify-end">
                  {item.condition === 'OVERSOLD' ? (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#4ade80] tracking-wider">
                      <TrendingUp className="w-3 h-3" /> BUY SIGNAL
                    </div>
                  ) : item.condition === 'OVERBOUGHT' ? (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#f87171] tracking-wider">
                      <TrendingDown className="w-3 h-3" /> TAKE PROFIT
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#8fbfba] tracking-wider">
                      <AlertCircle className="w-3 h-3" /> HOLD
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="p-3 bg-[#080a0f] border-t border-white/5 text-[9px] text-[#a7b0bf]/60 text-center uppercase tracking-widest">
        Data is delayed by 15 minutes. Not financial advice.
      </div>
    </div>
  )
}
