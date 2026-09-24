import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { API_URL } from '../utils/api'
import { fetchWithSession } from '../utils/authFetch'

// ─── Types ───────────────────────────────────────────────────────────────────
interface TradeEntry {
  id: number
  pair: string
  direction: 'BUY' | 'SELL'
  lot_size: number
  entry_price: number
  stop_loss: number | null
  take_profit: number | null
  exit_price: number | null
  status: 'OPEN' | 'CLOSED' | 'CANCELLED'
  setup_type: string | null
  pre_trade_emotion: string | null
  post_trade_emotion: string | null
  notes: string | null
  ai_bias_analysis: string | null
  pnl: number | null
  opened_at: string
  closed_at: string | null
}

interface TradeStats {
  total_trades: number
  open_trades: number
  closed_trades: number
  winning_trades: number
  losing_trades: number
  win_rate: number
  total_pnl: number
  avg_win: number
  avg_loss: number
}

const FOREX_PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'AUDUSD', 'USDCAD', 'NZDUSD', 'USDCHF', 'GBPJPY', 'EURJPY']
const SETUP_TYPES = ['Trend Following', 'Range Breakout', 'News Play', 'Supply & Demand', 'Double Top/Bottom', 'Head & Shoulders', 'Fibonacci Retracement', 'EMA Crossover', 'RSI Divergence', 'Lainnya']
const EMOTIONS = ['Tenang & Fokus', 'Sedikit Nervous', 'FOMO', 'Overconfident', 'Takut Rugi', 'Lelah / Tidak Fokus', 'Excited Berlebihan', 'Revenge dari Loss']

// ─── Close Trade Modal ────────────────────────────────────────────────────────
function CloseTradeModal({ trade, onClose, onClosed }: { trade: TradeEntry; onClose: () => void; onClosed: () => void }) {
  const [exitPrice, setExitPrice] = useState('')
  const [emotion, setEmotion] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ pnl: number; ai_bias_analysis: string } | null>(null)

  const handleClose = async () => {
    if (!exitPrice) return
    setLoading(true)
    try {
      const res = await fetchWithSession(`${API_URL}/api/trade-journal/${trade.id}/close`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exit_price: exitPrice, post_trade_emotion: emotion, notes }),
      })
      const data = await res.json()
      if (data.success) setResult(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full max-w-md bg-[#0e1117] border border-white/[0.08] rounded-2xl p-6 shadow-2xl"
      >
        {result ? (
          <div className="space-y-4">
            <div className="text-center">
              <div className={`text-4xl font-black mb-1 ${result.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {result.pnl >= 0 ? '+' : ''}{result.pnl} USD
              </div>
              <div className="text-white/40 text-sm">{result.pnl >= 0 ? '✅ Winning Trade' : '❌ Losing Trade'}</div>
            </div>
            {result.ai_bias_analysis && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <div className="text-amber-400 text-xs font-mono uppercase tracking-wider mb-2">🧠 AI Bias Analysis</div>
                <p className="text-white/70 text-sm leading-relaxed">{result.ai_bias_analysis}</p>
              </div>
            )}
            <button
              onClick={onClosed}
              className="w-full py-2.5 bg-white text-[#07090d] font-bold rounded-lg text-sm hover:bg-white/90 transition-colors"
            >
              Selesai
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-white font-semibold mb-1">Tutup Trade</div>
              <div className="text-white/40 text-sm">{trade.direction} {trade.pair} @ {trade.entry_price}</div>
            </div>
            <div>
              <label className="block text-white/50 text-xs mb-1.5 uppercase tracking-wider">Exit Price *</label>
              <input
                type="number"
                step="0.00001"
                value={exitPrice}
                onChange={e => setExitPrice(e.target.value)}
                placeholder={`Harga keluar...`}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/20"
              />
            </div>
            <div>
              <label className="block text-white/50 text-xs mb-1.5 uppercase tracking-wider">Emosi Setelah Trade</label>
              <div className="flex flex-wrap gap-1.5">
                {EMOTIONS.slice(0, 4).map(e => (
                  <button key={e} onClick={() => setEmotion(e)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-all ${emotion === e ? 'bg-white/10 border-white/30 text-white' : 'border-white/[0.08] text-white/40 hover:border-white/15'}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-white/50 text-xs mb-1.5 uppercase tracking-wider">Catatan Refleksi</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Apa yang bisa dipelajari dari trade ini?"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/20 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 border border-white/[0.08] text-white/40 rounded-lg text-sm hover:border-white/15 transition-all">
                Batal
              </button>
              <button
                onClick={handleClose}
                disabled={!exitPrice || loading}
                className="flex-1 py-2.5 bg-white text-[#07090d] font-bold rounded-lg text-sm hover:bg-white/90 transition-colors disabled:opacity-40"
              >
                {loading ? 'Menganalisis...' : 'Tutup & Analisis AI'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── Trade Journal Form ───────────────────────────────────────────────────────
function TradeJournalForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    pair: 'EURUSD',
    direction: 'BUY' as 'BUY' | 'SELL',
    lot_size: '0.01',
    entry_price: '',
    stop_loss: '',
    take_profit: '',
    setup_type: '',
    pre_trade_emotion: '',
    notes: '',
  })

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const res = await fetchWithSession(`${API_URL}/api/trade-journal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form }),
      })
      const data = await res.json()
      if (data.success) onSuccess()
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const pillClass = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs border transition-all cursor-pointer ${active ? 'bg-white/10 border-white/30 text-white' : 'border-white/[0.08] text-white/40 hover:border-white/15 hover:text-white/60'}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0e1117] border border-white/[0.08] rounded-2xl p-6 mb-6"
    >
      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map(s => (
          <React.Fragment key={s}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${step >= s ? 'bg-white text-[#07090d]' : 'bg-white/[0.06] text-white/25'}`}>{s}</div>
            {s < 3 && <div className={`h-px flex-1 transition-all ${step > s ? 'bg-white/30' : 'bg-white/[0.06]'}`} />}
          </React.Fragment>
        ))}
        <span className="ml-2 text-white/30 text-xs">
          {step === 1 ? 'Detail Trade' : step === 2 ? 'Risk Management' : 'Psikologi'}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div>
              <label className="block text-white/50 text-xs mb-2 uppercase tracking-wider">Pair</label>
              <div className="flex flex-wrap gap-1.5">
                {FOREX_PAIRS.map(p => (
                  <button key={p} onClick={() => set('pair', p)} className={pillClass(form.pair === p)}>{p}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-white/50 text-xs mb-2 uppercase tracking-wider">Arah</label>
              <div className="flex gap-2">
                <button onClick={() => set('direction', 'BUY')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all border ${form.direction === 'BUY' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'border-white/[0.08] text-white/30 hover:border-white/15'}`}>
                  ▲ BUY / LONG
                </button>
                <button onClick={() => set('direction', 'SELL')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all border ${form.direction === 'SELL' ? 'bg-rose-500/20 border-rose-500/40 text-rose-400' : 'border-white/[0.08] text-white/30 hover:border-white/15'}`}>
                  ▼ SELL / SHORT
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-white/50 text-xs mb-1.5 uppercase tracking-wider">Entry Price *</label>
                <input type="number" step="0.00001" value={form.entry_price} onChange={e => set('entry_price', e.target.value)}
                  placeholder="1.08500" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/20" />
              </div>
              <div>
                <label className="block text-white/50 text-xs mb-1.5 uppercase tracking-wider">Lot Size *</label>
                <input type="number" step="0.01" min="0.01" value={form.lot_size} onChange={e => set('lot_size', e.target.value)}
                  placeholder="0.01" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/20" />
              </div>
            </div>
            <button
              onClick={() => setStep(2)} disabled={!form.entry_price || !form.lot_size}
              className="w-full py-2.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/70 rounded-lg text-sm transition-all disabled:opacity-30">
              Lanjut →
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-white/50 text-xs mb-1.5 uppercase tracking-wider">Stop Loss</label>
                <input type="number" step="0.00001" value={form.stop_loss} onChange={e => set('stop_loss', e.target.value)}
                  placeholder="Opsional" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/20" />
              </div>
              <div>
                <label className="block text-white/50 text-xs mb-1.5 uppercase tracking-wider">Take Profit</label>
                <input type="number" step="0.00001" value={form.take_profit} onChange={e => set('take_profit', e.target.value)}
                  placeholder="Opsional" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/20" />
              </div>
            </div>
            <div>
              <label className="block text-white/50 text-xs mb-2 uppercase tracking-wider">Setup / Strategi</label>
              <div className="flex flex-wrap gap-1.5">
                {SETUP_TYPES.map(s => (
                  <button key={s} onClick={() => set('setup_type', s)} className={pillClass(form.setup_type === s)}>{s}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="flex-1 py-2.5 border border-white/[0.08] text-white/40 rounded-lg text-sm hover:border-white/15 transition-all">← Kembali</button>
              <button onClick={() => setStep(3)} className="flex-1 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/70 rounded-lg text-sm transition-all">Lanjut →</button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div>
              <label className="block text-white/50 text-xs mb-2 uppercase tracking-wider">Emosi Sebelum Trade</label>
              <div className="flex flex-wrap gap-1.5">
                {EMOTIONS.map(e => (
                  <button key={e} onClick={() => set('pre_trade_emotion', e)} className={pillClass(form.pre_trade_emotion === e)}>{e}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-white/50 text-xs mb-1.5 uppercase tracking-wider">Thesis / Alasan Masuk</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
                placeholder="Kenapa kamu masuk trade ini? Apa yang kamu lihat di chart?"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/20 resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="flex-1 py-2.5 border border-white/[0.08] text-white/40 rounded-lg text-sm hover:border-white/15 transition-all">← Kembali</button>
              <button onClick={handleSubmit} disabled={loading}
                className="flex-1 py-2.5 bg-white text-[#07090d] font-bold rounded-lg text-sm hover:bg-white/90 transition-colors disabled:opacity-40">
                {loading ? 'Menyimpan...' : '✓ Catat Trade'}
              </button>
            </div>
            <button onClick={onCancel} className="w-full text-center text-white/25 text-xs hover:text-white/40 transition-colors">Batal</button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Trade Card ───────────────────────────────────────────────────────────────
function TradeCard({ trade, onClose }: { trade: TradeEntry; onClose: () => void }) {
  const isOpen = trade.status === 'OPEN'
  const isWin = trade.pnl !== null && trade.pnl > 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.1] transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${trade.direction === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
            {trade.direction}
          </span>
          <span className="text-white font-semibold text-sm">{trade.pair}</span>
          <span className="text-white/30 text-xs">@ {trade.entry_price}</span>
        </div>
        <div className="flex items-center gap-2">
          {isOpen ? (
            <>
              <span className="flex items-center gap-1 text-[10px] text-amber-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />OPEN
              </span>
              <button
                onClick={onClose}
                className="px-2.5 py-1 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/60 rounded-lg text-xs transition-all"
              >
                Tutup Trade
              </button>
            </>
          ) : (
            <span className={`text-sm font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
              {trade.pnl !== null ? `${trade.pnl >= 0 ? '+' : ''}${trade.pnl} USD` : '—'}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3 text-xs text-white/40">
        <div><span className="block text-white/20">Lot</span>{trade.lot_size}</div>
        <div><span className="block text-white/20">SL</span>{trade.stop_loss || '—'}</div>
        <div><span className="block text-white/20">TP</span>{trade.take_profit || '—'}</div>
      </div>

      {trade.setup_type && (
        <span className="inline-block px-2 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded-full text-xs text-white/30 mb-2">{trade.setup_type}</span>
      )}

      {trade.pre_trade_emotion && (
        <div className="text-xs text-white/25 mb-2">😶 {trade.pre_trade_emotion}</div>
      )}

      {trade.ai_bias_analysis && (
        <div className="mt-3 bg-amber-500/[0.07] border border-amber-500/[0.15] rounded-lg p-3">
          <div className="text-amber-400 text-[10px] font-mono uppercase tracking-wider mb-1">🧠 AI Bias Analysis</div>
          <p className="text-white/50 text-xs leading-relaxed">{trade.ai_bias_analysis}</p>
        </div>
      )}

      <div className="mt-2 text-white/15 text-[10px]">
        {new Date(trade.opened_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        {trade.closed_at && ` → ${new Date(trade.closed_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
      </div>
    </motion.div>
  )
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────
function StatsBar({ stats }: { stats: TradeStats }) {
  const items = [
    { label: 'Win Rate', value: `${stats.win_rate}%`, color: stats.win_rate >= 50 ? 'text-emerald-400' : 'text-rose-400' },
    { label: 'Total PnL', value: `${stats.total_pnl >= 0 ? '+' : ''}${stats.total_pnl} USD`, color: stats.total_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400' },
    { label: 'Avg Win', value: `+${stats.avg_win}`, color: 'text-white/60' },
    { label: 'Avg Loss', value: `${stats.avg_loss}`, color: 'text-white/60' },
    { label: 'Open', value: String(stats.open_trades), color: 'text-amber-400' },
    { label: 'Total', value: String(stats.total_trades), color: 'text-white' },
  ]

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
      {items.map(item => (
        <div key={item.label} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-center">
          <div className={`text-lg font-black tabular-nums ${item.color}`}>{item.value}</div>
          <div className="text-white/25 text-[10px] font-mono uppercase tracking-wider mt-0.5">{item.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TradeJournalPage() {
  const [trades, setTrades] = useState<TradeEntry[]>([])
  const [stats, setStats] = useState<TradeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [closingTrade, setClosingTrade] = useState<TradeEntry | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [tradesRes, statsRes] = await Promise.all([
        fetchWithSession(`${API_URL}/api/trade-journal`),
        fetchWithSession(`${API_URL}/api/trade-journal/stats`),
      ])
      const tradesData = await tradesRes.json()
      const statsData = await statsRes.json()
      if (tradesData.success) setTrades(tradesData.data)
      if (statsData.success) setStats(statsData.stats)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = filter === 'ALL' ? trades : trades.filter(t => t.status === filter)

  return (
    <div className="min-h-screen bg-[#07090d] text-white pt-6 pb-24 px-4 md:px-8 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Trade Journal</h1>
            <p className="text-white/30 text-sm mt-0.5">Catat, refleksikan, dan perbaiki trading kamu dengan AI.</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowForm(v => !v)}
            className="px-4 py-2 bg-white text-[#07090d] font-bold rounded-xl text-sm hover:bg-white/90 transition-colors shadow-lg"
          >
            {showForm ? '✕ Tutup' : '+ Catat Trade'}
          </motion.button>
        </div>
      </motion.div>

      {/* Stats */}
      {stats && !loading && <StatsBar stats={stats} />}

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <TradeJournalForm
            onSuccess={() => { setShowForm(false); fetchData() }}
            onCancel={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-4">
        {(['ALL', 'OPEN', 'CLOSED'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider transition-all border ${filter === f ? 'bg-white/10 border-white/20 text-white' : 'border-white/[0.06] text-white/30 hover:border-white/10'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Trade list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 text-white/20">
          <div className="text-4xl mb-3">📒</div>
          <div className="font-medium">Belum ada trade yang dicatat</div>
          <div className="text-sm mt-1">Mulai catat trade pertama kamu sekarang</div>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {filtered.map(trade => (
            <TradeCard
              key={trade.id}
              trade={trade}
              onClose={() => setClosingTrade(trade)}
            />
          ))}
        </div>
      )}

      {/* Close modal */}
      <AnimatePresence>
        {closingTrade && (
          <CloseTradeModal
            trade={closingTrade}
            onClose={() => setClosingTrade(null)}
            onClosed={() => { setClosingTrade(null); fetchData() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
