import React, { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Activity, AlertCircle } from 'lucide-react'
import { API_URL } from '../utils/api'

type SectorCompany = {
  name: string
  symbol: string
  price_change: number
  last_close_price: number
  latest_close_date: string
}

type SectorsData = {
  top_gainers: {
    '1d': SectorCompany[]
  },
  top_losers: {
    '1d': SectorCompany[]
  }
}

export default function SectorsIntelligence() {
  const [data, setData] = useState<SectorsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_URL}/api/market/sectors/top-changes`)
      .then(r => r.json())
      .then(res => {
        if (res.ok && res.data) {
          setData(res.data)
        } else {
          setError(res.error || 'Failed to fetch Sectors API')
        }
      })
      .catch(err => {
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  if (error) {
    return (
      <div className="bg-[#0b0d12] border border-red-500/20 rounded-lg p-6 flex flex-col items-center justify-center font-mono text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
        <h3 className="text-red-400 font-bold mb-1">Sectors API Error</h3>
        <p className="text-red-400/70 text-xs">{error}</p>
      </div>
    )
  }

  const gainers = data?.top_gainers?.['1d']?.slice(0, 5) || []
  const losers = data?.top_losers?.['1d']?.slice(0, 5) || []

  return (
    <div className="bg-[#0b0d12] border border-white/10 rounded-lg overflow-hidden font-mono mt-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-white/5 bg-[#080a0f] gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#d6b26b]/10 rounded border border-[#d6b26b]/20">
            <Activity className="w-4 h-4 text-[#d6b26b]" />
          </div>
          <div>
            <h2 className="text-[11px] font-bold tracking-[0.15em] text-white uppercase">Sectors Intelligence</h2>
            <p className="text-[9px] text-[#a7b0bf] tracking-[0.2em] uppercase mt-0.5">Hackathon Track 3: Market Movers</p>
          </div>
        </div>
        <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10 text-[9px] text-[#a7b0bf] tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          LIVE DATA FROM SECTORS.APP
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/5">
        {/* Gainers */}
        <div className="p-0">
          <div className="px-4 py-3 bg-[#080a0f]/50 border-b border-white/5 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-bold tracking-widest text-white uppercase">Top Gainers (1D)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr><td className="p-8 text-center text-white/40 animate-pulse text-[10px] tracking-widest uppercase">Fetching AI Signals...</td></tr>
                ) : gainers.length === 0 ? (
                  <tr><td className="p-8 text-center text-white/40 text-[10px]">No data available</td></tr>
                ) : gainers.map((g, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-bold text-white w-1/4">{g.symbol?.replace('.JK', '')}</td>
                    <td className="px-4 py-3 text-[#a7b0bf] text-[10px] truncate max-w-[120px]">{g.name}</td>
                    <td className="px-4 py-3 text-right font-medium text-white">Rp{g.last_close_price?.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                        +{(g.price_change * 100).toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Losers */}
        <div className="p-0">
          <div className="px-4 py-3 bg-[#080a0f]/50 border-b border-white/5 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <span className="text-[10px] font-bold tracking-widest text-white uppercase">Top Losers (1D)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr><td className="p-8 text-center text-white/40 animate-pulse text-[10px] tracking-widest uppercase">Fetching AI Signals...</td></tr>
                ) : losers.length === 0 ? (
                  <tr><td className="p-8 text-center text-white/40 text-[10px]">No data available</td></tr>
                ) : losers.map((l, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-bold text-white w-1/4">{l.symbol?.replace('.JK', '')}</td>
                    <td className="px-4 py-3 text-[#a7b0bf] text-[10px] truncate max-w-[120px]">{l.name}</td>
                    <td className="px-4 py-3 text-right font-medium text-white">Rp{l.last_close_price?.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-400/10 text-red-400 border border-red-400/20">
                        {(l.price_change * 100).toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
