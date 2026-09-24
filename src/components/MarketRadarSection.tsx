import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { getExploreI18n } from '../utils/exploreIntelligenceI18n'
import { API_URL } from '../utils/api'
import FirstRunTooltip from './FirstRunTooltip'

interface MarketRadarProps {
  ticker: string
  i18n: ReturnType<typeof getExploreI18n>
  onSelectTicker?: (ticker: string) => void
}

// ── Asset type detection ──────────────────────────────────────────────────────

// Crypto pattern: ends in -USD — full list matching ExploreIntelligence asset list
const CRYPTO_TICKERS = new Set([
  'BTC-USD', 'ETH-USD', 'SOL-USD', 'BNB-USD', 'XRP-USD',
  'ADA-USD', 'DOGE-USD', 'MATIC-USD', 'AVAX-USD', 'DOT-USD',
  'LINK-USD', 'UNI-USD', 'ATOM-USD', 'LTC-USD', 'NEAR-USD',
  'APT-USD', 'ARB-USD',
])

// Commodities — futures symbols (end in =F) or mapped from pulse card labels
const COMMODITY_MAP: Record<string, { cotCode: string; label: string; unit: string }> = {
  'GC=F':  { cotCode: 'CFTC_088691', label: 'Gold (XAU)',     unit: '100 troy oz' },
  'SI=F':  { cotCode: 'CFTC_084691', label: 'Silver (XAG)',   unit: '5,000 troy oz' },
  'CL=F':  { cotCode: 'CFTC_067411', label: 'WTI Crude Oil',  unit: '1,000 barrels' },
  'NG=F':  { cotCode: 'CFTC_023651', label: 'Natural Gas',    unit: '10,000 MMBtu' },
  'HG=F':  { cotCode: 'CFTC_085692', label: 'Copper',         unit: '25,000 lbs' },
}

// True indices / FX / ETF — no insider trading exists
const NON_EQUITY_PATTERNS = [
  /^BTC-USD$/i, /^ETH-USD$/i, /^SOL-USD$/i, /^BNB-USD$/i, /^XRP-USD$/i,
  /=F$/,                    // Futures
  /\^/,                     // Yahoo-style index e.g. ^JKSE
  /\.NYB$/i,                // e.g. DX-Y.NYB (DXY)
  /^(SPY|QQQ|GLD|SLV|USO|GDX|GDXJ|VXX|UVXY|TLT|IEF|HYG|LQD)$/i, // Popular ETFs
]

// Indonesian stocks — .JK suffix
const INDO_STOCK_PATTERN = /\.JK$/i

type AssetKind = 'us_equity' | 'commodity' | 'crypto' | 'index_etf' | 'indo_stock'

function detectAssetKind(ticker: string): AssetKind {
  if (COMMODITY_MAP[ticker]) return 'commodity'
  if (CRYPTO_TICKERS.has(ticker)) return 'crypto'
  if (INDO_STOCK_PATTERN.test(ticker)) return 'indo_stock'
  if (NON_EQUITY_PATTERNS.some(p => p.test(ticker))) return 'index_etf'
  // Heuristic: US equity = 1-5 uppercase alpha letters only
  if (/^[A-Z]{1,5}$/.test(ticker)) return 'us_equity'
  return 'index_etf'
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface InsiderTransaction {
  owner_name: string
  owner_title: string | null
  transaction_date: string
  acquisition_or_disposition: 'Acquisition' | 'Disposition' | string
  securities_transacted: number | null
  transaction_price: number | null
  security_type: string
  transaction_type: string
}

interface CotData {
  date: string
  name: string
  // Non-commercial (Large Speculators = Hedge Funds)
  non_commercial_positions_long_all: number | null
  non_commercial_positions_short_all: number | null
  change_in_non_commercial_long_all: number | null
  change_in_non_commercial_short_all: number | null
  // Commercial (Producers / Merchants)
  commercial_positions_long_all: number | null
  commercial_positions_short_all: number | null
  change_in_commercial_long_all: number | null
  change_in_commercial_short_all: number | null
  // Open interest
  open_interest_all: number | null
  change_in_open_interest_all: number | null
  // Concentration
  concentration_net_top_4_traders_long_all: number | null
  concentration_net_top_4_traders_short_all: number | null
}

interface BinanceTrade {
  a: number // Aggregate tradeId
  p: string // Price
  q: string // Quantity
  f: number // First tradeId
  l: number // Last tradeId
  T: number // Timestamp
  m: boolean // Was the buyer the maker? (true = sell order hit the bid = Whale Sell, false = buy order hit the ask = Whale Buy)
  M: boolean // Was the trade the best price match?
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchInsiderTrading(symbol: string): Promise<InsiderTransaction[]> {
  const url = `${API_URL || ''}/api/openbb/insider_trading?symbol=${encodeURIComponent(symbol)}&limit=10`
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  return Array.isArray(json.data) ? json.data : []
}

async function fetchCotData(cotCode: string): Promise<CotData[]> {
  const url = `${API_URL || ''}/api/openbb/cot?code=${encodeURIComponent(cotCode)}&limit=8`
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  const arr = Array.isArray(json.data) ? json.data : []
  return arr.reverse()
}

async function fetchBinanceWhaleTrades(ticker: string): Promise<BinanceTrade[]> {
  const binanceSymbol = ticker.replace('-USD', 'USDT')
  const url = `${API_URL || ''}/api/binance/whale?symbol=${encodeURIComponent(binanceSymbol)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`Binance Proxy error: HTTP ${res.status}`)
  const json = await res.json()
  const data: BinanceTrade[] = Array.isArray(json.data) ? json.data : []
  
  // The backend already filters based on asset-specific thresholds (e.g. $5M for BTC)
  const whales = data
  
  return whales.reverse() // Newest first
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatDate(d: string | number) {
  try { return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return String(d) }
}

function formatTime(d: number) {
  try { return new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
  catch { return '' }
}

function fmtN(n: number | null, suffix = ''): string {
  if (n == null) return '—'
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M${suffix}`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K${suffix}`
  return `${n.toFixed(0)}${suffix}`
}

function fmtPrice(n: number | null) {
  if (n == null || n === 0) return '—'
  return `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n)}`
}

function fmtChange(n: number | null) {
  if (n == null) return { text: '—', positive: null }
  const text = n >= 0 ? `+${fmtN(n)}` : fmtN(n)
  return { text, positive: n >= 0 }
}

// ── Example tickers for the fallback panel ────────────────────────────────────
const EXAMPLE_TICKERS = [
  { symbol: 'AAPL', label: 'Apple' },
  { symbol: 'NVDA', label: 'Nvidia' },
  { symbol: 'TSLA', label: 'Tesla' },
  { symbol: 'GOOGL', label: 'Google' },
  { symbol: 'MSFT', label: 'Microsoft' },
  { symbol: 'META', label: 'Meta' },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function RadarHeader({ icon, title, sub, live }: { icon: React.ReactNode; title: string; sub: string; live?: boolean }) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-teal-500/10 border border-teal-500/20">
          {icon}
          {live && <span className="absolute inset-0 rounded-full border border-teal-500/40 animate-ping" />}
        </div>
        <div className="relative">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            {title}
            <FirstRunTooltip 
              id="insider_radar"
              titleId="Lacak Manuver Paus"
              titleEn="Track Whale Movements"
              descId="Pantau aktivitas transaksi oleh direksi perusahaan atau Big Money (Whale). Pembelian dalam jumlah besar seringkali menjadi sinyal kuat."
              descEn="Monitor transactions by company directors or Big Money (Whales). Large purchases are often strong signals."
              placement="bottom"
              className="left-0 translate-x-0"
            />
          </h3>
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{sub}</p>
        </div>
      </div>
      {live && (
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500" />
          </span>
          <span className="text-[10px] font-mono text-teal-400 uppercase tracking-widest">Live Data</span>
        </div>
      )}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="py-10 flex flex-col items-center justify-center gap-3 border border-white/[0.04] bg-white/[0.01] rounded-xl">
      <div className="w-5 h-5 border-2 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
      <p className="text-xs text-slate-500 font-mono">Memuat data...</p>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="py-6 border border-red-500/10 bg-red-500/[0.02] rounded-xl px-6 text-center space-y-1">
      <p className="text-xs text-red-400 font-mono">{message}</p>
      <p className="text-[10px] text-slate-600">Periksa koneksi ke server OpenBB.</p>
    </div>
  )
}

// ── Insider Trading Panel (US Equity) ─────────────────────────────────────────

function InsiderTradingPanel({ ticker }: { ticker: string }) {
  const [data, setData] = useState<InsiderTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null); setData([])
    fetchInsiderTrading(ticker)
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(`Gagal: ${e.message}`); setLoading(false) } })
    return () => { cancelled = true }
  }, [ticker])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />
  if (data.length === 0) return (
    <div className="py-6 border border-white/[0.04] bg-white/[0.01] rounded-xl px-6 text-center">
      <p className="text-xs text-slate-500 font-mono">Tidak ada laporan insider trading terbaru dari SEC untuk {ticker}.</p>
    </div>
  )

  return (
    <AnimatePresence mode="popLayout">
      <div className="divide-y divide-white/[0.04] rounded-xl overflow-hidden border border-white/[0.05]">
        {data.map((tx, i) => {
          const isBuy = tx.acquisition_or_disposition === 'Acquisition'
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-white/[0.02] transition-colors"
            >
              <div className="space-y-0.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isBuy ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                    {isBuy ? '▲ Acquisition' : '▼ Disposition'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-600">{tx.security_type}</span>
                </div>
                <p className="text-xs font-medium text-slate-200 truncate">
                  {tx.owner_name}
                  {tx.owner_title ? <span className="text-slate-500 font-normal ml-1">· {tx.owner_title}</span> : null}
                </p>
                <p className="text-[11px] text-slate-600 leading-snug truncate">{tx.transaction_type}</p>
              </div>
              <div className="text-left sm:text-right shrink-0 space-y-0.5 mt-2 sm:mt-0 pt-2 sm:pt-0 border-t border-white/[0.04] sm:border-0">
                <p className="text-xs font-mono text-slate-200 font-medium">{fmtN(tx.securities_transacted)} shares</p>
                {tx.transaction_price != null && tx.transaction_price > 0 && (
                  <p className="text-[11px] text-slate-500 font-mono">@ {fmtPrice(tx.transaction_price)}</p>
                )}
                <p className="text-[10px] text-slate-600 font-mono">{formatDate(tx.transaction_date)}</p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </AnimatePresence>
  )
}

// ── COT Radar Panel (Commodities) ─────────────────────────────────────────────

function CotRadarPanel({ ticker }: { ticker: string }) {
  const meta = COMMODITY_MAP[ticker]
  const [data, setData] = useState<CotData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!meta) return
    let cancelled = false
    setLoading(true); setError(null); setData([])
    fetchCotData(meta.cotCode)
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(`Gagal: ${e.message}`); setLoading(false) } })
    return () => { cancelled = true }
  }, [ticker, meta])

  if (!meta) return <ErrorState message="Komoditas tidak dikenali" />
  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  const latest = data[0]
  if (!latest) return (
    <div className="py-6 border border-white/[0.04] bg-white/[0.01] rounded-xl px-6 text-center">
      <p className="text-xs text-slate-500 font-mono">Tidak ada data COT terbaru dari CFTC.</p>
    </div>
  )

  // Compute net positions
  const hedgeLong  = latest.non_commercial_positions_long_all ?? 0
  const hedgeShort = latest.non_commercial_positions_short_all ?? 0
  const hedgeNet   = hedgeLong - hedgeShort
  const prodLong   = latest.commercial_positions_long_all ?? 0
  const prodShort  = latest.commercial_positions_short_all ?? 0
  const prodNet    = prodLong - prodShort

  const hedgeChg = fmtChange(latest.change_in_non_commercial_long_all != null && latest.change_in_non_commercial_short_all != null
    ? latest.change_in_non_commercial_long_all - latest.change_in_non_commercial_short_all
    : null)
  const prodChg = fmtChange(latest.change_in_commercial_long_all != null && latest.change_in_commercial_short_all != null
    ? latest.change_in_commercial_long_all - latest.change_in_commercial_short_all
    : null)

  // Sentiment: if hedge funds are net long → bullish signal
  const isHedgeBullish = hedgeNet > 0
  const totalOI = (hedgeLong + hedgeShort + prodLong + prodShort) || 1
  const hedgeLongPct = Math.round((hedgeLong / totalOI) * 100)
  const hedgeShortPct = Math.round((hedgeShort / totalOI) * 100)

  return (
    <div className="space-y-4">
      {/* Latest date */}
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-slate-600 uppercase tracking-widest">Laporan CFTC terbaru</span>
        <span className="text-slate-400">{formatDate(latest.date)}</span>
      </div>

      {/* Sentiment Badge */}
      <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${isHedgeBullish ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-red-500/20 bg-red-500/[0.04]'}`}>
        <span className="text-2xl">{isHedgeBullish ? '🐂' : '🐻'}</span>
        <div>
          <p className={`text-sm font-semibold ${isHedgeBullish ? 'text-emerald-400' : 'text-red-400'}`}>
            Hedge Funds {isHedgeBullish ? 'Net Long (Bullish)' : 'Net Short (Bearish)'} pada {meta.label}
          </p>
          <p className="text-[11px] text-slate-500">Net posisi spekulan: {isHedgeBullish ? '+' : ''}{fmtN(hedgeNet)} kontrak</p>
        </div>
      </div>

      {/* Two column: Hedge Funds vs Commercials */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Hedge Funds / Large Speculators */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">🏦 Hedge Fund (Spekulan)</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Long</span>
              <span className="text-emerald-400 font-mono font-medium">{fmtN(hedgeLong)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Short</span>
              <span className="text-red-400 font-mono font-medium">{fmtN(hedgeShort)}</span>
            </div>
            <div className="flex justify-between text-xs border-t border-white/[0.04] pt-1.5">
              <span className="text-slate-300 font-medium">Net</span>
              <span className={`font-mono font-bold ${hedgeNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {hedgeNet >= 0 ? '+' : ''}{fmtN(hedgeNet)}
              </span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-600">Perubahan net</span>
              <span className={`font-mono ${hedgeChg.positive === true ? 'text-emerald-500' : hedgeChg.positive === false ? 'text-red-500' : 'text-slate-600'}`}>
                {hedgeChg.text}
              </span>
            </div>
          </div>
          {/* Bar chart */}
          <div className="space-y-1">
            <div className="flex gap-1 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500/60 rounded-l-full" style={{ width: `${hedgeLongPct}%` }} />
              <div className="bg-red-500/60 rounded-r-full" style={{ width: `${hedgeShortPct}%` }} />
            </div>
            <div className="flex justify-between text-[9px] text-slate-700 font-mono">
              <span>Long {hedgeLongPct}%</span>
              <span>Short {hedgeShortPct}%</span>
            </div>
          </div>
        </div>

        {/* Commercials / Producers */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">⛏️ Komersial (Produsen)</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Long</span>
              <span className="text-emerald-400 font-mono font-medium">{fmtN(prodLong)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Short</span>
              <span className="text-red-400 font-mono font-medium">{fmtN(prodShort)}</span>
            </div>
            <div className="flex justify-between text-xs border-t border-white/[0.04] pt-1.5">
              <span className="text-slate-300 font-medium">Net</span>
              <span className={`font-mono font-bold ${prodNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {prodNet >= 0 ? '+' : ''}{fmtN(prodNet)}
              </span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-600">Perubahan net</span>
              <span className={`font-mono ${prodChg.positive === true ? 'text-emerald-500' : prodChg.positive === false ? 'text-red-500' : 'text-slate-600'}`}>
                {prodChg.text}
              </span>
            </div>
          </div>
          {/* Open Interest */}
          <div className="border-t border-white/[0.04] pt-2 space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-600">Open Interest</span>
              <span className="text-slate-400 font-mono">{fmtN(latest.open_interest_all)}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-600">Perubahan OI</span>
              {(() => { const c = fmtChange(latest.change_in_open_interest_all); return <span className={`font-mono ${c.positive === true ? 'text-emerald-500' : c.positive === false ? 'text-red-500' : 'text-slate-600'}`}>{c.text}</span> })()}
            </div>
          </div>
        </div>
      </div>

      {/* Concentration top 4 / top 8 */}
      {(latest.concentration_net_top_4_traders_long_all != null) && (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-4 space-y-2">
          <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">Konsentrasi posisi (Top Traders)</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Top 4 Long</span>
              <span className="text-slate-300 font-mono">{latest.concentration_net_top_4_traders_long_all?.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Top 4 Short</span>
              <span className="text-slate-300 font-mono">{latest.concentration_net_top_4_traders_short_all?.toFixed(1)}%</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-700 leading-relaxed">
            % open interest yang dikuasai 4 trader terbesar. Nilai tinggi berarti pasar terkonsentrasi pada pemain besar.
          </p>
        </div>
      )}

      {/* Historical rows */}
      {data.length > 1 && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">Riwayat mingguan (Hedge Fund Net)</p>
          <div className="divide-y divide-white/[0.03] rounded-xl overflow-hidden border border-white/[0.05]">
            {data.slice(0, 6).map((row, i) => {
              const net = (row.non_commercial_positions_long_all ?? 0) - (row.non_commercial_positions_short_all ?? 0)
              const positive = net >= 0
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="px-4 py-2 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-[11px] font-mono text-slate-600">{formatDate(row.date)}</span>
                  <span className={`text-[11px] font-mono font-medium ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {positive ? '+' : ''}{fmtN(net)}
                  </span>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-700 font-mono uppercase tracking-wider">
        Data CFTC Commitments of Traders (COT) — dirilis setiap Jumat. Bukan rekomendasi transaksi.
      </p>
    </div>
  )
}

// ── Crypto Whale Panel (Binance) ─────────────────────────────────────────────

function CryptoWhalePanel({ ticker }: { ticker: string }) {
  const [data, setData] = useState<BinanceTrade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null); setData([])
    fetchBinanceWhaleTrades(ticker)
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(`Gagal: ${e.message}`); setLoading(false) } })
    return () => { cancelled = true }
  }, [ticker])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />
  if (data.length === 0) return (
    <div className="py-8 border border-white/[0.04] bg-white/[0.01] rounded-xl px-6 text-center">
      <div className="w-10 h-10 mx-auto bg-slate-800/50 rounded-full flex items-center justify-center mb-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-slate-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v20m0 0l-4-4m4 4l4-4" />
        </svg>
      </div>
      <p className="text-xs text-slate-400 font-mono">Menunggu aliran dana institusi...</p>
      <p className="text-[10px] text-slate-600 mt-1">Sistem sedang mendengarkan transaksi raksasa di pasar spot.</p>
    </div>
  )

  const formatWhaleUsd = (val: number) => {
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`
    if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`
    return `$${val.toFixed(0)}`
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-slate-600 uppercase tracking-widest">Live Spot Trades · Dynamic Whale Thresholds</span>
        <span className="text-emerald-500 animate-pulse">● Binance Live</span>
      </div>

      {/* Volume Delta Summary */}
      {data.length > 0 && (() => {
        const buyVol = data.slice(0, 15).filter(t => !t.m).reduce((s, t) => s + parseFloat(t.p) * parseFloat(t.q), 0)
        const sellVol = data.slice(0, 15).filter(t => t.m).reduce((s, t) => s + parseFloat(t.p) * parseFloat(t.q), 0)
        const total = buyVol + sellVol || 1
        const buyPct = Math.round((buyVol / total) * 100)
        const sellPct = 100 - buyPct
        const delta = buyVol - sellVol
        const isDeltaPos = delta >= 0
        return (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">⚡ Volume Delta (Batch Terbaru)</p>
              <span className={`text-xs font-mono font-bold ${isDeltaPos ? 'text-emerald-400' : 'text-red-400'}`}>
                {isDeltaPos ? '+' : ''}{formatWhaleUsd(Math.abs(delta))} {isDeltaPos ? 'NET BUY' : 'NET SELL'}
              </span>
            </div>
            <div className="flex gap-0.5 h-3 rounded-full overflow-hidden">
              <div className="bg-emerald-500/70 rounded-l-full transition-all" style={{ width: `${buyPct}%` }} />
              <div className="bg-red-500/60 rounded-r-full transition-all" style={{ width: `${sellPct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span className="text-emerald-400">▲ Buy {formatWhaleUsd(buyVol)} ({buyPct}%)</span>
              <span className="text-red-400">▼ Sell {formatWhaleUsd(sellVol)} ({sellPct}%)</span>
            </div>
          </div>
        )
      })()}

      <div className="divide-y divide-white/[0.04] rounded-xl overflow-hidden border border-white/[0.05]">
        {data.slice(0, 15).map((tx, i) => {
          // If m is true, the buyer was a maker -> the taker was a SELLER. So it's a market SELL.
          // If m is false, the taker was a BUYER. So it's a market BUY.
          const isBuy = !tx.m
          const price = parseFloat(tx.p)
          const qty = parseFloat(tx.q)
          const valueUsd = price * qty

          return (
            <motion.div
              key={tx.a}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-[#1a1f2e]/50 transition-colors relative group"
            >
              {/* Subtle hover accent line */}
              <div className={`absolute left-0 top-0 bottom-0 w-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isBuy ? 'bg-emerald-500' : 'bg-red-500'}`} />
              
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Buy/Sell Indicator */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${isBuy ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    {isBuy ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />}
                  </svg>
                </div>
                
                <div className="space-y-0.5">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-[15px] font-bold font-mono tracking-tight ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatWhaleUsd(valueUsd)}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                      {isBuy ? 'INFLOW' : 'OUTFLOW'}
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-400 font-mono tracking-tight">
                    {qty.toFixed(4)} <span className="text-slate-500">{ticker.replace('-USD', '')}</span> @ {fmtPrice(price)}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-[12px] font-mono text-slate-300 bg-slate-800/50 px-2 py-0.5 rounded inline-block border border-white/[0.05]">
                  {formatTime(tx.T)}
                </p>
                <p className="text-[9px] text-slate-600 font-mono mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  ID: {tx.a}
                </p>
              </div>
            </motion.div>
          )
        })}
      </div>
      
      <p className="text-[10px] text-slate-700 font-mono uppercase tracking-wider">
        Data Real-Time Binance AggTrades — Filter: Dynamic Whale Thresholds (e.g. $500K+ BTC, $200K+ ETH)
      </p>
    </div>
  )
}

// ── Not Available Panel ───────────────────────────────────────────────────────

// ── Indo Stock Panel ──────────────────────────────────────────────────────────

function IndoStockPanel({ ticker }: { ticker: string }) {
  const cleanName = ticker.replace('.JK', '')
  const tvSymbol = `IDX:${cleanName}`

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-5 py-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🇮🇩</span>
          <div>
            <p className="text-sm font-semibold text-amber-300">Saham IDX: {cleanName}</p>
            <p className="text-[11px] text-slate-500">Data Insider Trading saham BEI belum tersedia secara publik gratis.</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 space-y-3">
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">📊 Informasi yang tersedia untuk IHSG</p>
        <ul className="space-y-2 text-xs text-slate-400">
          <li className="flex items-start gap-2">
            <span className="text-teal-400 mt-0.5">✓</span>
            <span><strong className="text-slate-200">Chart TradingView</strong> — Harga & volume historis tersedia di panel kiri atas</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-teal-400 mt-0.5">✓</span>
            <span><strong className="text-slate-200">Komando Pagi AI</strong> — Analisis makro IHSG setiap pagi hari dengan konteks global</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-teal-400 mt-0.5">✓</span>
            <span><strong className="text-slate-200">AI Chat Copilot</strong> — Tanya langsung tentang fundamental, valuasi, atau sentimen {cleanName}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-slate-600 mt-0.5">○</span>
            <span className="text-slate-600">Insider trading BEI — Memerlukan data OJK/IDX premium (roadmap)</span>
          </li>
        </ul>
      </div>

      <div className="rounded-xl border border-teal-500/10 bg-teal-500/[0.03] p-4">
        <p className="text-[10px] font-mono text-teal-600 uppercase tracking-widest mb-2">🎯 TradingView Live Chart</p>
        <p className="text-xs text-slate-400">
          Simbol TradingView untuk saham ini: <span className="text-teal-300 font-mono font-medium">{tvSymbol}</span>
        </p>
        <p className="text-[11px] text-slate-600 mt-1">Gunakan chart interaktif di atas untuk analisis teknikal secara langsung.</p>
      </div>
    </div>
  )
}

function NotAvailablePanel({ ticker, kind, onSelectExample }: { ticker: string; kind: AssetKind; onSelectExample?: (s: string) => void }) {
  const clean = ticker.replace('=F', '').replace('-USD', '').replace('-', '/').replace('.NYB', '')

  const reasons: Record<AssetKind, string> = {
    crypto:    'Aset kripto ini tidak didukung oleh Binance Whale Tracker atau formatnya salah.',
    index_etf: 'Indeks dan ETF tidak memiliki struktur kepemilikan insider. Gunakan ticker saham individual yang ada di dalamnya.',
    commodity: 'Komoditas ini belum memiliki data COT yang dipetakan. Tersedia untuk: Emas (GC=F), Perak (SI=F), Minyak WTI (CL=F).',
    us_equity: 'Aset ini tidak terdeteksi sebagai saham US yang dapat dicari data insidernya.',
    indo_stock: 'Data orderbook atau insider trading untuk IHSG belum tersedia secara publik.',
  }

  return (
    <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-5 space-y-4">
      <div className="flex gap-3">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/15 flex items-center justify-center">ℹ️</div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-200">
            Data tidak tersedia untuk <span className="font-mono text-amber-400">{clean}</span>
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed">{reasons[kind]}</p>
        </div>
      </div>

      {kind !== 'commodity' && (
        <div className="border-t border-white/[0.04] pt-4 space-y-2">
          <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">Coba saham US berikut ↓</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_TICKERS.map(ex => (
              <button
                key={ex.symbol}
                onClick={() => { onSelectExample?.(ex.symbol); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] text-[11px] font-mono text-slate-300 hover:border-teal-500/30 hover:bg-teal-500/[0.05] hover:text-teal-300 transition-all cursor-pointer"
              >
                {ex.symbol} <span className="text-slate-600 ml-1">· {ex.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MarketRadarSection({ ticker, i18n: _i18n, onSelectTicker }: MarketRadarProps) {
  const kind = detectAssetKind(ticker)
  const clean = ticker.replace('=F', '').replace('-USD', '').replace('-', '/').replace('.NYB', '')

  const isCommodity = kind === 'commodity'
  const isUsEquity  = kind === 'us_equity'
  const isCrypto    = kind === 'crypto'
  const isIndoStock = kind === 'indo_stock'
  const showUnavailable = !isCommodity && !isUsEquity && !isCrypto && !isIndoStock

  const svgIcon = isCommodity ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-400">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
    </svg>
  ) : isCrypto ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-400">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-400">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )

  const title = isCommodity ? 'Commodity Whale Radar (COT)' : isCrypto ? 'Crypto Whale Tracker' : 'Insider Trading Radar'
  const sub   = isCommodity
    ? `${clean} · CFTC Commitments of Traders`
    : isCrypto
    ? `${clean} · Live Binance Trades (Dynamic Thresholds)`
    : `${clean} · SEC Form 4 via OpenBB`

  return (
    <div className="rounded-2xl border border-white/[0.06] p-6 space-y-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <RadarHeader icon={svgIcon} title={title} sub={sub} live={isUsEquity || isCommodity || isCrypto} />

      {showUnavailable
        ? <NotAvailablePanel ticker={ticker} kind={kind} onSelectExample={onSelectTicker} />
        : isCommodity
          ? <CotRadarPanel ticker={ticker} />
          : isCrypto
          ? <CryptoWhalePanel ticker={ticker} />
          : isIndoStock
          ? <IndoStockPanel ticker={ticker} />
          : <InsiderTradingPanel ticker={ticker} />
      }
    </div>
  )
}
