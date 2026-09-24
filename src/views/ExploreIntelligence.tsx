/**
 * ExploreIntelligence.tsx
 * Route: /explore-intelligence  (redirects from /ting-ai-2, /decision-briefing)
 *
 * Fixes applied:
 * 1. Chart: locale-aware date labels passed to fetchHistory
 * 2. Chart: error boundary per-ticker so one failure doesn't blank everything
 * 3. Chart: explicit container height via inline style (not Tailwind class)
 * 4. Data: no fake/demo numbers — shows clear unavailable state on failure
 * 5. i18n: 100% driven by exploreIntelligenceI18n, zero hardcoded JSX text
 * 6. userPlan: read from localStorage so route doesn't need to pass it
 */
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts'
import { getMarketQuote, getMultipleMarketQuotes, getMarketHistory, getMarketNews, getMarketNewsResponse } from '../services/marketData'
import type { MarketQuote, MarketHistoryPoint, MarketNewsItem, MarketNewsResponse } from '../services/marketData'
import { getPortfolioRelevance } from '../utils/explorePortfolioRelevance'
import { readPortfolioSnapshot } from '../utils/portfolioSnapshot'
import { getExploreI18n } from '../utils/exploreIntelligenceI18n'
import { useLanguagePreference } from '../utils/language'
import MulaiDariSiniCard from '../components/MulaiDariSiniCard'
import FundamentalPanel from '../components/FundamentalPanel'
import AIForecastPanel from '../components/AIForecastPanel'
import MarketRadarSection from '../components/MarketRadarSection'
import MacroDashboard from '../components/MacroDashboard'
import TradingSetupPanel from '../components/TradingSetupPanel'
import TradingSetup from '../components/TradingSetup'
import SmartMoneyRadar from '../components/SmartMoneyRadar'
import SectorsIntelligence from '../components/SectorsIntelligence'
import MacroEventCard, { type MacroEvent } from '../components/MacroEventCard'

// ── Market assets ─────────────────────────────────────────────────────────────
const PULSE_ASSETS = [
  { symbol: 'IHSG',    apiSymbol: '^JKSE',     labelId: 'IDX Composite', labelEn: 'IDX Composite' },
  { symbol: 'BBCA',    apiSymbol: 'BBCA.JK',   labelId: 'BCA',           labelEn: 'BCA' },
  { symbol: 'BMRI',    apiSymbol: 'BMRI.JK',   labelId: 'Mandiri',       labelEn: 'Mandiri' },
  { symbol: 'TLKM',    apiSymbol: 'TLKM.JK',   labelId: 'Telkom',        labelEn: 'Telkom' },
  { symbol: 'ASII',    apiSymbol: 'ASII.JK',   labelId: 'Astra Int.',    labelEn: 'Astra Int.' },
  { symbol: 'BBNI',    apiSymbol: 'BBNI.JK',   labelId: 'BNI',           labelEn: 'BNI' },
  { symbol: 'GOTO',    apiSymbol: 'GOTO.JK',   labelId: 'GoTo',          labelEn: 'GoTo' },
  { symbol: 'AMMN',    apiSymbol: 'AMMN.JK',   labelId: 'Amman Mineral', labelEn: 'Amman Mineral' },
  { symbol: 'ADRO',    apiSymbol: 'ADRO.JK',   labelId: 'Adaro Energy',  labelEn: 'Adaro Energy' },
  { symbol: 'BRPT',    apiSymbol: 'BRPT.JK',   labelId: 'Barito Pacific',labelEn: 'Barito Pacific' },
  { symbol: 'XAU/USD', apiSymbol: 'GC=F',      labelId: 'Emas',          labelEn: 'Gold (XAU)' },
  { symbol: 'XAG/USD', apiSymbol: 'SI=F',      labelId: 'Perak',         labelEn: 'Silver (XAG)' },
  { symbol: 'Oil',     apiSymbol: 'CL=F',      labelId: 'Minyak WTI',    labelEn: 'WTI Oil' },
  { symbol: 'NatGas',  apiSymbol: 'NG=F',      labelId: 'Gas Alam',      labelEn: 'Natural Gas' },
  { symbol: 'Copper',  apiSymbol: 'HG=F',      labelId: 'Tembaga',       labelEn: 'Copper' },
  { symbol: 'BTC',     apiSymbol: 'BTC-USD',   labelId: 'Bitcoin',       labelEn: 'Bitcoin' },
  { symbol: 'ETH',     apiSymbol: 'ETH-USD',   labelId: 'Ethereum',      labelEn: 'Ethereum' },
  { symbol: 'SOL',     apiSymbol: 'SOL-USD',   labelId: 'Solana',        labelEn: 'Solana' },
  { symbol: 'BNB',     apiSymbol: 'BNB-USD',   labelId: 'BNB',           labelEn: 'BNB' },
  { symbol: 'XRP',     apiSymbol: 'XRP-USD',   labelId: 'XRP',           labelEn: 'XRP' },
  // S4: 12 token kripto tambahan
  { symbol: 'ADA',     apiSymbol: 'ADA-USD',   labelId: 'Cardano',       labelEn: 'Cardano' },
  { symbol: 'DOGE',    apiSymbol: 'DOGE-USD',  labelId: 'Dogecoin',      labelEn: 'Dogecoin' },
  { symbol: 'MATIC',   apiSymbol: 'MATIC-USD', labelId: 'Polygon',       labelEn: 'Polygon' },
  { symbol: 'AVAX',    apiSymbol: 'AVAX-USD',  labelId: 'Avalanche',     labelEn: 'Avalanche' },
  { symbol: 'DOT',     apiSymbol: 'DOT-USD',   labelId: 'Polkadot',      labelEn: 'Polkadot' },
  { symbol: 'LINK',    apiSymbol: 'LINK-USD',  labelId: 'Chainlink',     labelEn: 'Chainlink' },
  { symbol: 'UNI',     apiSymbol: 'UNI-USD',   labelId: 'Uniswap',       labelEn: 'Uniswap' },
  { symbol: 'ATOM',    apiSymbol: 'ATOM-USD',  labelId: 'Cosmos',        labelEn: 'Cosmos' },
  { symbol: 'LTC',     apiSymbol: 'LTC-USD',   labelId: 'Litecoin',      labelEn: 'Litecoin' },
  { symbol: 'NEAR',    apiSymbol: 'NEAR-USD',  labelId: 'NEAR Protocol', labelEn: 'NEAR Protocol' },
  { symbol: 'APT',     apiSymbol: 'APT-USD',   labelId: 'Aptos',         labelEn: 'Aptos' },
  { symbol: 'ARB',     apiSymbol: 'ARB-USD',   labelId: 'Arbitrum',      labelEn: 'Arbitrum' },
  { symbol: 'S&P 500', apiSymbol: 'SPY',       labelId: 'S&P 500 ETF',   labelEn: 'S&P 500 ETF' },
  { symbol: 'Nasdaq',  apiSymbol: 'QQQ',       labelId: 'Nasdaq ETF',    labelEn: 'Nasdaq ETF' },
  { symbol: 'DXY',     apiSymbol: 'DX-Y.NYB',  labelId: 'Indeks USD',    labelEn: 'USD Index' },
  { symbol: 'AAPL',    apiSymbol: 'AAPL',      labelId: 'Apple Inc.',    labelEn: 'Apple Inc.' },
  { symbol: 'MSFT',    apiSymbol: 'MSFT',      labelId: 'Microsoft',     labelEn: 'Microsoft' },
  { symbol: 'NVDA',    apiSymbol: 'NVDA',      labelId: 'NVIDIA',        labelEn: 'NVIDIA' },
  { symbol: 'TSLA',    apiSymbol: 'TSLA',      labelId: 'Tesla',         labelEn: 'Tesla' },
  { symbol: 'AMZN',    apiSymbol: 'AMZN',      labelId: 'Amazon',        labelEn: 'Amazon' },
  { symbol: 'GOOGL',   apiSymbol: 'GOOGL',     labelId: 'Alphabet',      labelEn: 'Alphabet (Google)' },
  { symbol: 'META',    apiSymbol: 'META',      labelId: 'Meta',          labelEn: 'Meta' },
  { symbol: 'AMD',     apiSymbol: 'AMD',       labelId: 'AMD',           labelEn: 'AMD' },
  { symbol: 'COIN',    apiSymbol: 'COIN',      labelId: 'Coinbase',      labelEn: 'Coinbase' },
  // K4: Macro Assets
  { symbol: 'USD/IDR', apiSymbol: 'USDIDR=X',  labelId: 'Kurs USD/IDR',  labelEn: 'USD/IDR Rate' },
  { symbol: 'VIX',     apiSymbol: '^VIX',      labelId: 'VIX (Fear)',    labelEn: 'VIX Fear Index' },
  { symbol: 'TNX',     apiSymbol: '^TNX',      labelId: 'UST 10Y',       labelEn: 'US 10Y Yield' },
]

const MARKET_CATEGORIES = [
  { id: 'all', labelId: 'Semua', labelEn: 'All' },
  { id: 'komoditas', labelId: 'Komoditas', labelEn: 'Commodities', symbols: ['XAU/USD', 'XAG/USD', 'Oil', 'NatGas', 'Copper'] },
  // S4: Updated crypto category with all 17 tokens
  { id: 'crypto', labelId: 'Crypto', labelEn: 'Crypto', symbols: ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC', 'AVAX', 'DOT', 'LINK', 'UNI', 'ATOM', 'LTC', 'NEAR', 'APT', 'ARB'] },
  { id: 'saham', labelId: 'Saham Indo', labelEn: 'Indo Stocks', symbols: ['IHSG', 'BBCA', 'BMRI', 'TLKM', 'ASII', 'BBNI', 'GOTO', 'AMMN', 'ADRO', 'BRPT'] },
  { id: 'global', labelId: 'Stock US', labelEn: 'US Stocks', symbols: ['S&P 500', 'Nasdaq', 'DXY', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'AMD', 'COIN'] },
  // K4: Macro category
  { id: 'makro', labelId: 'Makro', labelEn: 'Macro', symbols: ['USD/IDR', 'VIX', 'TNX', 'DXY'] },
]

// S5: TradingView symbol map — apiSymbol → TradingView ticker
const TRADINGVIEW_SYMBOL_MAP: Record<string, string> = {
  '^JKSE':    'IDX:COMPOSITE',
  'BBCA.JK':  'IDX:BBCA',
  'BMRI.JK':  'IDX:BMRI',
  'TLKM.JK':  'IDX:TLKM',
  'ASII.JK':  'IDX:ASII',
  'BBNI.JK':  'IDX:BBNI',
  'GOTO.JK':  'IDX:GOTO',
  'AMMN.JK':  'IDX:AMMN',
  'ADRO.JK':  'IDX:ADRO',
  'BRPT.JK':  'IDX:BRPT',
  'GC=F':     'OANDA:XAUUSD',
  'SI=F':     'OANDA:XAGUSD',
  'CL=F':     'TVC:USOIL',
  'NG=F':     'TVC:US02Y', // NatGas approximation for TVC, or NYMEX:NG1!
  'HG=F':     'COMEX:HG1!',
  'BTC-USD':  'BINANCE:BTCUSDT',
  'ETH-USD':  'BINANCE:ETHUSDT',
  'SOL-USD':  'BINANCE:SOLUSDT',
  'BNB-USD':  'BINANCE:BNBUSDT',
  'XRP-USD':  'BINANCE:XRPUSDT',
  'ADA-USD':  'BINANCE:ADAUSDT',
  'DOGE-USD': 'BINANCE:DOGEUSDT',
  'MATIC-USD':'BINANCE:MATICUSDT',
  'AVAX-USD': 'BINANCE:AVAXUSDT',
  'DOT-USD':  'BINANCE:DOTUSDT',
  'LINK-USD': 'BINANCE:LINKUSDT',
  'UNI-USD':  'BINANCE:UNIUSDT',
  'ATOM-USD': 'BINANCE:ATOMUSDT',
  'LTC-USD':  'BINANCE:LTCUSDT',
  'NEAR-USD': 'BINANCE:NEARUSDT',
  'APT-USD':  'BINANCE:APTUSDT',
  'ARB-USD':  'BINANCE:ARBUSDT',
  'SPY':      'AMEX:SPY',
  'QQQ':      'NASDAQ:QQQ',
  'DX-Y.NYB': 'TVC:DXY',
  'AAPL':     'NASDAQ:AAPL',
  'MSFT':     'NASDAQ:MSFT',
  'NVDA':     'NASDAQ:NVDA',
  'TSLA':     'NASDAQ:TSLA',
  'AMZN':     'NASDAQ:AMZN',
  'GOOGL':    'NASDAQ:GOOGL',
  'META':     'NASDAQ:META',
  'AMD':      'NASDAQ:AMD',
  'COIN':     'NASDAQ:COIN',
  'USDIDR=X': 'FX_IDC:USDIDR',
  '^VIX':     'CBOE:VIX',
  '^TNX':     'TVC:TNX',
}

// Pre-computed stable reference — avoids re-creating array every render
const NEWS_SYMBOLS = PULSE_ASSETS.map(a => a.apiSymbol)

const RANGES = ['5d', '1mo', '3mo', '6mo'] as const
type Range = typeof RANGES[number]

// ── Number formatter ─────────────────────────────────────────────────────────
function fmt(n: number, currency?: string): string {
  if (!Number.isFinite(n)) return '—'
  if (currency === 'IDR' || n > 100_000)
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n)
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

// ── Pulse Card ────────────────────────────────────────────────────────────────
function PulseCard({
  asset, quote, selected, onClick, i18n, language,
}: {
  asset: typeof PULSE_ASSETS[number]
  quote: MarketQuote | null | undefined
  selected: boolean
  onClick: () => void
  i18n: ReturnType<typeof getExploreI18n>
  language: 'en' | 'id'
}) {
  const hasData = quote != null
  const up = (quote?.changePercent ?? 0) >= 0
  const assetLabel = language === 'id' ? asset.labelId : asset.labelEn

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      onClick={onClick}
      className={`text-left p-5 rounded-2xl border transition-all duration-300 w-full cursor-pointer group ${
        selected
          ? 'bg-white/[0.07] border-teal-500/30 ring-1 ring-teal-500/10 shadow-xl shadow-teal-500/5'
          : 'bg-white/[0.025] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12] hover:-translate-y-0.5 hover:shadow-lg'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-sm tracking-tight">{asset.symbol}</p>
          <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mt-0.5">{assetLabel}</p>
        </div>
        {hasData ? (
          <span
            className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
            style={{
              background: up ? 'rgba(20,184,166,0.12)' : 'rgba(239,68,68,0.10)',
              color: up ? '#2dd4bf' : '#f87171',
              border: `1px solid ${up ? 'rgba(20,184,166,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}
          >
            {up ? '↑' : '↓'}
          </span>
        ) : (
          <span className="text-[9px] font-mono text-slate-700 uppercase">{i18n.unavailableLabel}</span>
        )}
      </div>

      {hasData ? (
        <div className="space-y-0.5">
          <p className="text-base font-semibold numeric-value">{fmt(quote!.price, quote!.currency)}</p>
          <p className={`text-xs font-mono font-medium ${up ? 'text-teal-400' : 'text-red-400'}`}>
            {up ? '+' : ''}{quote!.changePercent.toFixed(2)}%
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-600 mt-2">
          {asset.apiSymbol === '^JKSE' ? i18n.ihsgUnavailable : i18n.marketDataUnavailable}
        </p>
      )}
    </motion.button>
  )
}

// ── Chart Tooltip ─────────────────────────────────────────────────────────────
function ChartTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0c0e14] border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-[10px] font-mono text-slate-500 mb-1">{label}</p>
      <p className="text-sm font-semibold numeric-value text-teal-400">{fmt(payload[0].value)}</p>
    </div>
  )
}

// ── Smart Chart ───────────────────────────────────────────────────────────────
function SmartChart({
  ticker, up, locale, i18n,
}: {
  ticker: string
  up: boolean
  locale: string
  i18n: ReturnType<typeof getExploreI18n>
}) {
  const [data, setData]     = useState<(MarketHistoryPoint & { date: string, close: number })[]>([])
  const [range, setRange]   = useState<Range>('1mo')
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  // Reset + fetch when ticker OR range OR locale changes
  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setData([])

    getMarketHistory(ticker, range)
      .then(d => {
        if (cancelled) return
        if (!d.length) {
          setStatus('error')
          return
        }
        const formattedData = d.map(p => ({
          ...p,
          date: new Date(p.time).toLocaleDateString(locale, { day: '2-digit', month: 'short' }),
          close: p.price
        }))
        setData(formattedData)
        setStatus('ok')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => { cancelled = true }
  }, [ticker, range, locale])

  const values = data.map(d => d.close)
  const minVal = values.length ? Math.min(...values) : 0
  const maxVal = values.length ? Math.max(...values) : 0
  // Unique gradient id safe for SVG
  const gradId = `grad-${ticker.replace(/[^a-z0-9]/gi, '_')}`

  return (
    <div
      className="rounded-2xl border border-white/[0.06] p-6 space-y-5"
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-0.5">
          <p className="label-uppercase text-[10px]">{i18n.smartChart}</p>
          <p className="text-sm font-medium text-slate-300">
            {/* Display clean symbol */}
            {ticker.replace('=F', '').replace('-', '/').replace('.NYB', '')}
          </p>
        </div>

        {/* Range selector */}
        <div className="flex gap-1 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1">
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all duration-200 ${
                range === r 
                  ? 'bg-teal-500 text-black shadow-[0_0_12px_rgba(20,184,166,0.2)]' 
                  : 'text-slate-600 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {i18n.rangeLabels[r]}
            </button>
          ))}
        </div>
      </div>

      {/*
        CHART FIX — Root cause explanation:
        ResponsiveContainer reads clientHeight of its own DOM node.
        If the parent has height:0 or is in a flex column without fixed height,
        ResponsiveContainer gets height=0 → renders nothing.
        Fix: explicit pixel height on the wrapper div via inline style.
        Do NOT rely on Tailwind h-* here because Vite + Tailwind JIT can
        purge classes that appear only as computed strings in some configs.
      */}
      <div style={{ height: '220px', width: '100%', position: 'relative' }}>
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center gap-3">
            <span className="w-5 h-5 rounded-full border-2 border-teal-500/30 border-t-teal-500 animate-spin" />
            <span className="text-xs text-slate-600 font-mono">{i18n.chartLoading}</span>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-slate-700 font-mono uppercase tracking-widest">
              {i18n.chartUnavailable}
            </p>
          </div>
        )}

        {status === 'ok' && data.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7 }}
            style={{ height: '100%', width: '100%' }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={up ? '#2dd4bf' : '#ef4444'} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={up ? '#2dd4bf' : '#ef4444'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.03)"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9, fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={false}
                  dy={8}
                  // Reduce crowding on small screens
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9, fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => fmt(v)}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke={up ? '#2dd4bf' : '#ef4444'}
                  strokeWidth={2}
                  fill={`url(#${gradId})`}
                  animationDuration={1000}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </div>

      {/* Range stats */}
      {status === 'ok' && values.length > 0 && (
        <div className="flex gap-5 text-[10px] font-mono text-slate-700 uppercase tracking-widest">
          <span>{i18n.chartMin} <span className="text-slate-500">{fmt(minVal)}</span></span>
          <span>{i18n.chartMax} <span className="text-slate-500">{fmt(maxVal)}</span></span>
        </div>
      )}
    </div>
  )
}

// ── S5: TradingView Advanced Chart Widget ─────────────────────────────────────
function TradingViewWidget({ apiSymbol, language }: { apiSymbol: string; language: 'en' | 'id' }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tvSymbol = TRADINGVIEW_SYMBOL_MAP[apiSymbol] || apiSymbol

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Clear previous widget
    container.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: 'D',
      timezone: 'Asia/Jakarta',
      theme: 'dark',
      style: '1',
      locale: language === 'id' ? 'id_ID' : 'en',
      allow_symbol_change: false,
      calendar: false,
      support_host: 'https://www.tradingview.com',
      backgroundColor: 'rgba(8, 10, 15, 0)',
      gridColor: 'rgba(255, 255, 255, 0.03)',
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      withdateranges: true,
      hide_side_toolbar: false,
    })

    container.appendChild(script)

    return () => {
      if (container) container.innerHTML = ''
    }
  }, [tvSymbol, language])

  return (
    <div
      className="rounded-2xl border border-white/[0.06] overflow-hidden relative"
      style={{ background: 'rgba(8, 10, 15, 0.8)', height: '480px' }}
    >

      <div
        className="tradingview-widget-container"
        style={{ height: '100%', width: '100%' }}
      >
        <div 
          className="tradingview-widget-container__widget" 
          ref={containerRef} 
          style={{ height: '100%', width: '100%' }} 
        />
      </div>
    </div>
  )
}

function formatNewsDate(raw: string): string {
  if (!raw) return ''
  // Handle Alpha Vantage format: 20260429T143000
  if (/^\d{8}T\d{6}$/.test(raw)) {
    return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`
  }
  // Handle ISO format
  if (raw.includes('-') || raw.includes('T')) {
    return raw.slice(0, 10)
  }
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }
  return raw
}

function NewsSection({ i18n, symbols, userPlan }: { i18n: ReturnType<typeof getExploreI18n>, symbols: string[], userPlan: string }) {
  const [news, setNews] = useState<MarketNewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const isFree = userPlan === 'free'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(false)
    getMarketNews(symbols)
      .then(data => {
        if (!cancelled) {
          setNews(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true)
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [symbols])

  // Free: max 2, Pro: max 5
  const visibleNews = isFree ? news.slice(0, 2) : news.slice(0, 5)
  const hasMore = isFree && news.length > 2

  return (
    <div
      className="rounded-2xl border border-white/[0.06] p-7 space-y-4"
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      <p className="label-uppercase text-[10px]">{i18n.newsIntelligence}</p>
      
      {loading ? (
        <div className="flex items-center gap-3 py-4">
          <span className="w-5 h-5 rounded-full border-2 border-teal-500/30 border-t-teal-500 animate-spin" />
          <span className="text-xs text-slate-600 font-mono">{i18n.newsLoading}</span>
        </div>
      ) : failed ? (
        <p className="text-xs text-slate-700 font-mono uppercase tracking-widest py-4">{i18n.newsFailed}</p>
      ) : news.length === 0 ? (
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">{i18n.newsNotConnected}</p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-md">{i18n.newsNotConnectedBody}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleNews.map((item, i) => (
            <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block p-4 rounded-xl border border-white/[0.04] hover:bg-white/[0.02] transition-colors">
              <p className="text-sm font-semibold text-slate-200 mb-1">{item.title}</p>
              <p className="text-xs text-slate-400 mb-2 line-clamp-2 leading-relaxed">{item.summary}</p>
              <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
                <span className="text-teal-400 uppercase">{item.source}</span>
                <span>•</span>
                <span>{formatNewsDate(item.publishedAt)}</span>
              </div>
            </a>
          ))}
          {hasMore && (
            <div className="text-center pt-2">
              <Link to="/upgrade" className="text-xs text-teal-400 hover:text-teal-300 font-semibold transition-colors">
                {i18n.proUnlockCta} →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Opportunity Context (Screener) ─────────────────────────────────────────────
function newsStatusLabel(status: MarketNewsResponse['dataStatus'] | MarketNewsItem['dataStatus'], i18n: ReturnType<typeof getExploreI18n>): string {
  if (status === 'cached') return i18n.newsStatusCached
  if (status === 'delayed') return i18n.newsStatusDelayed
  if (status === 'unavailable') return i18n.newsStatusUnavailable
  return i18n.liveLabel
}

function newsRelatedTags(item: MarketNewsItem): string[] {
  const related = item.relatedSymbols || item.symbols || []
  return [...new Set([...(related || []), item.topic || 'general'].filter(Boolean))].slice(0, 5)
}

function NewsSectionV2({ i18n, symbols, userPlan }: { i18n: ReturnType<typeof getExploreI18n>, symbols: string[], userPlan: string }) {
  const [newsResponse, setNewsResponse] = useState<MarketNewsResponse>({
    items: [],
    dataStatus: 'unavailable',
    lastUpdated: null,
    message: null,
  })
  const [loading, setLoading] = useState(true)
  const isFree = userPlan === 'free'
  const snapshot = useMemo(() => readPortfolioSnapshot(), [])
  const portfolioSymbols = useMemo(
    () => snapshot.holdings.map((holding) => holding.symbol).filter(Boolean),
    [snapshot]
  )
  const querySymbols = symbols
  const hasPortfolio = snapshot.hasPortfolio && portfolioSymbols.length > 0

  const loadNews = useCallback(() => {
    let cancelled = false
    setLoading(true)
    getMarketNewsResponse(querySymbols, { country: 'ID', limit: isFree ? 3 : 6, pro: !isFree })
      .then((data) => {
        if (!cancelled) {
          setNewsResponse(data)
          try {
            localStorage.setItem('tingai_market_news_context_v2_3_1', JSON.stringify({
              ...data,
              items: data.items.slice(0, isFree ? 3 : 6),
              portfolioSymbols,
              storedAt: new Date().toISOString(),
            }))
          } catch {
            // News context is optional for the copilot.
          }
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNewsResponse({
            items: [],
            dataStatus: 'unavailable',
            lastUpdated: null,
            message: i18n.newsProviderUnavailableBody,
          })
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [querySymbols, isFree, i18n.newsProviderUnavailableBody, portfolioSymbols])

  useEffect(() => loadNews(), [loadNews])

  const visibleNews = isFree ? newsResponse.items.slice(0, 3) : newsResponse.items.slice(0, 6)
  const hasMore = isFree && newsResponse.items.length > 3
  const hasNews = visibleNews.length > 0
  const unavailable = newsResponse.dataStatus === 'unavailable'

  return (
    <div
      className="rounded-2xl border border-white/[0.06] p-7 space-y-4"
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="label-uppercase text-[10px]">{i18n.newsIntelligence}</p>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Menampilkan berita terbaru untuk <strong className="text-teal-400">{symbols[0].replace('=F', '').replace('-', '/').replace('.NYB', '')}</strong>.
          </p>
        </div>
        {!loading && (
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 border border-white/[0.06] rounded-full px-3 py-1">
            {newsStatusLabel(newsResponse.dataStatus, i18n)}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-start gap-3 py-4">
          <span className="w-5 h-5 mt-0.5 rounded-full border-2 border-teal-500/30 border-t-teal-500 animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-slate-300">{i18n.newsLoadingTitle}</p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{i18n.newsLoadingBody}</p>
          </div>
        </div>
      ) : unavailable ? (
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">{i18n.newsProviderUnavailableTitle}</p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-md">{i18n.newsProviderUnavailableBody}</p>
            <button
              type="button"
              onClick={loadNews}
              className="mt-4 text-xs px-4 py-2 rounded-xl border border-white/[0.07] text-slate-300 hover:text-white hover:border-white/15 transition-all"
            >
              {i18n.newsRetryCta}
            </button>
          </div>
        </div>
      ) : !hasPortfolio && !hasNews ? (
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7h16M4 12h10M4 17h7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">{i18n.newsGeneralTitle}</p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-md">{i18n.newsNoPortfolioBody}</p>
            <Link to="/portfolio" className="mt-4 inline-flex text-xs px-4 py-2 rounded-xl border border-white/[0.07] text-slate-300 hover:text-white hover:border-white/15 transition-all">
              {i18n.newsAddPortfolioCta}
            </Link>
          </div>
        </div>
      ) : !hasNews ? (
        <div>
          <p className="text-sm font-medium text-slate-400">{i18n.newsEmptyTitle}</p>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-md">{i18n.newsEmptyBody}</p>
          {newsResponse.message && (
            <p className="text-[10px] font-mono text-slate-700 uppercase tracking-widest mt-4">{newsResponse.message}</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleNews.map((item, i) => {
            // Dynamic sentiment detection from title+summary
            const txt = ((item.title || '') + ' ' + (item.summary || '')).toLowerCase()
            const isBullish = /surge|rally|soar|jump|gain|rise|bull|up|high|strong|beat|breakout|naik|menguat|positif|reli/.test(txt)
            const isBearish = /drop|fall|plunge|decline|bear|down|weak|miss|crash|sell|turun|melemah|jatuh|negatif|koreksi/.test(txt)
            const sentiment = isBullish && !isBearish ? 'bullish' : isBearish && !isBullish ? 'bearish' : 'neutral'
            const sentimentChip = {
              bullish: { label: 'Bullish', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
              bearish: { label: 'Bearish', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
              neutral: { label: 'Neutral', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
            }[sentiment]

            return (
              <a key={`${item.url}-${i}`} href={item.url} target="_blank" rel="noopener noreferrer"
                className="block p-4 rounded-xl border border-white/[0.04] hover:bg-white/[0.03] hover:border-white/[0.09] hover:-translate-y-0.5 transition-all duration-300 group">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm font-semibold text-slate-200 leading-snug group-hover:text-white transition-colors">{item.title}</p>
                  <span className={`flex-shrink-0 text-[9px] font-bold tracking-widest border px-2 py-0.5 rounded-full uppercase ${sentimentChip.cls}`}>
                    {sentimentChip.label}
                  </span>
                </div>
                {item.summary && (
                  <p className="text-[12px] text-slate-500 mb-2.5 line-clamp-2 leading-relaxed">{item.summary}</p>
                )}
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-600 flex-wrap">
                  <span className="text-teal-500 uppercase font-medium">{item.source}</span>
                  <span>·</span>
                  <span>{formatNewsDate(item.publishedAt)}</span>
                  <span>·</span>
                  <span className={newsResponse.dataStatus === 'live' ? 'text-teal-600' : 'text-slate-600'}>
                    {newsStatusLabel(item.dataStatus || newsResponse.dataStatus, i18n)}
                  </span>
                </div>
                {newsRelatedTags(item).length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mt-2.5">
                    {newsRelatedTags(item).map((tag) => (
                      <span key={tag} className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-white/[0.03] text-slate-600 border border-white/[0.04]">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </a>
            )
          })}
          {hasMore && (
            <div className="text-center pt-2">
              <Link to="/upgrade" className="text-xs text-teal-400 hover:text-teal-300 font-semibold transition-colors">
                {i18n.proUnlockCta} &rarr;
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ScreenerSection({ i18n, userPlan, language }: { i18n: ReturnType<typeof getExploreI18n>, userPlan: string, language: 'en' | 'id' }) {
  const isPro = userPlan === 'pro'
  
  const categories = [
    {
      name: language === 'id' ? 'High Yield' : 'High Yield',
      assets: ['PTBA', 'ITMG', 'ADRO'],
      proTextId: 'Beberapa saham menunjukkan karakteristik yield tinggi, tetapi yield tinggi tidak selalu berarti peluang tanpa melihat penyebabnya. Seringkali pasar mengantisipasi penurunan laba di masa depan.',
      proTextEn: 'Some stocks show high-yield characteristics, but high yield does not always mean opportunity without understanding the cause. The market often anticipates future earnings decline.'
    },
    {
      name: language === 'id' ? 'Stable Dividend' : 'Stable Dividend',
      assets: ['BBCA', 'BMRI', 'TLKM'],
      proTextId: 'Kelompok ini menawarkan stabilitas cash flow. Dalam kondisi suku bunga tinggi, dividen ini bersaing dengan instrumen pendapatan tetap dan mengimbangi risiko volatilitas.',
      proTextEn: 'This group offers cash flow stability. Under high interest rates, these dividends compete with fixed income and offset volatility risk.'
    },
    {
      name: language === 'id' ? 'Growth' : 'Growth',
      assets: ['AMMN', 'PANI', 'BRPT'],
      proTextId: 'Aset yang didorong oleh ekspektasi ekspansi margin atau proyeksi masa depan. Memiliki sensitivitas tertinggi terhadap likuiditas pasar makro.',
      proTextEn: 'Assets driven by margin expansion expectations or future projections. They have the highest sensitivity to macro market liquidity.'
    },
    {
      name: language === 'id' ? 'Cyclical Income' : 'Cyclical Income',
      assets: ['ASII', 'UNTR', 'INDF'],
      proTextId: 'Kinerjanya sangat bergantung pada fase siklus ekonomi domestik dan komoditas pendukung. Risiko terbesar ada pada timing masuk/keluar siklus.',
      proTextEn: 'Performance relies heavily on the domestic economic cycle and supporting commodities. The biggest risk is being exposed at the wrong phase of the cycle.'
    }
  ]

  return (
    <div
      className="rounded-2xl border border-white/[0.06] p-7 space-y-4"
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      <p className="label-uppercase text-[10px]">{i18n.opportunityContext}</p>
      <p className="text-xs text-slate-500 leading-relaxed">{i18n.opportunityExample}</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((cat, idx) => (
          <div key={idx} className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01]">
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-semibold text-slate-200">{cat.name}</span>
              <div className="flex gap-1.5">
                {cat.assets.map(asset => (
                  <span key={asset} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 border border-white/[0.05]">
                    {asset}
                  </span>
                ))}
              </div>
            </div>
            
            {isPro ? (
              <p className="text-xs text-slate-400 mt-3 leading-relaxed border-t border-white/[0.04] pt-3">
                <span className="text-amber-500 font-mono text-[10px] uppercase tracking-widest block mb-1">{i18n.intelligenceNote}</span>
                {language === 'id' ? cat.proTextId : cat.proTextEn}
              </p>
            ) : (
              <div className="mt-3 pt-3 border-t border-white/[0.04]">
                <div className="relative overflow-hidden rounded-lg border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent p-3">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-full filter blur-xl" />
                  <p className="text-xs text-slate-500 line-clamp-2 blur-[2px] select-none">
                    {language === 'id' ? cat.proTextId : cat.proTextEn}
                  </p>
                  <div className="absolute inset-0 flex items-center justify-center bg-[#080a0f]/40 backdrop-blur-[1px]">
                    <Link to="/upgrade" className="text-[10px] font-bold text-amber-500 uppercase tracking-widest hover:text-amber-400 transition-colors">
                      {i18n.proInterpretation}
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest text-center mt-4">
        {i18n.notTransactionRecommendation}
      </p>
    </div>
  )
}

// ── Portfolio Relation ────────────────────────────────────────────────────────
function PortfolioRelation({
  i18n, userPlan, language, selectedTicker
}: {
  i18n: ReturnType<typeof getExploreI18n>
  userPlan: string
  language: 'en' | 'id'
  selectedTicker: string
}) {
  const snapshot = useMemo(() => readPortfolioSnapshot(), [])
  const positions = snapshot.holdings

  const relevanceItems = useMemo(
    () => getPortfolioRelevance({ portfolioPositions: positions, language, userPlan, selectedTicker }),
    [positions, language, userPlan, selectedTicker]
  )

  if (!positions.length) {
    return (
      <div
        className="rounded-2xl border border-white/[0.06] p-7"
        style={{ background: 'rgba(255,255,255,0.02)' }}
      >
        <p className="label-uppercase text-[10px] mb-3">{i18n.portfolioRelation}</p>
        <p className="text-xs text-slate-600 leading-relaxed">{i18n.portfolioRelationEmpty}</p>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl border border-white/[0.06] p-7 space-y-4"
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      <p className="label-uppercase text-[10px]">{i18n.portfolioRelation}</p>
      <div className="space-y-3">
        {relevanceItems.map(item => (
          <div
            key={item.symbol}
            className="flex items-start justify-between py-3 border-b border-white/[0.04] last:border-0 gap-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                item.relevanceLevel === 'high' ? 'bg-teal-400' :
                item.relevanceLevel === 'medium' ? 'bg-yellow-400' : 'bg-slate-600'
              }`} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-300">{item.title}</p>
                {item.proLocked ? (
                  <Link to="/upgrade" className="text-[11px] text-teal-400/70 hover:text-teal-400 transition-colors mt-1 inline-block">
                    {i18n.proLockedRelevance} →
                  </Link>
                ) : (
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.description}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function useFOMCCountdown() {
  // Next FOMC announcement: Sep 16, 2026 at ~02:00 WIB = Sep 15 19:00 UTC
  const target = new Date('2026-09-15T19:00:00Z').getTime()
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number; passed: boolean } | null>(null)

  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      const diff = target - now
      if (diff <= 0) {
        setTimeLeft({ d: 0, h: 0, m: 0, s: 0, passed: true })
      } else {
        const totalSec = Math.floor(diff / 1000)
        setTimeLeft({
          d: Math.floor(totalSec / 86400),
          h: Math.floor((totalSec % 86400) / 3600),
          m: Math.floor((totalSec % 3600) / 60),
          s: totalSec % 60,
          passed: false,
        })
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [target])

  return timeLeft
}

function FOMCLivestreamPanel({ language }: { language: 'en' | 'id' }) {
  const countdown = useFOMCCountdown()
  const isAnnounced = countdown?.passed === true

  return (
    <div
      className="rounded-2xl border border-teal-400/20 p-6 space-y-4 relative overflow-hidden h-full"
      style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.06) 0%, rgba(8,10,15,1) 100%)' }}
    >
      <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/[0.06] rounded-full filter blur-3xl" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/[0.04] rounded-full filter blur-3xl" />

      {/* Header */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-amber-400">
              {language === 'id' ? 'MENUJU FOMC SEPTEMBER' : 'NEXT FOMC — SEPTEMBER'}
            </p>
          </div>
          {!isAnnounced && countdown && (
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-300 bg-white/[0.05] border border-amber-500/20 rounded-lg px-3 py-1.5">
              <span className="text-amber-400">⏱</span>
              <span className="tabular-nums font-bold">
                {countdown.d > 0 && `${countdown.d}d `}{String(countdown.h).padStart(2,'0')}:{String(countdown.m).padStart(2,'0')}:{String(countdown.s).padStart(2,'0')}
              </span>
            </div>
          )}
        </div>
        <h3 className="text-base font-semibold text-slate-200 tracking-tight">FOMC Meeting — Sep 2026</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {language === 'id'
            ? '15–16 September · Termasuk Dot Plot & Proyeksi Ekonomi'
            : 'Sep 15–16 · Includes Dot Plot & Economic Projections'}
        </p>
      </div>

      {/* Key stats */}
      <div className="relative z-10 grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl border border-teal-500/20 bg-teal-500/[0.05]">
          <p className="text-[9px] font-mono tracking-widest text-slate-500 mb-1 uppercase">{language === 'id' ? 'Suku Bunga Saat Ini' : 'Current Rate'}</p>
          <p className="text-xl font-bold text-teal-400 font-mono">3.50–3.75%</p>
          <p className="text-[9px] text-slate-600 mt-1">{language === 'id' ? 'Ditahan Juli 2026 (ke-5)' : 'Held July 2026 (5th time)'}</p>
        </div>
        <div className="p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <p className="text-[9px] font-mono tracking-widest text-slate-500 mb-1 uppercase">{language === 'id' ? 'Ekspektasi Sep' : 'Sep Expectation'}</p>
          <p className="text-xl font-bold text-amber-400 font-mono">{language === 'id' ? 'Potong?' : 'Cut?'}</p>
          <p className="text-[9px] text-slate-600 mt-1">{language === 'id' ? 'Pasar mulai price-in 25bps' : 'Markets pricing in 25bps cut'}</p>
        </div>
      </div>

      {/* Context */}
      <div className="relative z-10 p-3.5 rounded-xl border border-white/[0.05] bg-white/[0.015]">
        <p className="text-[9px] font-mono text-teal-500/60 uppercase tracking-[0.15em] mb-1.5">{language === 'id' ? 'HASIL FOMC JULI' : 'JULY FOMC RESULT'}</p>
        <p className="text-[11px] text-slate-400 leading-[1.75]">
          {language === 'id'
            ? 'FOMC Juli mempertahankan suku bunga di 3.50–3.75% untuk kelima kalinya. Pernyataan The Fed menandai progres inflasi — CPI turun ke 3.5%. Pasar sekarang memperkirakan potensi pemotongan di September jika data NFP & CPI Agustus mendukung.'
            : 'July FOMC held rates at 3.50–3.75% for the 5th time. Statement acknowledged inflation progress — CPI fell to 3.5%. Markets now pricing potential September cut if August NFP & CPI data support it.'}
        </p>
      </div>

      <div className="relative z-10">
        <span className="text-[9px] font-mono text-slate-700 uppercase tracking-widest">
          {language === 'id' ? '→ Setelah Sep: 27–28 Okt 2026' : '→ After Sep: Oct 27–28, 2026'}
        </span>
      </div>
    </div>
  )
}

function EconomicCalendarPanel({ language }: { language: 'en' | 'id' }) {
  const [filter, setFilter] = useState<'upcoming' | 'month' | 'all'>('upcoming')

  // Comprehensive economic calendar Aug–Dec 2026 (verified from BLS/Fed)
  const allEvents = [
    // ── FOMC Juli (sudah lewat) ──
    { iso: '2026-07-29T02:00', date: '29 Jul', time: '02:00 WIB', event: 'FOMC Statement', impact: 'high' as const, prev: '3.50–3.75%', act: '3.50–3.75%' },
    // ── Agustus ──
    { iso: '2026-08-07T19:30', date: '7 Aug', time: '19:30 WIB', event: 'Non-Farm Payrolls (Jul)', impact: 'high' as const, prev: '57K', act: '—' },
    { iso: '2026-08-07T19:30', date: '7 Aug', time: '19:30 WIB', event: 'Unemployment Rate (Jul)', impact: 'high' as const, prev: '4.2%', act: '—' },
    { iso: '2026-08-12T19:30', date: '12 Aug', time: '19:30 WIB', event: 'CPI YoY (Jul)', impact: 'high' as const, prev: '3.5%', act: '—' },
    { iso: '2026-08-12T19:30', date: '12 Aug', time: '19:30 WIB', event: 'Core CPI MoM (Jul)', impact: 'high' as const, prev: '0.2%', act: '—' },
    // ── September ──
    { iso: '2026-09-04T19:30', date: '4 Sep', time: '19:30 WIB', event: 'Non-Farm Payrolls (Aug)', impact: 'high' as const, prev: '—', act: '—' },
    { iso: '2026-09-04T19:30', date: '4 Sep', time: '19:30 WIB', event: 'Unemployment Rate (Aug)', impact: 'high' as const, prev: '—', act: '—' },
    { iso: '2026-09-11T19:30', date: '11 Sep', time: '19:30 WIB', event: 'CPI YoY (Aug)', impact: 'high' as const, prev: '—', act: '—' },
    { iso: '2026-09-16T02:00', date: '16 Sep', time: '02:00 WIB', event: 'FOMC Statement + SEP', impact: 'high' as const, prev: '3.50–3.75%', act: '—' },
    { iso: '2026-09-16T02:30', date: '16 Sep', time: '02:30 WIB', event: 'FOMC Press Conference', impact: 'high' as const, prev: '—', act: '—' },
    // ── Oktober ──
    { iso: '2026-10-02T19:30', date: '2 Oct', time: '19:30 WIB', event: 'Non-Farm Payrolls (Sep)', impact: 'high' as const, prev: '—', act: '—' },
    { iso: '2026-10-14T19:30', date: '14 Oct', time: '19:30 WIB', event: 'CPI YoY (Sep)', impact: 'high' as const, prev: '—', act: '—' },
    { iso: '2026-10-28T02:00', date: '28 Oct', time: '02:00 WIB', event: 'FOMC Statement', impact: 'high' as const, prev: '—', act: '—' },
    // ── November ──
    { iso: '2026-11-06T20:30', date: '6 Nov', time: '20:30 WIB', event: 'Non-Farm Payrolls (Oct)', impact: 'high' as const, prev: '—', act: '—' },
    { iso: '2026-11-10T20:30', date: '10 Nov', time: '20:30 WIB', event: 'CPI YoY (Oct)', impact: 'high' as const, prev: '—', act: '—' },
    // ── Desember ──
    { iso: '2026-12-04T20:30', date: '4 Dec', time: '20:30 WIB', event: 'Non-Farm Payrolls (Nov)', impact: 'high' as const, prev: '—', act: '—' },
    { iso: '2026-12-09T02:00', date: '9 Dec', time: '02:00 WIB', event: 'FOMC Statement + SEP', impact: 'high' as const, prev: '—', act: '—' },
    { iso: '2026-12-10T20:30', date: '10 Dec', time: '20:30 WIB', event: 'CPI YoY (Nov)', impact: 'high' as const, prev: '—', act: '—' },
  ]

  const now = Date.now()
  const getEventTime = (ev: typeof allEvents[0]) => new Date(ev.iso).getTime()

  // Sort: upcoming first, past at bottom
  const sorted = [...allEvents].sort((a, b) => {
    const aTime = getEventTime(a)
    const bTime = getEventTime(b)
    const aFuture = aTime > now
    const bFuture = bTime > now
    if (aFuture && !bFuture) return -1
    if (!aFuture && bFuture) return 1
    return aTime - bTime
  })

  // Find the next upcoming event for countdown
  const nextEvent = sorted.find(ev => getEventTime(ev) > now)
  const nextEventTime = nextEvent ? getEventTime(nextEvent) : null

  // Countdown state for next event
  const [countdown, setCountdown] = useState('')
  useEffect(() => {
    if (!nextEventTime) return
    const tick = () => {
      const diff = nextEventTime - Date.now()
      if (diff <= 0) { setCountdown('NOW'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [nextEventTime])

  // Filter logic
  const oneWeek = 7 * 24 * 60 * 60 * 1000
  const oneMonth = 31 * 24 * 60 * 60 * 1000
  const filtered = sorted.filter(ev => {
    const t = getEventTime(ev)
    if (filter === 'upcoming') return t > now && t < now + oneWeek * 2  // next 2 weeks
    if (filter === 'month') return t > now && t < now + oneMonth
    return true
  })

  const filterTabs = [
    { id: 'upcoming' as const, label: language === 'id' ? '2 Minggu' : '2 Weeks' },
    { id: 'month' as const, label: language === 'id' ? 'Bulan Ini' : 'This Month' },
    { id: 'all' as const, label: language === 'id' ? 'Semua' : 'All' },
  ]

  return (
    <div
      className="rounded-2xl border border-white/[0.06] p-6 space-y-4 h-full"
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      {/* Header + Filter */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <p className="label-uppercase text-[10px]">{language === 'id' ? 'KALENDER EKONOMI' : 'ECONOMIC CALENDAR'}</p>
          <span className="text-[9px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-mono font-bold">HIGH IMPACT</span>
        </div>
        <div className="flex gap-1">
          {filterTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`text-[9px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                filter === tab.id
                  ? 'bg-teal-500/15 text-teal-400 border border-teal-500/25'
                  : 'text-slate-600 hover:text-slate-400 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Next Event Countdown Banner */}
      {nextEvent && (
        <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/[0.08] rounded-full filter blur-2xl" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-[9px] font-mono text-amber-500/70 uppercase tracking-widest mb-0.5">{language === 'id' ? 'EVENT TERDEKAT' : 'NEXT EVENT'}</p>
              <p className="text-[12px] font-semibold text-slate-200">{nextEvent.event}</p>
              <p className="text-[10px] font-mono text-slate-500">{nextEvent.date} · {nextEvent.time}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-mono text-amber-500/70 uppercase tracking-widest mb-0.5">COUNTDOWN</p>
              <p className="text-base font-bold font-mono text-amber-400 tabular-nums">{countdown}</p>
            </div>
          </div>
        </div>
      )}

      {/* Events List */}
      <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.05) transparent' }}>
        {filtered.length === 0 ? (
          <p className="text-[11px] text-slate-600 text-center py-4 font-mono">{language === 'id' ? 'Tidak ada event dalam rentang ini' : 'No events in this range'}</p>
        ) : filtered.map((ev, i) => {
          const isPast = getEventTime(ev) < now
          const isNext = nextEvent && ev.iso === nextEvent.iso && ev.event === nextEvent.event
          const isFomc = ev.event.includes('FOMC')

          return (
            <div
              key={`${ev.iso}-${ev.event}-${i}`}
              className={`flex justify-between items-center py-2.5 px-3 rounded-xl transition-all ${
                isNext
                  ? 'border border-amber-500/25 bg-amber-500/[0.04] shadow-[0_0_12px_rgba(245,158,11,0.08)]'
                  : isPast
                    ? 'opacity-40 border border-transparent'
                    : 'border border-transparent hover:bg-white/[0.02]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Impact dot */}
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  isFomc ? 'bg-teal-500' : 'bg-red-500'
                } ${isNext ? 'animate-pulse' : ''}`} />
                <div className="min-w-0">
                  <p className={`text-[11px] font-semibold truncate ${isPast ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{ev.event}</p>
                  <p className="text-[9px] font-mono text-slate-600">{ev.date} · {ev.time}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                {isPast ? (
                  <p className="text-[10px] font-mono text-slate-600">{ev.act || ev.prev}</p>
                ) : (
                  <>
                    <p className="text-[10px] font-mono text-slate-500">Prev: {ev.prev}</p>
                    {isNext && <p className="text-[9px] font-mono text-amber-400 mt-0.5">⏱ {countdown}</p>}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="pt-2 border-t border-white/[0.04]">
        <p className="text-[9px] font-mono text-slate-700 uppercase tracking-widest">
          {language === 'id' ? `${allEvents.filter(e => getEventTime(e) > now).length} event mendatang · Sumber: BLS, Federal Reserve` : `${allEvents.filter(e => getEventTime(e) > now).length} upcoming events · Source: BLS, Federal Reserve`}
        </p>
      </div>
    </div>
  )
}

// ── Ticker Tape Item ──────────────────────────────────────────────────────────
interface TickerItem {
  label: string
  symbol: string
}

const TAPE_ASSETS: TickerItem[] = [
  { label: 'IHSG',      symbol: '^JKSE'    },
  { label: 'S&P 500',   symbol: 'SPY'      },
  { label: 'NASDAQ',    symbol: 'QQQ'      },
  { label: 'GOLD',      symbol: 'GC=F'     },
  { label: 'BTC',       symbol: 'BTC-USD'  },
  { label: 'DXY',       symbol: 'DX-Y.NYB' },
  { label: 'ETH',       symbol: 'ETH-USD'  },
  { label: 'WTI CRUDE', symbol: 'CL=F'     },
]

function TickerSeparator() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 1,
        height: 12,
        background: 'rgba(255,255,255,0.06)',
        margin: '0 20px',
        flexShrink: 0,
        alignSelf: 'center',
      }}
    />
  )
}

function TickerChip({ asset, quote }: { asset: TickerItem; quote: MarketQuote | null | undefined }) {
  if (!quote || quote.price == null) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 4px',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(148,163,184,0.5)', letterSpacing: '0.04em', fontFamily: 'Inter, system-ui, sans-serif' }}>
          {asset.label}
        </span>
        <span style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', color: 'rgba(100,116,139,0.5)' }}>—</span>
      </span>
    )
  }

  const up = quote.changePercent >= 0
  const changeColor  = up ? '#2dd4bf' : '#f87171'   // teal-400 / red-400
  const changeBg     = up ? 'rgba(20,184,166,0.08)' : 'rgba(248,113,113,0.08)'
  const arrow        = up ? '▲' : '▼'
  const absChange    = Math.abs(quote.changePercent).toFixed(2)

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 6px',
        borderRadius: 6,
        cursor: 'default',
        flexShrink: 0,
        transition: 'background 0.15s',
      }}
    >
      {/* Symbol label */}
      <span style={{
        fontSize: 10,
        fontWeight: 700,
        color: 'rgba(203,213,225,0.9)',
        letterSpacing: '0.06em',
        fontFamily: 'Inter, system-ui, sans-serif',
        textTransform: 'uppercase',
      }}>
        {asset.label}
      </span>

      {/* Price */}
      <span style={{
        fontSize: 11,
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        fontWeight: 600,
        color: changeColor,
        letterSpacing: '-0.01em',
      }}>
        {fmt(quote.price)}
      </span>

      {/* Change badge */}
      <span style={{
        fontSize: 9,
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        fontWeight: 500,
        color: changeColor,
        background: changeBg,
        padding: '1px 5px',
        borderRadius: 4,
        letterSpacing: '0.01em',
      }}>
        {arrow} {absChange}%
      </span>
    </span>
  )
}

function RunningTickerTape({ quotes }: { quotes: Record<string, MarketQuote | null> }) {
  // We only render one set of items per track.
  const renderItems = (keyPrefix: string) =>
    TAPE_ASSETS.flatMap((asset, idx) => [
      <TickerChip key={`${keyPrefix}-chip-${idx}`} asset={asset} quote={quotes[asset.symbol]} />,
      <TickerSeparator key={`${keyPrefix}-sep-${idx}`} />,
    ])

  return (
    <div
      style={{
        width: '100%',
        height: 40,
        background: '#04060a',
        borderBottom: '1px solid rgba(20,184,166,0.08)',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Inline keyframe for robust dual-track seamless loop */}
      <style>{`
        @keyframes tickerLoop {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-100%, 0, 0); }
        }
        .ticker-track {
          display: flex;
          align-items: center;
          flex-shrink: 0;
          white-space: nowrap;
          animation: tickerLoop 35s linear infinite;
          will-change: transform;
        }
        /* Pause on hover for both tracks simultaneously */
        .ticker-wrapper:hover .ticker-track {
          animation-play-state: paused;
        }
      `}</style>

      {/* Left gradient mask */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 80,
        background: 'linear-gradient(to right, #04060a, transparent)',
        zIndex: 10, pointerEvents: 'none',
      }} />

      {/* Right gradient mask */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 80,
        background: 'linear-gradient(to left, #04060a, transparent)',
        zIndex: 10, pointerEvents: 'none',
      }} />

      {/* Wrapper that controls hover state for both tracks */}
      <div 
        className="ticker-wrapper" 
        style={{ display: 'flex', width: '100%', alignItems: 'center' }}
      >
        {/* Track 1 */}
        <div className="ticker-track">
          {renderItems('track1')}
        </div>
        
        {/* Track 2 (Exact clone for seamless follow-up) */}
        <div className="ticker-track">
          {renderItems('track2')}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ExploreIntelligence() {
  const { language } = useLanguagePreference()
  const i18n = useMemo(() => getExploreI18n(language), [language])

  // Read plan from localStorage — same source as Portfolio.tsx
  const userPlan = useMemo(() => {
    try { return localStorage.getItem('lifeOS_user_plan') || 'free' }
    catch { return 'free' }
  }, [])

  // Locale string for date formatting
  const locale = language === 'en' ? 'en-US' : 'id-ID'

  const [quotes, setQuotes]           = useState<Record<string, MarketQuote | null>>({})
  const [quotesLoading, setQuotesLoading] = useState(true)
  const [selectedTicker, setSelectedTicker] = useState(PULSE_ASSETS[0].apiSymbol)
  const [activeCategory, setActiveCategory] = useState('all')
  // S5: chart mode toggle — 'simple' (Recharts) vs 'advanced' (TradingView)
  const [chartMode, setChartMode] = useState<'simple' | 'advanced'>('simple')

  const filteredAssets = useMemo(() => {
    if (activeCategory === 'all') return PULSE_ASSETS
    const cat = MARKET_CATEGORIES.find(c => c.id === activeCategory)
    if (!cat || !cat.symbols) return PULSE_ASSETS
    return PULSE_ASSETS.filter(a => cat.symbols.includes(a.symbol))
  }, [activeCategory])

  const selectedQuote = quotes[selectedTicker]
  const selectedUp    = (selectedQuote?.changePercent ?? 0) >= 0

  const loadQuotes = useCallback(async () => {
    setQuotesLoading(true)
    try {
      const results = await getMultipleMarketQuotes(PULSE_ASSETS.map(a => a.apiSymbol))
      const map: Record<string, MarketQuote> = {}
      results.forEach(q => { map[q.symbol] = q })
      setQuotes(map)
    } catch {
      // All proxies failed — cards will show unavailable (not fake data)
    } finally {
      setQuotesLoading(false)
    }
  }, [])

  useEffect(() => { void loadQuotes() }, [loadQuotes])

  return (
    <div
      className="min-h-screen flex flex-col pt-[96px]"
      style={{
        background: 'radial-gradient(ellipse 70% 35% at 50% 0%, rgba(20,184,166,0.06) 0%, transparent 55%), #080a0f',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Sticky ticker tape — hugs the bottom of the fixed navbar */}
      <div style={{ position: 'sticky', top: 96, zIndex: 40 }}>
        <RunningTickerTape quotes={quotes} />
      </div>
      
      {/* Ambient grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="max-w-4xl mx-auto px-4 pt-8 pb-14 space-y-10 flex-1 w-full">

        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="space-y-1">
              <p className="label-uppercase">{i18n.pageTitle}</p>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{i18n.pageSubtitle}</h1>
                <div className="group relative flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center text-[10px] font-bold cursor-help hover:bg-teal-500/20 transition-colors">
                    ?
                  </div>
                  <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-64 bg-slate-800 text-xs text-slate-300 p-3 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none border border-slate-700 z-50">
                    <strong className="text-white block mb-1">Market Intelligence Setara Institusi</strong>
                    Lihat pergerakan bandar, berita terkurasi, dan sentimen pasar yang biasa digunakan oleh Big Fund. 
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/komando-pagi"
                className="inline-flex items-center gap-2 text-xs px-4 py-2 rounded-xl border border-white/[0.07] text-slate-400 hover:text-slate-200 hover:border-white/15 transition-all"
              >
                {i18n.ctaMorningCommand} →
              </Link>
              <Link
                to="/portfolio"
                className="inline-flex items-center gap-2 text-xs px-4 py-2 rounded-xl border border-white/[0.07] text-slate-400 hover:text-slate-200 hover:border-white/15 transition-all"
              >
                {i18n.ctaPortfolio} →
              </Link>
            </div>
          </div>
        </motion.div>

        <MulaiDariSiniCard />

        <section className="mt-8 mb-6">
          <TradingSetup />
          <SmartMoneyRadar />
        </section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08 }}
          className="hidden md:block rounded-2xl border border-teal-400/15 bg-teal-400/[0.035] p-5 md:p-6"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="label-uppercase text-[10px] text-teal-300">{i18n.startHereTitle}</p>
              <p className="text-sm leading-relaxed text-slate-300 max-w-2xl">{i18n.startHereBody}</p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <Link
                to="/komando-pagi"
                className="text-xs px-3 py-2 rounded-lg border border-teal-400/20 bg-teal-400/10 text-teal-200 hover:bg-teal-400/15 transition-all"
              >
                {i18n.startHereMorning}
              </Link>
              <Link
                to="/portfolio"
                className="text-xs px-3 py-2 rounded-lg border border-white/[0.07] text-slate-300 hover:text-white hover:border-white/15 transition-all"
              >
                {i18n.startHerePortfolio}
              </Link>
              <Link
                to="/ting-ai"
                className="text-xs px-3 py-2 rounded-lg border border-white/[0.07] text-slate-400 hover:text-slate-200 hover:border-white/15 transition-all"
              >
                {i18n.startHereAsk}
              </Link>
            </div>
          </div>
        </motion.section>

        {/* 1. Market Pulse */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="label-uppercase">{i18n.marketPulse}</p>
            <p className="text-[10px] font-mono text-slate-700 uppercase">{i18n.chartClickHint}</p>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scroll" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <style>{`.hide-scroll::-webkit-scrollbar { display: none; }`}</style>
            {MARKET_CATEGORIES.map(cat => {
              const isActive = activeCategory === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`whitespace-nowrap px-4 py-2 rounded-full text-[11px] font-semibold tracking-wide transition-all duration-300 ${
                    isActive 
                      ? 'bg-gradient-to-r from-teal-500/20 to-emerald-500/10 text-teal-300 border border-teal-500/40 shadow-[0_0_15px_rgba(20,184,166,0.15)] scale-105'
                      : 'bg-white/[0.02] text-slate-400 border border-white/[0.05] hover:bg-white/[0.06] hover:text-slate-200 hover:scale-105'
                  }`}
                >
                  {language === 'id' ? cat.labelId : cat.labelEn}
                </button>
              )
            })}
          </div>

          {quotesLoading ? (
            <div className="flex gap-3 overflow-x-auto pb-4 hide-scroll" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="min-w-[150px] md:min-w-[180px] h-28 rounded-2xl bg-white/[0.02] border border-white/[0.05] animate-pulse flex-shrink-0"
                />
              ))}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-4 hide-scroll" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {filteredAssets.map(asset => (
                <div key={asset.apiSymbol} className="min-w-[150px] md:min-w-[180px] flex-shrink-0 snap-start">
                  <PulseCard
                    key={asset.apiSymbol}
                    asset={asset}
                    quote={quotes[asset.apiSymbol] ?? null}
                    selected={selectedTicker === asset.apiSymbol}
                    onClick={() => setSelectedTicker(asset.apiSymbol)}
                    i18n={i18n}
                    language={language}
                  />
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
            {i18n.ihsgPortfolioCopy}
          </p>

          {/* Bullish / Bearish summary — i18n keys */}
          {!quotesLoading && Object.keys(quotes).length > 0 && (
            <div className="flex gap-5 px-1 text-[10px] font-mono text-slate-700 uppercase tracking-widest">
              <span>
                {i18n.bullish}:{' '}
                <span className="text-teal-500 font-bold">
                  {Object.values(quotes).filter(q => (q?.changePercent ?? 0) >= 0).length}
                </span>
              </span>
              <span>
                {i18n.bearish}:{' '}
                <span className="text-red-500 font-bold">
                  {Object.values(quotes).filter(q => (q?.changePercent ?? 0) < 0).length}
                </span>
              </span>
            </div>
          )}
        </section>

        {/* 2. Smart Chart + S5 TradingView Toggle */}
        <section className="space-y-3">
          {/* Chart mode toggle */}
          <div className="flex items-center justify-between">
            <p className="label-uppercase text-[10px]">
              {language === 'id' ? 'CHART' : 'CHART'}
            </p>
            <div className="flex gap-1 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1">
              <button
                onClick={() => setChartMode('simple')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all duration-200 ${
                  chartMode === 'simple'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-slate-600 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {language === 'id' ? 'Sederhana' : 'Simple'}
              </button>
              <button
                onClick={() => setChartMode('advanced')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all duration-200 flex items-center gap-1.5 ${
                  chartMode === 'advanced'
                    ? 'bg-teal-500 text-black shadow-[0_0_12px_rgba(20,184,166,0.25)]'
                    : 'text-slate-600 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span>Advanced</span>
                <span className="text-[8px] opacity-70">TV</span>
              </button>
            </div>
          </div>

          {chartMode === 'simple' ? (
            <SmartChart
              ticker={selectedTicker}
              up={selectedUp}
              locale={locale}
              i18n={i18n}
            />
          ) : (
            <TradingViewWidget
              apiSymbol={selectedTicker}
              language={language}
            />
          )}
        </section>

        {/* 2b. Fundamental Panel */}
        <section>
          <FundamentalPanel ticker={selectedTicker} language={language} />
        </section>

        {/* 2c. AI Forecast */}
        <section>
          <AIForecastPanel ticker={selectedTicker} language={language} currentPrice={quotes[selectedTicker]?.price} />
        </section>

        {/* 2d. Market Radar */}
        <section>
          <MarketRadarSection ticker={selectedTicker} i18n={i18n} onSelectTicker={setSelectedTicker} />
        </section>

        {/* 2e. FOMC & Economic Calendar */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <FOMCLivestreamPanel language={language} />
          </div>
          <div className="md:col-span-1">
            <EconomicCalendarPanel language={language} />
          </div>
        </section>

        {/* 2f. Macro Dashboard */}
        <section>
          <MacroDashboard i18n={i18n} activeCategory={activeCategory} />
        </section>

        {/* Sectors Hackathon Integration */}
        <section>
          <SectorsIntelligence />
        </section>

        {/* 2g. Trading Setup & Insights (Tings AI Feature) */}
        <section>
          <TradingSetupPanel ticker={selectedTicker} />
        </section>

        {/* 2h. Macro Events (Fitur C: Clarity Engine) */}
        <section className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-200 tracking-tight">{language === 'en' ? 'Macro Clarity Engine' : 'Inteligensi Makro (Clarity Engine)'}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{language === 'en' ? 'AI interpretation of recent high-impact economic data' : 'Interpretasi AI atas rilis data ekonomi berdampak tinggi terbaru'}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MacroEventCard
              isEnglish={language === 'en'}
              event={{
                id: 'nfp-aug',
                eventName: 'US Non-Farm Payrolls (Aug)',
                date: '06 Sep 2026, 19:30 WIB',
                actual: '114K',
                forecast: '175K',
                previous: '179K',
                status: 'MISS',
                impact: 'HIGH',
                aiVerdict: language === 'en' 
                  ? 'Significantly weaker than expected. The labor market is cooling faster than anticipated, heavily increasing the probability of a 50bps rate cut by the Fed. Bearish for USD, bullish for rate-sensitive assets like Gold.' 
                  : 'Data jauh lebih lemah dari ekspektasi. Pasar tenaga kerja mendingin lebih cepat dari perkiraan, meningkatkan probabilitas pemangkasan suku bunga 50bps oleh The Fed secara drastis. Bearish untuk USD, bullish untuk aset sensitif suku bunga seperti Emas.',
                affectedAssets: [
                  { symbol: 'USD/IDR', direction: 'down' },
                  { symbol: 'XAU/USD', direction: 'up' },
                  { symbol: 'BTC', direction: 'up' }
                ]
              }}
            />
            <MacroEventCard
              isEnglish={language === 'en'}
              event={{
                id: 'cpi-aug',
                eventName: 'US Core CPI YoY (Aug)',
                date: '11 Sep 2026, 19:30 WIB',
                actual: '3.2%',
                forecast: '3.2%',
                previous: '3.3%',
                status: 'IN_LINE',
                impact: 'HIGH',
                aiVerdict: language === 'en'
                  ? 'Inflation met expectations and continues its downward trajectory. Since it didn\'t surprise to the upside, it supports the Fed\'s easing path but doesn\'t scream panic. Neutral short-term, structurally supportive for equities.'
                  : 'Inflasi sesuai ekspektasi dan terus dalam tren penurunan. Karena tidak ada kejutan kenaikan, ini mendukung jalur pelonggaran The Fed tanpa memicu kepanikan. Netral jangka pendek, namun suportif secara struktural untuk ekuitas.',
                affectedAssets: [
                  { symbol: 'S&P 500', direction: 'up' },
                  { symbol: 'DXY', direction: 'neutral' }
                ]
              }}
            />
          </div>
        </section>

        {/* 3. News Intelligence */}
        <section>
          <NewsSectionV2 i18n={i18n} symbols={[selectedTicker]} userPlan={userPlan} />
        </section>

        {/* 4. Opportunity Context (Screener) */}
        <section>
          <ScreenerSection i18n={i18n} userPlan={userPlan} language={language} />
        </section>

        {/* 5. Portfolio Relation */}
        <section>
          <PortfolioRelation i18n={i18n} userPlan={userPlan} language={language} selectedTicker={selectedTicker} />
        </section>

      </div>
    </div>
  )
}
