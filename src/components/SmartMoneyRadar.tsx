import React, { useEffect, useState } from 'react'
import { Search, Eye, ShieldAlert } from 'lucide-react'
import { API_URL } from '../utils/api'

type InsiderTrade = {
  date: string
  name: string
  title: string
  type: string
  shares: number
  price: number
  value: number
}

export default function SmartMoneyRadar() {
  const [data, setData] = useState<InsiderTrade[]>([])
  const [loading, setLoading] = useState(true)
  const [symbol, setSymbol] = useState('AAPL')
  const [inputVal, setInputVal] = useState('AAPL')

  const fetchData = (sym: string) => {
    setLoading(true)
    fetch(`${API_URL}/api/market/insider-radar?symbol=${sym}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) setData(d.data || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchData(symbol)
  }, [symbol])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputVal.trim()) setSymbol(inputVal.trim().toUpperCase())
  }

  return (
    <div className="bg-[#0b0d12] border border-white/10 rounded-lg overflow-hidden font-mono mt-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-white/5 bg-[#080a0f] gap-4">
        <div className="flex items-center gap-3">
          <Eye className="w-4 h-4 text-[#d6b26b]" />
          <div>
            <h2 className="text-[11px] font-bold tracking-[0.15em] text-white uppercase">Smart Money Radar</h2>
            <p className="text-[9px] text-[#a7b0bf] tracking-[0.2em] uppercase mt-0.5">Insider Trading Tracker</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Enter US Symbol (e.g. AAPL)"
              className="bg-white/[0.03] border border-white/10 rounded px-8 py-1.5 text-xs text-white uppercase outline-none focus:border-[#d6b26b]/50 transition-colors w-48 placeholder:normal-case"
            />
          </div>
          <button type="submit" className="bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 px-3 py-1.5 rounded text-xs transition-colors">
            SCAN
          </button>
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#080a0f] border-b border-white/5 text-[9px] text-[#a7b0bf] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Insider Name</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium text-right">Shares</th>
              <th className="px-4 py-3 font-medium text-right">Value ($)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-white/40 animate-pulse text-[10px] tracking-widest uppercase">
                  Tracking whales...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-white/40">
                  <div className="flex flex-col items-center gap-2">
                    <ShieldAlert className="w-6 h-6 text-white/20" />
                    <p className="text-[10px] tracking-widest uppercase">No insider activity found for {symbol}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((trade, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-[#a7b0bf]">{trade.date}</td>
                  <td className="px-4 py-3 font-medium text-white">{trade.name}</td>
                  <td className="px-4 py-3 text-[#a7b0bf] text-[10px]">{trade.title}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold border ${
                      trade.type?.toLowerCase().includes('buy')
                        ? 'bg-[#4ade80]/10 text-[#4ade80] border-[#4ade80]/20'
                        : trade.type?.toLowerCase().includes('sell')
                        ? 'bg-[#f87171]/10 text-[#f87171] border-[#f87171]/20'
                        : 'bg-white/5 text-[#a7b0bf] border-white/10'
                    }`}>
                      {trade.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-white">{trade.shares?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-bold text-[#d6b26b]">
                    {trade.value ? `$${trade.value.toLocaleString()}` : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="p-3 bg-[#080a0f] border-t border-white/5 text-[9px] text-[#a7b0bf]/60 text-center uppercase tracking-widest flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#d6b26b] animate-pulse" />
        Data powered by SEC Form 4 (via OpenBB)
      </div>
    </div>
  )
}
