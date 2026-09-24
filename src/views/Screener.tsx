import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_URL } from '../utils/api'
import { fetchWithSession } from '../utils/authFetch'
import { useAuthSession } from '../utils/useAuthSession'

export default function Screener() {
  const { user } = useAuthSession()
  const isPro = Boolean(user?.is_pro)
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isPro) {
      setLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        const res = await fetchWithSession(`${API_URL}/api/market/screener`)
        const result = await res.json()
        if (result.ok) {
          setData(result.data)
        } else {
          setError('Failed to fetch screener data')
        }
      } catch (err) {
        setError('Error connecting to server')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [isPro])

  return (
    <div className="min-h-screen bg-[#07090E] text-white pt-24 px-6 pb-20 font-sans selection:bg-indigo-500/30">
      <div className="max-w-6xl mx-auto space-y-10 fade-in">
        
        {/* HEADER */}
        <header className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-slate-500 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-white">Stock Screener</h1>
            <span className="px-2 py-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-[10px] font-bold uppercase rounded-md tracking-wider ml-2">PRO</span>
          </div>
          <p className="text-slate-400">Temukan saham potensial berdasarkan kriteria fundamental dan teknikal.</p>
        </header>

        {/* CONTENT */}
        {!isPro ? (
          <div className="border border-indigo-500/30 bg-indigo-500/5 rounded-2xl p-10 text-center space-y-6">
            <svg className="w-16 h-16 text-indigo-400 mx-auto opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Fitur Eksklusif Pro</h2>
              <p className="text-slate-400 max-w-sm mx-auto">Screener saham dengan filter fundamental lengkap hanya tersedia untuk pengguna Ting AI Pro.</p>
            </div>
            <Link to="/upgrade" className="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)]">
              Upgrade ke Pro
            </Link>
          </div>
        ) : loading ? (
          <div className="animate-pulse space-y-4">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-16 bg-white/[0.03] border border-white/[0.05] rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-sm font-medium">
            {error}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-white/[0.05]">
                <tr>
                  <th className="px-6 py-4">Symbol</th>
                  <th className="px-6 py-4">Company</th>
                  <th className="px-6 py-4 text-right">Price</th>
                  <th className="px-6 py-4 text-right">Change (%)</th>
                  <th className="px-6 py-4 text-right">Market Cap</th>
                  <th className="px-6 py-4 text-right">P/E Ratio</th>
                  <th className="px-6 py-4 text-right">Div Yield (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {data.map(stock => (
                  <tr key={stock.symbol} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-white">{stock.symbol}</td>
                    <td className="px-6 py-4 text-slate-300">{stock.name}</td>
                    <td className="px-6 py-4 text-right font-mono">{stock.price.toLocaleString()}</td>
                    <td className={`px-6 py-4 text-right font-mono font-semibold ${stock.change > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {stock.change > 0 ? '+' : ''}{stock.change}%
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-400">
                      Rp {(stock.marketCap / 1000000000000).toFixed(1)}T
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-400">{stock.peRatio}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-400">{stock.dividendYield}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  )
}
