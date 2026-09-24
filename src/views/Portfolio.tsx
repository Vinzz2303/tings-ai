import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { fetchStock, type DetailedStockData } from '../lib/stockService'
import AiChat from '../components/AiChat'
import { formatCurrency as formatDisplayCurrency } from '../utils/currency'
import { getPortfolioIntelligence } from '../utils/portfolioIntelligence'
import { generatePortfolioInsight, generateRiskSimulation } from '../utils/portfolioInsightHero'
import { useLanguagePreference } from '../utils/language'
import UpgradeSection from '../components/UpgradeSection'
import { InsightWithTriggers } from '../components/InsightUpgradeTrigger'
import PortfolioActionWatchlist from '../components/PortfolioActionWatchlist'
import RiskBudgetCard from '../components/RiskBudgetCard'
import DecisionJournal from '../components/DecisionJournal'
import { getUsdIdrRate, FX_FALLBACK_RATE } from '../services/marketData'
import type { FxRate } from '../services/marketData'
import { API_URL } from '../utils/api'
import { fetchWithSession, readResponseError } from '../utils/authFetch'
import { useAuthSession } from '../utils/useAuthSession'
import { hasProAccess } from '../utils/entitlements'
import {
  formatAssetCurrency,
  hasUsableUserPortfolioPositions,
  writePortfolioSnapshot,
  type NormalizedPortfolioSnapshot,
} from '../utils/portfolioSnapshot'
import {
  buildPortfolioActionWatchlist,
  formatActionWatchlistForCopilot,
} from '../utils/portfolioActionWatchlist'
import {
  evaluateRiskBudget,
  formatRiskBudgetForCopilot,
  readRiskBudget,
  type RiskBudgetConfig,
} from '../utils/riskBudget'
import { formatDecisionJournalForCopilot, readDecisionJournal } from '../utils/decisionJournal'
import { assetTypeLabel, inferAssetTypeFromInput, normalizeDisplaySymbol } from '../utils/assetNormalization'
import CsvImportModal from '../components/CsvImportModal'



export type V2Position = {
  id: string
  symbol: string        // display symbol: XAU, BBCA.JK, BTC
  name?: string
  marketSymbol?: string // Yahoo Finance API symbol: GC=F, BBCA.JK, BTC-USD
  assetCurrency?: 'IDR' | 'USD' // the currency this asset trades in
  assetType: "stock" | "us_stock" | "commodity" | "crypto" | "indonesian_stock" | "gold" | "cash" | "mutual_fund" | "other"
  region: "ID" | "GLOBAL"
  quantity: number
  entryPrice: number
  entryCurrency: "IDR" | "USD"
  source?: "market_provider" | "internal_cache" | "manual"
  supportStatus?: "live_data" | "data_limited"
  exchange?: string
  provider?: string
  note?: string
  manualValue?: number
  allocationPercent?: number
  createdAt: string
}

type FormState = {
  symbol: string
  assetName: string
  assetType: "stock" | "us_stock" | "commodity" | "crypto" | "indonesian_stock" | "gold" | "cash" | "mutual_fund" | "other"
  region: "ID" | "GLOBAL"
  quantity: string
  entryPrice: string
  entryCurrency: "IDR" | "USD"
  manualValue: string
  allocationPercent: string
  note: string
}

const initialForm: FormState = {
  symbol: '',
  assetName: '',
  assetType: 'stock',
  region: 'ID',
  quantity: '',
  entryPrice: '',
  entryCurrency: 'IDR',
  manualValue: '',
  allocationPercent: '',
  note: ''
}

type AssetResolverCandidate = {
  symbol: string
  name: string
  assetType: 'indonesian_stock' | 'stock' | 'index' | 'crypto' | 'commodity'
  exchange?: string | null
  currency?: 'IDR' | 'USD' | string
  source: 'internal_cache' | 'market_provider'
  supportStatus: 'live_data'
  provider?: string
  providerSymbol?: string
}

type AssetResolveResponse = {
  found?: boolean
  query?: string
  candidates?: AssetResolverCandidate[]
  manualFallback?: boolean
  message?: string
}

const LOCAL_STORAGE_KEY = "tingai_portfolio_positions_v2"

const DEFAULT_POSITIONS: V2Position[] = [
  { id: 'pos-init-1', symbol: 'XAU', marketSymbol: 'GC=F', assetCurrency: 'USD', assetType: 'commodity', region: 'GLOBAL', quantity: 2.5, entryPrice: 38234399, entryCurrency: 'IDR', createdAt: new Date().toISOString() },
  { id: 'pos-init-2', symbol: 'BTC', marketSymbol: 'BTC-USD', assetCurrency: 'USD', assetType: 'crypto', region: 'GLOBAL', quantity: 0.08, entryPrice: 96500, entryCurrency: 'USD', createdAt: new Date().toISOString() },
  { id: 'pos-init-3', symbol: 'BBCA.JK', assetCurrency: 'IDR', assetType: 'stock', region: 'ID', quantity: 5000, entryPrice: 8500, entryCurrency: 'IDR', createdAt: new Date().toISOString() },
  { id: 'pos-init-4', symbol: 'BMRI.JK', assetCurrency: 'IDR', assetType: 'stock', region: 'ID', quantity: 10000, entryPrice: 6000, entryCurrency: 'IDR', createdAt: new Date().toISOString() }
]

const safeUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `pos-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const isValidPosition = (item: any): item is V2Position => {
  if (!item || typeof item !== 'object') return false
  if (typeof item.id !== 'string' || !item.id) return false
  if (typeof item.symbol !== 'string' || !item.symbol) return false
  if (!['stock', 'us_stock', 'commodity', 'crypto', 'indonesian_stock', 'gold', 'cash', 'mutual_fund', 'other'].includes(item.assetType)) return false
  if (!['ID', 'GLOBAL'].includes(item.region)) return false
  if (typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity <= 0) return false
  if (typeof item.entryPrice !== 'number' || !Number.isFinite(item.entryPrice) || item.entryPrice < 0) return false
  if (!['IDR', 'USD'].includes(item.entryCurrency)) return false
  if (typeof item.createdAt !== 'string' || !item.createdAt) return false
  return true
}

const loadPositions = (): V2Position[] => {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY)
  if (saved === null) return []
  
  try {
    const parsed = JSON.parse(saved)
    if (!Array.isArray(parsed)) return []
    if (parsed.length === 0) return []
    
    const validItems = parsed.filter(isValidPosition)
    if (parsed.length > 0 && validItems.length === 0) return []
    
    // Migrate any bad symbols (XAU.JK → XAU/GC=F) — idempotent
    return migratePositions(validItems)
  } catch {
    return []
  }
}

// ── Symbol resolution ────────────────────────────────────────────────────────

/**
 * Maps known commodity/crypto display symbols → Yahoo Finance market symbols.
 * This is the canonical truth for non-stock assets.
 */
const CANONICAL_SYMBOLS: Record<string, { display: string; market: string; assetCurrency: 'IDR' | 'USD' }> = {
  // Gold
  'XAU':     { display: 'XAU',  market: 'GC=F',    assetCurrency: 'USD' },
  'GOLD':    { display: 'XAU',  market: 'GC=F',    assetCurrency: 'USD' },
  'GC=F':    { display: 'XAU',  market: 'GC=F',    assetCurrency: 'USD' },
  'XAUUSD':  { display: 'XAU',  market: 'GC=F',    assetCurrency: 'USD' },
  // Bitcoin
  'BTC':     { display: 'BTC',  market: 'BTC-USD', assetCurrency: 'USD' },
  'BITCOIN': { display: 'BTC',  market: 'BTC-USD', assetCurrency: 'USD' },
  'BTC-USD': { display: 'BTC',  market: 'BTC-USD', assetCurrency: 'USD' },
  // Ethereum
  'ETH':     { display: 'ETH',  market: 'ETH-USD', assetCurrency: 'USD' },
  'ETH-USD': { display: 'ETH',  market: 'ETH-USD', assetCurrency: 'USD' },
  // Oil
  'OIL':     { display: 'OIL',  market: 'CL=F',   assetCurrency: 'USD' },
  'CL=F':    { display: 'OIL',  market: 'CL=F',   assetCurrency: 'USD' },
  // Silver
  'XAG':     { display: 'XAG',  market: 'SI=F',   assetCurrency: 'USD' },
  'SILVER':  { display: 'XAG',  market: 'SI=F',   assetCurrency: 'USD' },
}

/**
 * Infer the trading currency of an asset from its type and region.
 */
function inferAssetCurrency(assetType: string, region: string): 'IDR' | 'USD' {
  if ((assetType === 'stock' || assetType === 'indonesian_stock' || assetType === 'cash' || assetType === 'mutual_fund') && region === 'ID') return 'IDR'
  return 'USD' // crypto, commodity, global stock
}

/**
 * Resolve a raw user input symbol into { display, market, assetCurrency }.
 * - stock + region ID: BBCA → { display: BBCA.JK, market: BBCA.JK, assetCurrency: IDR }
 * - commodity/crypto: XAU → { display: XAU, market: GC=F, assetCurrency: USD }
 */
function resolveSymbol(
  rawSymbol: string,
  assetType: string,
  region: string
): { display: string; market: string; assetCurrency: 'IDR' | 'USD' } {
  const upper = rawSymbol.trim().toUpperCase()

  // Check canonical map first (commodity/crypto)
  if (CANONICAL_SYMBOLS[upper]) {
    return CANONICAL_SYMBOLS[upper]
  }

  // For stocks in Indonesia, append .JK if missing
  if ((assetType === 'stock' || assetType === 'indonesian_stock') && region === 'ID') {
    const display = upper.endsWith('.JK') ? upper : `${upper}.JK`
    return { display, market: display, assetCurrency: 'IDR' }
  }

  // Otherwise keep as-is (global stock, SPY, QQQ, etc.) — USD
  return { display: upper, market: upper, assetCurrency: 'USD' }
}

/**
 * One-time migration: fix bad symbols AND infer missing assetCurrency.
 */
function migratePositions(positions: V2Position[]): V2Position[] {
  return positions.map(pos => {
    const upper = pos.symbol.toUpperCase()

    // Commodity/crypto that accidentally got .JK suffix
    const withoutJK = upper.endsWith('.JK') ? upper.slice(0, -3) : upper
    if (pos.assetType !== 'stock' && CANONICAL_SYMBOLS[withoutJK]) {
      const canonical = CANONICAL_SYMBOLS[withoutJK]
      return {
        ...pos,
        symbol: canonical.display,
        marketSymbol: canonical.market,
        assetCurrency: canonical.assetCurrency,
        region: 'GLOBAL' as const
      }
    }

    // Commodity/crypto without suffix but missing marketSymbol or assetCurrency
    if (pos.assetType !== 'stock' && CANONICAL_SYMBOLS[upper]) {
      const canonical = CANONICAL_SYMBOLS[upper]
      return {
        ...pos,
        symbol: canonical.display,
        marketSymbol: canonical.market,
        assetCurrency: canonical.assetCurrency
      }
    }

    // Infer assetCurrency if not set
    if (!pos.assetCurrency) {
      return { ...pos, assetCurrency: inferAssetCurrency(pos.assetType, pos.region) }
    }

    return pos
  })
}

const isSafeNumber = (val: any): val is number => {
  return typeof val === 'number' && Number.isFinite(val) && !Number.isNaN(val)
}

const safeDisplayCurrency = (value: number | null | undefined, currency: string) => {
  if (!isSafeNumber(value)) return '—'
  return formatDisplayCurrency(value, currency)
}

const formatSafeSigned = (value: number | null | undefined, fractionDigits = 2) => {
  if (!isSafeNumber(value)) return '—'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(value)}`
}

const formatSafePercent = (value: number | null | undefined, fractionDigits = 2) => {
  if (!isSafeNumber(value)) return '—'
  return `${new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(value)}%`
}

const formatFreshness = (value?: string | null, language: string = 'id') => {
  if (!value) return language === 'en' ? 'Waiting for update...' : 'Menunggu pembaruan...'
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return language === 'en' ? 'Invalid time format' : 'Format waktu tidak valid'
  const diffMs = Date.now() - timestamp
  if (diffMs < 60 * 1000) return language === 'en' ? 'Just updated' : 'Baru saja diperbarui'
  const diffMinutes = Math.floor(diffMs / (60 * 1000))
  if (diffMinutes < 60) return language === 'en' ? `Updated ${diffMinutes}m ago` : `Diperbarui ${diffMinutes}m lalu`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return language === 'en' ? `Updated ${diffHours}h ago` : `Diperbarui ${diffHours}j lalu`
  const diffDays = Math.floor(diffHours / 24)
  return language === 'en' ? `Updated ${diffDays} days ago` : `Diperbarui ${diffDays} hari lalu`
}

const normalizeNumericInput = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) {
    return trimmed.replace(/\./g, '')
  }
  return trimmed.replace(/,/g, '')
}

const getStatusBadge = (status: string, language: string = 'id') => {
  switch(status) {
    case 'live': return <span className="bg-teal-500/10 text-teal-300 border border-teal-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">Live Data</span>;
    case 'manual': return <span className="bg-slate-500/10 text-slate-300 border border-slate-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">{language === 'en' ? 'Manual' : 'Manual'}</span>;
    case 'data_limited': return <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">{language === 'en' ? 'Limited Data' : 'Data terbatas'}</span>;
    case 'delayed': return <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">{language === 'en' ? 'Delayed' : 'Tertunda'}</span>;
    case 'fallback': return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">{language === 'en' ? 'Estimate' : 'Estimasi'}</span>;
    case 'error': return <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">{language === 'en' ? 'Unavailable' : 'Tidak tersedia'}</span>;
    default: return null;
  }
}

// ── Pro Gate Component ────────────────────────────────────────────────────────
function ProGate({ children, title, userPlan }: { children: React.ReactNode; title: string; userPlan?: string }) {
  const [revealed, setRevealed] = useState(false)
  const { language } = useLanguagePreference()
  const isPremium = userPlan && userPlan !== 'free'
  
  if (revealed || isPremium) return <>{children}</>
  return (
    <div className="relative border border-white/20 overflow-hidden bg-[#050505]">
      <div className="pointer-events-none opacity-20 select-none grayscale">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050505]/90 p-8 text-center border-t border-white/10">
        <div className="inline-block px-3 py-1 bg-white text-black font-mono text-[10px] uppercase font-bold tracking-widest mb-4">
          [ ACCESS RESTRICTED ]
        </div>
        <p className="text-white text-lg font-medium tracking-tight mb-2">{title}</p>
        <p className="text-slate-400 font-mono text-xs mb-6 max-w-sm leading-relaxed">
          {language === 'id' ? 'Otoritas data tingkat Pro diperlukan. Akses lebih dalam tanpa perlu membayar lebih saat ini.' : 'Pro-level data authority required. Deeper access available without paying more right now.'}
        </p>
        <button
          onClick={() => setRevealed(true)}
          className="px-6 py-3 text-xs font-mono font-bold uppercase tracking-widest border border-teal-500/50 text-teal-400 hover:bg-teal-500/10 transition-colors"
        >
          {language === 'id' ? 'BUKA OTORISASI' : 'GRANT AUTHORIZATION'}
        </button>
      </div>
    </div>
  )
}

export default function Portfolio() {
  const { language } = useLanguagePreference()
  const { user } = useAuthSession()
  const isPro = hasProAccess(user)
  const copy = useMemo(() => ({
    advancedScenario: language === 'en' ? 'Advanced Scenario' : 'Skenario Lanjutan',
    scenario: language === 'en' ? 'Scenario' : 'Skenario',
    impactPct: language === 'en' ? 'Impact %' : 'Dampak %',
    estimatedLoss: language === 'en' ? 'Estimated Loss' : 'Estimasi Kerugian',
    down: language === 'en' ? 'Down' : 'Turun',
    scenarioNote: language === 'en'
      ? 'Estimate based on the largest holding weight. Real market conditions may differ.'
      : 'Estimasi berdasarkan bobot holding terbesar. Pasar nyata bisa berbeda.',
    quantity: language === 'en' ? 'Quantity' : 'Kuantitas',
    latest: language === 'en' ? 'Latest' : 'Terbaru',
    basedOnEstimate: language === 'en' ? 'based on estimate' : 'berdasarkan estimasi',
    delayedData: language === 'en' ? 'delayed data' : 'data tertunda',
    unavailableData: language === 'en' ? 'data unavailable' : 'data tidak tersedia',
    noPositions: language === 'en' ? 'No positions yet.' : 'Belum ada posisi.',
    addFirstAsset: language === 'en'
      ? 'Add your first asset to start reading your portfolio.'
      : 'Tambahkan aset pertama untuk mulai membaca portofoliomu.',
    editMode: language === 'en' ? 'Edit Mode' : 'Mode Edit',
    newRecord: language === 'en' ? 'New Record' : 'Pencatatan Baru',
    editPosition: language === 'en' ? 'Edit Position Details' : 'Ubah Detail Posisi',
    addPosition: language === 'en' ? 'Add Portfolio Position' : 'Tambah Posisi Portofolio',
    assetSymbol: language === 'en' ? 'Asset Symbol' : 'Simbol Aset',
    symbolPlaceholder: language === 'en' ? 'e.g. BBCA.JK or XAU' : 'e.g. BBCA.JK atau XAU',
    assetName: language === 'en' ? 'Asset Name' : 'Nama aset',
    resolveAsset: language === 'en' ? 'Check Asset' : 'Cek aset',
    resolvingAsset: language === 'en' ? 'Checking...' : 'Mengecek...',
    category: language === 'en' ? 'Category' : 'Kategori',
    region: language === 'en' ? 'Region' : 'Wilayah',
    quantityLot: language === 'en' ? 'Quantity / Lot' : 'Kuantitas / Lot',
    averagePrice: language === 'en' ? 'Average Price' : 'Harga Rata-Rata',
    currency: language === 'en' ? 'Currency' : 'Mata Uang',
    stock: language === 'en' ? 'Stock' : 'Saham',
    usStock: language === 'en' ? 'US Stock' : 'Saham US',
    commodity: language === 'en' ? 'Commodity' : 'Komoditas',
    crypto: language === 'en' ? 'Crypto' : 'Kripto',
    gold: language === 'en' ? 'Gold' : 'Emas',
    cash: language === 'en' ? 'Cash' : 'Kas',
    mutualFund: language === 'en' ? 'Mutual fund' : 'Reksa dana',
    other: language === 'en' ? 'Other' : 'Lainnya',
    manualValue: language === 'en' ? 'Value' : 'Nilai aset',
    allocationPercent: language === 'en' ? 'Allocation %' : 'Alokasi %',
    note: language === 'en' ? 'Note' : 'Catatan',
    saveChanges: language === 'en' ? 'Save Changes' : 'Simpan Perubahan',
    addToPortfolio: language === 'en' ? 'Add to Portfolio' : 'Tambahkan ke Portofolio',
    cancel: language === 'en' ? 'Cancel' : 'Batal',
    dataNote: language === 'en' ? 'Data Note' : 'Catatan Data',
    dataNoteBody: language === 'en'
      ? 'This portfolio is stored locally on your device for privacy and speed. AI calculations are processed in real time.'
      : 'Portofolio ini disimpan secara lokal di perangkat Anda demi privasi dan kecepatan. Kalkulasi AI diproses secara real-time.',
    basicInsight: language === 'en' ? 'Basic Insight' : 'Basic Insight',
    portfolioCopilot: language === 'en' ? 'Portfolio-aware Copilot' : 'Portfolio-aware Copilot',
    portfolioStatus: language === 'en' ? 'Reading your portfolio' : 'Membaca portofolio kamu',
    basicInsightDetail: language === 'en'
      ? 'Ting AI reads basic composition and risk from your portfolio.'
      : 'Ting AI membaca komposisi dan risiko dasar portofolio kamu.',
    portfolioCopilotDetail: language === 'en'
      ? 'Ting AI connects asset weights, concentration risk, and market conditions. Not a transaction instruction.'
      : 'Ting AI menghubungkan porsi aset, konsentrasi risiko, dan kondisi market. Bukan instruksi transaksi.',
    allocationOnlyNote: language === 'en'
      ? 'This context reads allocation only, not personal profit/loss.'
      : 'Konteks ini membaca porsi portofolio, bukan profit/loss pribadi.',
    portfolioSummaryPrefix: language === 'en' ? 'Portfolio' : 'Portofolio',
    assets: language === 'en' ? 'assets' : 'aset',
    largest: language === 'en' ? 'Largest' : 'Terbesar',
  }), [language])
  // Derive plan from localStorage session (set by auth) — default free
  const userPlan: 'free' | 'pro' = isPro ? 'pro' : 'free'

  // ── Base Currency (separate from UI language) ─────────────────────────────
  const BASE_CURRENCY_KEY = 'tingai_portfolio_base_currency'
  const [baseCurrency, setBaseCurrencyState] = useState<'IDR' | 'USD'>(() => {
    try {
      const saved = localStorage.getItem(BASE_CURRENCY_KEY)
      return (saved === 'USD' || saved === 'IDR') ? saved : 'IDR'
    } catch { return 'IDR' }
  })
  const setBaseCurrency = (c: 'IDR' | 'USD') => {
    try { localStorage.setItem(BASE_CURRENCY_KEY, c) } catch {}
    setBaseCurrencyState(c)
  }

  // ── FX Rate (USD/IDR) ─────────────────────────────────────────────────────
  const [fxRate, setFxRate] = useState<FxRate>({ rate: FX_FALLBACK_RATE, source: 'fallback' })
  const [riskBudget, setRiskBudget] = useState<RiskBudgetConfig>(() => readRiskBudget())
  const [decisionJournalVersion, setDecisionJournalVersion] = useState(0)

  useEffect(() => {
    getUsdIdrRate().then(setFxRate)
  }, [])

  /** Convert a value from its asset currency to baseCurrency */
  const toBase = useCallback((value: number, assetCurrency: 'IDR' | 'USD'): number => {
    if (assetCurrency === baseCurrency) return value
    if (assetCurrency === 'USD' && baseCurrency === 'IDR') return value * fxRate.rate
    if (assetCurrency === 'IDR' && baseCurrency === 'USD') return value / fxRate.rate
    return value
  }, [baseCurrency, fxRate.rate])

  // Alias — keeps all existing JSX references working after baseCurrency replaced displayCurrency
  const displayCurrency = baseCurrency


  const [positions, setPositions] = useState<V2Position[]>(loadPositions)

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(positions))
  }, [positions])

  const [form, setForm] = useState<FormState>(initialForm)
  const [editingHoldingId, setEditingHoldingId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [livePrices, setLivePrices] = useState<Record<string, DetailedStockData>>({})
  const [resolverLoading, setResolverLoading] = useState(false)
  const [resolverCandidate, setResolverCandidate] = useState<AssetResolverCandidate | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [resolverMessage, setResolverMessage] = useState('')
  // Track whether the first market data fetch has completed
  const [marketDataReady, setMarketDataReady] = useState(false)
  // CSV Import modal state
  const [showCsvModal, setShowCsvModal] = useState(false)

  const syncLivePrices = useCallback(async () => {
    try {
      // Use marketSymbol (e.g. GC=F) when available, otherwise display symbol
      const toFetch = Array.from(new Set(
        positions
          .filter(p => p.source !== 'manual' && p.supportStatus !== 'data_limited')
          .map(p => p.marketSymbol || p.symbol)
      ))
      if (toFetch.length === 0) return

      const results = await Promise.allSettled(toFetch.map(sym => fetchStock(sym)))

      const priceMap: Record<string, DetailedStockData> = {}
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          const d = r.value
          const fetchedAs = toFetch[i]
          // Map by the marketSymbol key used to fetch (e.g. 'GC=F')
          priceMap[fetchedAs] = d
          // Also map by yahooSymbol and display symbol returned
          priceMap[d.yahooSymbol] = d
          priceMap[d.symbol] = d
          // Map by ALL position display symbols that use this market symbol
          positions.forEach(p => {
            if ((p.marketSymbol || p.symbol) === fetchedAs) {
              priceMap[p.symbol] = d
            }
          })
        }
      })

      setLivePrices(prev => ({...prev, ...priceMap}))
    } catch {
    } finally {
      setMarketDataReady(true)
    }
  }, [positions])

  useEffect(() => {
    void syncLivePrices()
    const interval = setInterval(syncLivePrices, 30000)
    return () => clearInterval(interval)
  }, [syncLivePrices])

  const handleRefreshPrices = async () => {
    setRefreshing(true)
    await syncLivePrices()
    const successMsg = language === 'id' ? 'Data diperbarui.' : 'Data updated.'
    setSuccess(successMsg)
    setTimeout(() => setSuccess(''), 3000)
    setRefreshing(false)
  }

  // CSV Import handler — converts ParsedRow[] into V2Position[] and adds to state
  const handleCsvImport = async (rows: Array<{ symbol: string; quantity: number; avgPrice: number }>) => {
    if (!isPro && positions.length >= 5) {
      setError(language === 'id' ? 'Batas Akun Gratis Tercapai (Maks 5 Aset). Silakan upgrade ke Pro.' : 'Free Account Limit Reached (Max 5 Assets). Please upgrade to Pro.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const maxToAdd = isPro ? rows.length : 5 - positions.length
    const rowsToProcess = rows.slice(0, maxToAdd)

    const newPositions: V2Position[] = rowsToProcess.map(row => {
      const isIDX = row.symbol.endsWith('.JK')
      return {
        id: safeUUID(),
        symbol: row.symbol,
        marketSymbol: row.symbol,
        assetCurrency: isIDX ? 'IDR' : 'USD',
        assetType: isIDX ? 'indonesian_stock' : 'stock',
        region: isIDX ? 'ID' : 'GLOBAL',
        quantity: row.quantity,
        entryPrice: row.avgPrice,
        entryCurrency: isIDX ? 'IDR' : 'USD',
        source: 'market_provider',
        createdAt: new Date().toISOString(),
      }
    })
    setPositions(prev => {
      const existingSymbols = new Set(prev.map(p => p.symbol))
      const toAdd = newPositions.filter(p => !existingSymbols.has(p.symbol))
      return [...prev, ...toAdd]
    })
    const msg = language === 'id'
      ? `${newPositions.length} posisi berhasil diimpor dari CSV.`
      : `${newPositions.length} positions imported from CSV.`
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 5000)
    // Trigger market data sync for new positions
    setTimeout(() => void syncLivePrices(), 500)
  }

  const enrichedHoldings = useMemo(() => {
    const provisional = positions.map(pos => {
      if (pos.source === 'manual' || pos.supportStatus === 'data_limited') {
        const assetCurrency: 'IDR' | 'USD' = pos.assetCurrency ?? inferAssetCurrency(pos.assetType, pos.region)
        const manualNativeValue = Number(pos.manualValue ?? (pos.quantity * pos.entryPrice))
        return {
          pos,
          assetCurrency,
          nativePrice: pos.quantity > 0 && manualNativeValue > 0 ? manualNativeValue / pos.quantity : pos.entryPrice,
          nativeValue: Number.isFinite(manualNativeValue) ? manualNativeValue : 0,
          nativeInvested: Number.isFinite(manualNativeValue) ? manualNativeValue : 0,
          status: 'manual' as const
        }
      }

      const live =
        livePrices[pos.symbol] ||
        livePrices[pos.marketSymbol ?? ''] ||
        livePrices[`${pos.symbol}.JK`]
      const status = live?.status || 'fallback'
      const assetCurrency: 'IDR' | 'USD' =
        pos.assetCurrency ?? inferAssetCurrency(pos.assetType, pos.region)
      const nativePrice = status === 'error' ? 0 : (live?.price || pos.entryPrice)
      const nativeValue = pos.quantity * nativePrice
      const nativeInvested = pos.quantity * pos.entryPrice

      return { pos, assetCurrency, nativePrice, nativeValue, nativeInvested, status, fetchedAt: live?.fetchedAt }
    })

    const allocationOnly = provisional.filter(item =>
      item.pos.supportStatus === 'data_limited' &&
      Number(item.pos.allocationPercent || 0) > 0 &&
      item.nativeValue <= 0
    )
    const knownTotal = provisional
      .filter(item => !allocationOnly.includes(item))
      .reduce((sum, item) => sum + toBase(item.nativeValue, item.assetCurrency), 0)
    const allocationPctTotal = allocationOnly.reduce((sum, item) => sum + Number(item.pos.allocationPercent || 0), 0)

    return positions.map(pos => {
      const prepared = provisional.find(item => item.pos.id === pos.id)
      if (!prepared) return null

      const isManual = pos.source === 'manual' || pos.supportStatus === 'data_limited'
      const assetCurrency = prepared.assetCurrency
      let nativePrice = prepared.nativePrice
      let nativeValue = prepared.nativeValue
      let nativeInvested = prepared.nativeInvested
      const allocationPct = Number(pos.allocationPercent || 0)

      if (isManual && nativeValue <= 0 && allocationPct > 0 && knownTotal > 0 && allocationPctTotal < 100) {
        const valueInBase = knownTotal * (allocationPct / Math.max(100 - allocationPctTotal, 1))
        nativeValue = assetCurrency === baseCurrency
          ? valueInBase
          : assetCurrency === 'USD' && baseCurrency === 'IDR'
            ? valueInBase / fxRate.rate
            : valueInBase * fxRate.rate
        nativeInvested = nativeValue
        nativePrice = pos.quantity > 0 ? nativeValue / pos.quantity : nativeValue
      }

      if (isManual) {
        const valueInBase = toBase(nativeValue, assetCurrency)
        return {
          id: pos.id,
          assetId: pos.id,
          symbol: pos.symbol || pos.name || 'MANUAL',
          name: pos.name || pos.symbol || 'Manual asset',
          assetType: pos.assetType,
          region: pos.region,
          source: 'manual',
          supportStatus: 'data_limited',
          note: pos.note,
          allocationPercent: pos.allocationPercent,
          assetCurrency,
          quantity: pos.quantity,
          entryPrice: nativePrice,
          entryCurrency: pos.entryCurrency,
          latestPrice: null,
          nativeValue,
          nativeInvested,
          nativePnl: 0,
          currentValue: valueInBase,
          investedAmount: valueInBase,
          investedAmountDisplay: valueInBase,
          pnl: 0,
          pnlPct: 0,
          quoteCurrency: assetCurrency,
          displayCurrency: baseCurrency,
          status: 'manual',
          fetchedAt: null
        }
      }

      // Look up by display symbol first, then by marketSymbol (e.g. GC=F for XAU)
      const live =
        livePrices[pos.symbol] ||
        livePrices[pos.marketSymbol ?? ''] ||
        livePrices[`${pos.symbol}.JK`]
      const status = live?.status || 'fallback'

      // Determine asset's trading currency (with migration fallback)
      const liveAssetCurrency: 'IDR' | 'USD' =
        pos.assetCurrency ?? inferAssetCurrency(pos.assetType, pos.region)

      // Native price in the asset's own currency
      const liveNativePrice = status === 'error' ? 0 : (live?.price || pos.entryPrice)
      const liveNativeValue  = pos.quantity * liveNativePrice
      const entryCurrency = pos.entryCurrency ?? liveAssetCurrency
      const liveNativeInvested = pos.quantity * pos.entryPrice

      // Converted to base currency
      const valueInBase    = toBase(liveNativeValue, liveAssetCurrency)
      const investedInBase = toBase(liveNativeInvested, entryCurrency)
      const pnlInBase      = status === 'error' ? 0 : (valueInBase - investedInBase)
      const pnlPct      = investedInBase > 0 ? (pnlInBase / investedInBase) * 100 : 0

      return {
        id: pos.id,
        assetId: pos.id,
        symbol: pos.symbol,
        name: pos.name || pos.symbol,
        source: pos.source || 'market_provider',
        supportStatus: pos.supportStatus || 'live_data',
        assetType: pos.assetType,
        region: pos.region,
        assetCurrency: liveAssetCurrency,
        quantity: pos.quantity,
        entryPrice: pos.entryPrice,
        entryCurrency: pos.entryCurrency,
        // Native values (for display in asset's own currency)
        latestPrice: liveNativePrice,
        nativeValue: liveNativeValue,
        nativeInvested: liveNativeInvested,
        nativePnl: pnlInBase,
        // Base-currency values (for portfolio math)
        currentValue:  valueInBase,   // ← this feeds portfolioIntelligence
        investedAmount:  investedInBase,
        investedAmountDisplay: investedInBase,
        pnl:  pnlInBase,
        pnlPct,
        quoteCurrency: liveAssetCurrency,
        displayCurrency: baseCurrency,
        status,
        fetchedAt: live?.fetchedAt
      }
    }).filter(Boolean) as any[]
  }, [positions, livePrices, toBase, baseCurrency, fxRate.rate])

  const enrichedSummary = useMemo(() => {
    const validHoldings = enrichedHoldings.filter(h => h.status !== 'error')
    // All values are already converted to baseCurrency via toBase() in enrichedHoldings
    const totalCurrentValue = validHoldings.reduce((sum, h) => sum + h.currentValue, 0)
    const totalInvested     = validHoldings.reduce((sum, h) => sum + h.investedAmount, 0)
    const totalPnl          = totalCurrentValue - totalInvested
    const totalPnlPct       = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0

    return {
      totalCurrentValue,
      totalInvested,
      totalPnl,
      totalPnlPct,
      totalHoldings: validHoldings.length,
      displayCurrency: baseCurrency // used by portfolioIntelligence
    }
  }, [enrichedHoldings, baseCurrency])

  const hasProfitLossData = useMemo(() => {
    const holdingLevelReady = enrichedHoldings.length > 0 && enrichedHoldings.every((holding) => {
      const hasMarketValue =
        holding.source !== 'manual' &&
        holding.supportStatus !== 'data_limited' &&
        holding.status !== 'error'
      return (
        hasMarketValue &&
        Number.isFinite(holding.pnlPct) &&
        Number.isFinite(holding.pnl) &&
        Number(holding.investedAmount) > 0 &&
        Number(holding.currentValue) > 0
      )
    })
    if (!holdingLevelReady) return false

    const totalValue = enrichedSummary.totalCurrentValue
    const totalCost = enrichedSummary.totalInvested
    if (!Number.isFinite(totalValue) || !Number.isFinite(totalCost) || totalValue <= 0 || totalCost <= 0) return false

    const costToValueRatio = totalCost / totalValue
    const valueToCostRatio = totalValue / totalCost
    const sane = costToValueRatio <= 20 && valueToCostRatio <= 20

    if (!sane && typeof window !== 'undefined') {
      console.warn('[TingAI portfolio] Hiding impossible PnL stats', {
        totalValueIdr: totalValue,
        totalCostBasisIdr: totalCost,
        costToValueRatio,
      })
    }

    return sane
  }, [enrichedHoldings, enrichedSummary.totalCurrentValue, enrichedSummary.totalInvested])

  const normalizedPortfolio = useMemo(() => ({
    summary: hasProfitLossData
      ? enrichedSummary
      : {
          ...enrichedSummary,
          totalPnl: null,
          totalPnlPct: null
        },
    holdings: enrichedHoldings.map((holding) => hasProfitLossData
      ? holding
      : {
          ...holding,
          pnl: null,
          pnlPct: null,
          nativePnl: null
        })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any, [enrichedSummary, enrichedHoldings, hasProfitLossData])

  const normalizedSnapshot = useMemo<NormalizedPortfolioSnapshot>(() => {
    const baseToIdr = (value: number | null | undefined) => {
      if (!Number.isFinite(Number(value))) return null
      return baseCurrency === 'IDR' ? Number(value) : Number(value) * fxRate.rate
    }
    const totalValueIdr = baseToIdr(enrichedSummary.totalCurrentValue)
    const totalCostBasisIdr = hasProfitLossData ? baseToIdr(enrichedSummary.totalInvested) : null

    const holdings = enrichedHoldings.map((holding) => {
      const marketValueIdr = baseToIdr(holding.currentValue)
      const costBasisIdr = hasProfitLossData ? baseToIdr(holding.investedAmount) : null
      const allocationPercent = totalValueIdr && marketValueIdr
        ? (marketValueIdr / totalValueIdr) * 100
        : Number(holding.allocationPercent || 0)

      return {
        symbol: holding.symbol,
        name: holding.name,
        assetType: holding.assetType === 'stock' && holding.region === 'ID'
          ? 'indonesian_stock'
          : holding.assetType || inferAssetTypeFromInput(holding.symbol),
        allocationPercent,
        quantity: holding.quantity,
        currentPrice: holding.latestPrice ?? null,
        currentPriceCurrency: holding.assetCurrency || holding.quoteCurrency || null,
        marketValueIdr,
        avgBuyPrice: hasProfitLossData ? holding.entryPrice : null,
        avgBuyPriceCurrency: hasProfitLossData ? holding.entryCurrency : null,
        costBasisIdr,
        pnlIdr: hasProfitLossData ? baseToIdr(holding.pnl) : null,
        pnlPercent: hasProfitLossData ? holding.pnlPct ?? null : null,
        currency: holding.assetCurrency || holding.quoteCurrency || null,
        exchange: holding.region === 'ID' ? 'IDX' : holding.exchange || undefined,
        source: holding.source,
        supportStatus: holding.supportStatus,
      }
    })

    return {
      holdings,
      totalValueIdr,
      totalCostBasisIdr,
      hasPortfolio: holdings.length > 0,
      hasRealPnLData: hasProfitLossData,
      mode: hasProfitLossData ? 'real_pnl' : 'allocation_only',
      updatedAt: new Date().toISOString(),
      dataSource: holdings.length ? (hasUsableUserPortfolioPositions() ? 'user_portfolio' : 'demo') : 'empty',
    }
  }, [baseCurrency, enrichedHoldings, enrichedSummary.totalCurrentValue, enrichedSummary.totalInvested, fxRate.rate, hasProfitLossData])

  useEffect(() => {
    writePortfolioSnapshot(normalizedSnapshot)
  }, [normalizedSnapshot])

  useEffect(() => {
    const syncDecisionJournal = () => setDecisionJournalVersion((value) => value + 1)
    window.addEventListener('tingai-decision-journal', syncDecisionJournal)
    return () => window.removeEventListener('tingai-decision-journal', syncDecisionJournal)
  }, [])

  const actionWatchlist = useMemo(
    () => buildPortfolioActionWatchlist(normalizedSnapshot, language, isPro ? 5 : 2),
    [isPro, language, normalizedSnapshot]
  )
  const actionWatchlistContext = useMemo(
    () => formatActionWatchlistForCopilot(actionWatchlist, language),
    [actionWatchlist, language]
  )
  const riskBudgetEvaluation = useMemo(
    () => evaluateRiskBudget(normalizedSnapshot, riskBudget, language),
    [language, normalizedSnapshot, riskBudget]
  )
  const riskBudgetContext = useMemo(
    () => formatRiskBudgetForCopilot(riskBudgetEvaluation, language),
    [language, riskBudgetEvaluation]
  )
  const decisionJournalContext = useMemo(
    () => formatDecisionJournalForCopilot(readDecisionJournal(), language, isPro ? 5 : 2),
    [decisionJournalVersion, isPro, language]
  )

  const intelligence = useMemo(
    () => getPortfolioIntelligence(normalizedPortfolio as any, language),
    [language, normalizedPortfolio]
  )
  const portfolioHeroInsight = useMemo(
    () => generatePortfolioInsight(intelligence, intelligence.portfolioTone, language),
    [intelligence, language]
  )
  const riskSimulation = useMemo(
    () => generateRiskSimulation(intelligence, language),
    [intelligence, language]
  )

  const latestFetch = useMemo(() => {
    return Object.values(livePrices).reduce((latest, current) => {
      if (!current.fetchedAt) return latest;
      if (!latest) return current.fetchedAt;
      return new Date(current.fetchedAt) > new Date(latest) ? current.fetchedAt : latest;
    }, null as string | null);
  }, [livePrices]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [])

  const handleStartEdit = (holding: any) => {
    setEditingHoldingId(holding.id)
    setForm({
      symbol: holding.symbol,
      assetName: holding.name || '',
      assetType: holding.assetType,
      region: holding.region,
      quantity: String(holding.quantity),
      entryPrice: String(holding.entryPrice),
      entryCurrency: holding.entryCurrency,
      manualValue: holding.source === 'manual' && holding.nativeValue ? String(holding.nativeValue) : '',
      allocationPercent: holding.allocationPercent ? String(holding.allocationPercent) : '',
      note: holding.note || ''
    })
    setManualMode(holding.source === 'manual' || holding.supportStatus === 'data_limited')
    setResolverCandidate(null)
    setResolverMessage('')
    setError('')
    setSuccess('')
    document.getElementById('portfolio-form-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setEditingHoldingId(null)
    setForm(initialForm)
    setManualMode(false)
    setResolverCandidate(null)
    setResolverMessage('')
    setError('')
  }

  const resolveAsset = async () => {
      const query = form.symbol.trim()
    if (!query) {
      setError(language === 'id' ? 'Masukkan simbol aset dulu.' : 'Enter an asset symbol first.')
      return
    }

    setResolverLoading(true)
    setResolverCandidate(null)
    setResolverMessage('')
    setManualMode(false)
    setError('')

    try {
      const localResolved = resolveSymbol(query, form.assetType, form.region)
      const localKnown = CANONICAL_SYMBOLS[query.toUpperCase()]
      if (localKnown) {
        const inferredAssetType = inferAssetTypeFromInput(query)
        setResolverCandidate({
          symbol: localResolved.display,
          name: localResolved.display,
          assetType: inferredAssetType === 'crypto' ? 'crypto' : 'commodity',
          exchange: null,
          currency: localResolved.assetCurrency,
          source: 'internal_cache',
          supportStatus: 'live_data',
          provider: 'yahoo',
          providerSymbol: localResolved.market
        })
        return
      }

      const res = await fetchWithSession(`${API_URL}/api/assets/resolve?query=${encodeURIComponent(query)}`)
      if (!res.ok) throw new Error(await readResponseError(res, 'Resolver gagal.'))
      const data = (await res.json()) as AssetResolveResponse
      const candidate = data.candidates?.[0]
      if (data.found && candidate) {
        setResolverCandidate(candidate)
        return
      }

      const inferredAssetType = inferAssetTypeFromInput(query)
      setForm((current) => ({
        ...current,
        assetType: inferredAssetType === 'us_stock' ? 'us_stock' : inferredAssetType,
        region: inferredAssetType === 'indonesian_stock' ? 'ID' : ['crypto', 'gold', 'us_stock'].includes(inferredAssetType) ? 'GLOBAL' : current.region,
      }))
      setManualMode(true)
      setResolverMessage(data.message || (language === 'id' ? 'Aset belum ditemukan' : 'Asset not found'))
    } catch (err) {
      const inferredAssetType = inferAssetTypeFromInput(query)
      setForm((current) => ({
        ...current,
        assetType: inferredAssetType === 'us_stock' ? 'us_stock' : inferredAssetType,
        region: inferredAssetType === 'indonesian_stock' ? 'ID' : ['crypto', 'gold', 'us_stock'].includes(inferredAssetType) ? 'GLOBAL' : current.region,
      }))
      setManualMode(true)
      setResolverMessage(language === 'id' ? 'Aset belum ditemukan' : 'Asset not found')
    } finally {
      setResolverLoading(false)
    }
  }

  const handleDeleteHolding = (holdingId: string) => {
    const confirmMsg = language === 'id' ? 'Hapus posisi ini?' : 'Delete this position?'
    if (!window.confirm(confirmMsg)) return
    setPositions(prev => prev.filter(p => p.id !== holdingId))
    if (editingHoldingId === holdingId) handleCancelEdit()
    const successMsg = language === 'id' ? 'Posisi berhasil dihapus.' : 'Position deleted successfully.'
    setSuccess(successMsg)
    setTimeout(() => setSuccess(''), 3000)
  }

  const restoreDefaultPositions = () => {
    const confirmMsg = language === 'id' ? 'Muat portofolio bawaan?' : 'Load default portfolio?'
    if (window.confirm(confirmMsg)) {
      setPositions(DEFAULT_POSITIONS)
      const successMsg = language === 'id' ? 'Portofolio bawaan berhasil dimuat.' : 'Default portfolio loaded successfully.'
      setSuccess(successMsg)
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!isPro && positions.length >= 5 && !editingHoldingId) {
      setError(language === 'id' ? 'Batas Akun Gratis Tercapai (Maks 5 Aset). Silakan upgrade ke Pro.' : 'Free Account Limit Reached (Max 5 Assets). Please upgrade to Pro.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    try {
      if (!form.assetType || !['stock', 'us_stock', 'commodity', 'crypto', 'indonesian_stock', 'gold', 'cash', 'mutual_fund', 'other'].includes(form.assetType))
        throw new Error(language === 'id' ? 'Kategori aset tidak valid.' : 'Asset category is not valid.')
      if (!form.region || !['ID', 'GLOBAL'].includes(form.region))
        throw new Error(language === 'id' ? 'Wilayah tidak valid.' : 'Region is not valid.')
      if (!form.entryCurrency || !['IDR', 'USD'].includes(form.entryCurrency))
        throw new Error(language === 'id' ? 'Mata uang tidak valid.' : 'Currency is not valid.')

      const symbolInput = form.symbol.trim().toUpperCase()
      const inferredFromInput = inferAssetTypeFromInput(symbolInput || form.assetName)
      const effectiveAssetType = manualMode && (form.assetType === 'other' || !form.assetType)
        ? inferredFromInput
        : form.assetType
      const normRegion = (effectiveAssetType === 'indonesian_stock'
        ? 'ID'
        : ['crypto', 'gold', 'us_stock'].includes(effectiveAssetType)
        ? 'GLOBAL'
        : form.region) as 'ID' | 'GLOBAL'
      const resolved = resolverCandidate
        ? {
            display: resolverCandidate.symbol,
            market: resolverCandidate.providerSymbol || resolverCandidate.symbol,
            assetCurrency: (resolverCandidate.currency === 'IDR' ? 'IDR' : 'USD') as 'IDR' | 'USD'
          }
        : resolveSymbol(form.symbol, effectiveAssetType, normRegion)
      if (!manualMode && !resolved.display) throw new Error(language === 'id' ? 'Simbol aset tidak boleh kosong.' : 'Asset symbol cannot be empty.')

      const manualValue = Number(normalizeNumericInput(form.manualValue))
      const allocationPercent = Number(normalizeNumericInput(form.allocationPercent))
      const qty = manualMode && !form.quantity.trim() ? 1 : Number(normalizeNumericInput(form.quantity))
      if (!Number.isFinite(qty) || qty <= 0) throw new Error(language === 'id' ? 'Kuantitas harus berupa angka lebih besar dari 0.' : 'Quantity must be a number greater than 0.')

      const price = manualMode && !form.entryPrice.trim()
        ? (Number.isFinite(manualValue) && manualValue > 0 ? manualValue / qty : 0)
        : Number(normalizeNumericInput(form.entryPrice))
      if (!manualMode && (!Number.isFinite(price) || price <= 0)) throw new Error(language === 'id' ? 'Harga rata-rata (entry) harus lebih besar dari 0.' : 'Entry price must be greater than 0.')
      if (manualMode) {
        const hasManualValue = Number.isFinite(manualValue) && manualValue > 0
        const hasAllocation = Number.isFinite(allocationPercent) && allocationPercent > 0
        if (!hasManualValue && !hasAllocation) throw new Error(language === 'id' ? 'Isi nilai aset atau persentase alokasi.' : 'Enter asset value or allocation percentage.')
        if (hasAllocation && allocationPercent >= 100) throw new Error(language === 'id' ? 'Alokasi harus di bawah 100%.' : 'Allocation must be below 100%.')
      }

      const finalSymbol = manualMode ? (symbolInput || form.assetName.trim().toUpperCase()) : resolved.display
      const isDuplicate = positions.some(p => p.symbol === finalSymbol && p.id !== editingHoldingId)
      if (isDuplicate) {
        throw new Error(language === 'id' ? 'Aset ini sudah ada di portofolio. Gunakan edit untuk mengubah posisinya.' : 'This asset already exists in your portfolio. Use edit to modify it.')
      }

      // For commodity/crypto, always force region GLOBAL
      const finalRegion: 'ID' | 'GLOBAL' =
        ['commodity', 'crypto', 'gold', 'us_stock'].includes(effectiveAssetType) ? 'GLOBAL' : normRegion

      const newPosition: V2Position = {
        id: editingHoldingId || safeUUID(),
        symbol: finalSymbol,
        name: manualMode ? (form.assetName.trim() || normalizeDisplaySymbol(finalSymbol)) : (resolverCandidate?.name || normalizeDisplaySymbol(resolved.display)),
        marketSymbol: manualMode ? undefined : (resolved.market !== resolved.display ? resolved.market : undefined),
        assetCurrency: manualMode ? inferAssetCurrency(effectiveAssetType, finalRegion) : resolved.assetCurrency,
        assetType: effectiveAssetType as any,
        region: finalRegion,
        quantity: qty,
        entryPrice: price,
        entryCurrency: form.entryCurrency as any,
        source: manualMode ? 'manual' : (resolverCandidate?.source || 'market_provider'),
        supportStatus: manualMode ? 'data_limited' : 'live_data',
        exchange: resolverCandidate?.exchange || (finalRegion === 'ID' ? 'IDX' : undefined) || undefined,
        provider: manualMode ? undefined : (resolverCandidate?.provider || 'yahoo'),
        note: form.note.trim() || undefined,
        manualValue: manualMode && Number.isFinite(manualValue) && manualValue > 0 ? manualValue : undefined,
        allocationPercent: manualMode && Number.isFinite(allocationPercent) && allocationPercent > 0 ? allocationPercent : undefined,
        createdAt: new Date().toISOString()
      }

      if (editingHoldingId) {
        setPositions(prev => prev.map(p => p.id === editingHoldingId ? newPosition : p))
        const successMsg = language === 'id' ? 'Perubahan posisi berhasil disimpan.' : 'Position changes saved successfully.'
        setSuccess(successMsg)
      } else {
        setPositions(prev => [...prev, newPosition])
        const successMsg = language === 'id' ? 'Posisi baru berhasil ditambahkan.' : 'New position added successfully.'
        setSuccess(successMsg)
      }
      
      handleCancelEdit()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      const defaultError = language === 'id' ? 'Terjadi kesalahan input.' : 'Input error occurred.'
      setError(err.message || defaultError)
    }
  }

  const handleDownloadPdf = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-[#0b0d12] text-white selection:bg-teal-500/30 pb-20">
      <div className="max-w-6xl mx-auto px-6 pt-32 pb-6 flex justify-between items-center relative z-10">
        <div className="space-y-1">
          <h1 className="text-xl font-medium tracking-tight">
            {language === 'id' ? 'Ruang Portofolio' : 'Personal Workspace'}
          </h1>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{formatFreshness(latestFetch, language)}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Base Currency Toggle — independent of language */}
          <div className="flex items-center bg-white/[0.04] border border-white/10 rounded-sm overflow-hidden text-[11px] font-semibold">
            <span className="px-3 py-2 text-slate-500 font-mono">Base:</span>
            <button
              id="base-currency-idr"
              onClick={() => setBaseCurrency('IDR')}
              className={`px-3 py-2 transition-all ${
                baseCurrency === 'IDR'
                  ? 'bg-teal-500/20 text-teal-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >IDR</button>
            <button
              id="base-currency-usd"
              onClick={() => setBaseCurrency('USD')}
              className={`px-3 py-2 transition-all ${
                baseCurrency === 'USD'
                  ? 'bg-teal-500/20 text-teal-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >USD</button>
          </div>
          <button className="premium-button px-5 py-2.5 bg-white/[0.03] border border-white/10 hover:bg-white/10 rounded-sm text-xs font-semibold transition-all" onClick={handleRefreshPrices} disabled={refreshing}>
            {refreshing 
              ? (language === 'id' ? 'Memperbarui...' : 'Refreshing...') 
              : (language === 'id' ? 'Perbarui Pasar' : 'Refresh Market')}
          </button>
          
          <button 
            className="premium-button px-5 py-2.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 rounded-sm text-xs font-semibold transition-all flex items-center gap-2" 
            onClick={handleDownloadPdf}
            disabled={refreshing}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            {language === 'id' ? 'Unduh PDF (Pro)' : 'Download PDF (Pro)'}
          </button>

          {/* CSV Import button */}
          <button
            className="premium-button px-5 py-2.5 bg-teal-500/[0.08] border border-teal-500/20 hover:bg-teal-500/15 rounded-sm text-xs font-semibold text-teal-300 transition-all flex items-center gap-2"
            onClick={() => setShowCsvModal(true)}
          >
            <span>⬆</span>
            <span>{language === 'id' ? 'Import CSV' : 'Import CSV'}</span>
          </button>
        </div>
      </div>

      {/* CSV Import Modal */}
      {showCsvModal && (
        <CsvImportModal
          onClose={() => setShowCsvModal(false)}
          onImport={handleCsvImport}
        />
      )}

      <div className="max-w-6xl mx-auto px-6">
        {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-sm mb-8 text-sm">{error}</div>}
        {success && <div className="p-4 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-sm mb-8 text-sm">{success}</div>}
      </div>

      <main className="max-w-6xl mx-auto px-6 pt-8 space-y-16 md:space-y-20">
        {/* FX Rate info bar */}
        {(
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-600 py-1">
            <span>{language === 'en' ? 'USD/IDR Rate' : 'Kurs USD/IDR'}: Rp{fxRate.rate.toLocaleString('id-ID')}</span>
            {fxRate.source === 'fallback' && (
              <span className="text-amber-600/70">• fallback</span>
            )}
          </div>
        )}

        {/* Global Data Banner — only shown after first fetch attempt completes */}
        {(() => {
          if (!marketDataReady || enrichedHoldings.length === 0) return null;
          const errorCount  = enrichedHoldings.filter(h => h.status === 'error').length;
          const totalCount  = enrichedHoldings.length;
          const allError    = errorCount === totalCount;
          const someError   = errorCount > 0 && !allError;
          const allFallback = enrichedHoldings.every(h => h.status === 'fallback');
          const allDelayed  = enrichedHoldings.every(h => h.status === 'delayed');

          // Only show red when every single holding failed — genuine outage
          if (allError) {
            return (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-sm text-sm flex items-center gap-3">
                <p>{language === 'en'
                  ? 'Market data is currently unavailable. Showing entry prices as reference.'
                  : 'Data pasar tidak tersedia saat ini. Harga entry ditampilkan sebagai referensi.'}
                </p>
              </div>
            );
          }
          // Soft amber when only some fail
          if (someError) {
            return (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-sm text-sm flex items-center gap-3">
                <p>{language === 'en'
                  ? `${errorCount} of ${totalCount} assets could not load market data. Other data may be delayed.`
                  : `${errorCount} dari ${totalCount} aset tidak dapat memuat data pasar. Data lain mungkin tertunda.`}
                </p>
              </div>
            );
          }
          if (allFallback) {
            return (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-sm text-sm flex items-center gap-3">
                <p>{language === 'en'
                  ? 'Market data is loading. Showing entry prices as estimates.'
                  : 'Data pasar sedang dimuat. Harga entry ditampilkan sementara.'}
                </p>
              </div>
            );
          }
          if (allDelayed) {
            return (
              <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 p-4 rounded-sm text-sm flex items-center gap-3">
                <p>{language === 'en' ? 'Market data may be delayed.' : 'Data pasar mungkin mengalami keterlambatan.'}</p>
              </div>
            );
          }
          return null;
        })()}

        {enrichedHoldings.length === 0 ? (
          <div className="text-center py-24 space-y-8 animate-in fade-in duration-700">
            <div className="w-16 h-16 border border-white/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-white uppercase">
              {language === 'id' ? 'Mulai Bangun Portofolio Cerdasmu' : 'Start Building Your Smart Portfolio'}
            </h1>
            <p className="text-slate-400 max-w-lg mx-auto text-base md:text-lg leading-relaxed">
              {language === 'id'
                ? 'Tambahkan aset pertamamu untuk mengaktifkan analisis risiko, simulasi pasar, dan wawasan AI secara real-time.'
                : 'Add your first asset to unlock risk analysis, market simulation, and real-time AI insights.'}
            </p>
            <div className="pt-4">
              <button
                className="px-6 py-3 bg-white/5 border border-white/10 rounded-sm text-slate-300 text-sm hover:bg-white/10 transition-colors font-medium"
                onClick={restoreDefaultPositions}
              >
                {language === 'id' ? 'Atau muat portofolio contoh (Demo)' : 'Or load demo portfolio'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <section className="space-y-12 animate-in fade-in duration-700">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-5 max-w-2xl w-full">
              <div className="flex items-center gap-3">
                <span className="label-uppercase">{language === 'id' ? 'Ringkasan Portofolio' : 'Portfolio Summary'}</span>
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                  portfolioHeroInsight?.risk_level === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                  portfolioHeroInsight?.risk_level === 'medium' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                  'bg-teal-500/10 text-teal-400 border-teal-500/20'
                }`}>
                  {language === 'id' ? 'Risiko' : 'Risk'} {portfolioHeroInsight?.risk_level 
                    ? (language === 'id' 
                        ? (portfolioHeroInsight.risk_level === 'high' ? 'Tinggi' : portfolioHeroInsight.risk_level === 'medium' ? 'Menengah' : 'Rendah')
                        : portfolioHeroInsight.risk_level)
                    : (language === 'id' ? 'menghitung' : 'calculating')}
                </span>
              </div>
              <div className="relative p-6 md:p-12 border border-white/20 bg-[#050505] overflow-hidden">
                <div className="relative z-10 space-y-6">
                  <h2 className="text-2xl md:text-4xl font-medium tracking-tight text-white leading-tight">
                    {portfolioHeroInsight?.headline || (language === 'id' ? 'Menganalisis komposisi portofolio Anda...' : 'Analyzing your portfolio composition...')}
                  </h2>
                  {portfolioHeroInsight && (
                    <div className="text-slate-400 font-mono leading-relaxed text-sm md:text-base border-t border-white/10 pt-6">
                      <InsightWithTriggers
                        insightText={[
                          ...(portfolioHeroInsight.reasons || []),
                          portfolioHeroInsight.action || ''
                        ].filter(Boolean).join(' ')}
                        userPlan={userPlan}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="premium-card bg-white/[0.02]">
              <span className="label-uppercase opacity-50">{language === 'id' ? 'Nilai Total' : 'Total Value'}</span>
              <div className="text-xl font-semibold numeric-value mt-3">
                {safeDisplayCurrency(enrichedSummary?.totalCurrentValue, baseCurrency)}
              </div>
            </div>
            <div className="premium-card bg-white/[0.02]">
              <span className="label-uppercase opacity-50">{language === 'id' ? 'Total Modal' : 'Total Invested'}</span>
              <div className="text-xl font-semibold numeric-value mt-3">
                {hasProfitLossData
                  ? safeDisplayCurrency(enrichedSummary?.totalInvested, baseCurrency)
                  : (language === 'id' ? 'Data modal belum siap dihitung' : 'Cost basis not ready')}
              </div>
            </div>
            <div className="premium-card bg-white/[0.02]">
              <span className="label-uppercase opacity-50">{language === 'id' ? 'Imbal Hasil %' : 'Yield %'}</span>
              <div className={`text-xl font-semibold numeric-value mt-3 ${hasProfitLossData && enrichedSummary?.totalPnlPct && enrichedSummary.totalPnlPct >= 0 ? 'text-teal-400' : hasProfitLossData ? 'text-red-400' : 'text-slate-500'}`}>
                {hasProfitLossData
                  ? formatSafePercent(enrichedSummary?.totalPnlPct, 1)
                  : (language === 'id' ? 'Mode alokasi' : 'Allocation mode')}
              </div>
            </div>
            <div className="premium-card bg-white/[0.02]">
              <span className="label-uppercase opacity-50">{language === 'id' ? 'Holding Terbesar' : 'Largest Holding'}</span>
              <div className="text-lg font-semibold tracking-tight mt-3">
                {intelligence.largestPosition ? (
                  `${intelligence.largestPosition.label} / ${formatSafePercent(intelligence.largestPosition.weight, 1)}`
                ) : (
                  <span className="text-sm font-normal text-slate-500 leading-snug block">
                    {language === 'id' ? 'Belum cukup data untuk menentukan aset paling dominan.' : 'Not enough data to determine the most influential asset.'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {enrichedHoldings.length > 0 && (
          <section className="space-y-10 animate-in fade-in duration-1000">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-2">
              <span className="label-uppercase">{language === 'id' ? 'Simulasi Risiko' : 'Risk Simulation'}</span>
                <h3 className="text-2xl font-medium tracking-tight">{language === 'id' ? 'Dampak Skenario Pasar' : 'Market Scenario Impact'}</h3>
              </div>
            </div>

            {/* FREE: single -5% scenario */}
            <div className="premium-card p-0 overflow-hidden bg-white/[0.02] border-white/5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-b border-white/5">
                <div className="p-8 border-r border-white/5 space-y-2">
                  <span className="label-uppercase opacity-40">{language === 'id' ? 'Holding Terbesar' : 'Largest Holding'}</span>
                  <p className="font-medium text-lg">{riskSimulation.largest_holding}</p>
                </div>
                <div className="p-8 border-r border-white/5 space-y-2">
                  <span className="label-uppercase opacity-40">{language === 'id' ? 'Skenario' : 'Scenario'}</span>
                  <p className="font-medium text-lg">{riskSimulation.scenario}</p>
                </div>
                <div className="p-8 border-r border-white/5 space-y-2">
                  <span className="label-uppercase opacity-40">{language === 'id' ? 'Dampak %' : 'Impact %'}</span>
                  <p className="font-medium text-lg numeric-value text-red-400">
                    {riskSimulation.nominal_impact !== null ? `${formatSafeSigned(riskSimulation.impact_percent)}%` : (
                      <span className="text-sm font-normal text-slate-500">
                        {language === 'id' ? 'Sedang dianalisis...' : 'Analyzing...'}
                      </span>
                    )}
                  </p>
                </div>
                <div className="p-8 space-y-2">
                  <span className="label-uppercase opacity-40">{language === 'id' ? 'Dampak Nominal' : 'Nominal Impact'}</span>
                  <p className="font-medium text-lg numeric-value">
                    {riskSimulation.nominal_impact !== null ? `-${safeDisplayCurrency(riskSimulation.nominal_impact, displayCurrency)}` : (
                      <span className="text-sm font-normal text-slate-500 leading-snug block mt-1">
                        {language === 'id' ? 'Dampak belum dapat dihitung dari data saat ini.' : 'Impact cannot be calculated from the current data yet.'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="p-8 bg-white/[0.01]">
                <p className="body-text text-slate-400 italic leading-relaxed">
                  "{riskSimulation.interpretation}"
                </p>
              </div>
            </div>

            {/* PRO: multi-scenario table */}
            <ProGate title={language === 'en' ? 'Deeper scenario simulation: -3%, -5%, and -10%' : 'Simulasi skenario lebih dalam: -3%, -5%, dan -10%'} userPlan={userPlan}>
              <div className="premium-card p-0 overflow-hidden bg-white/[0.02] border-white/5">
                <div className="px-8 pt-6 pb-4 border-b border-white/5">
                  <span className="label-uppercase opacity-50">{copy.advancedScenario}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left p-4 px-8 label-uppercase opacity-40 font-normal">{copy.scenario}</th>
                        <th className="text-right p-4 label-uppercase opacity-40 font-normal">{copy.impactPct}</th>
                        <th className="text-right p-4 px-8 label-uppercase opacity-40 font-normal">{copy.estimatedLoss}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[3, 5, 10].map(pct => {
                        const impact = (enrichedSummary.totalCurrentValue * (pct / 100))
                        const portfolioImpact = riskSimulation.impact_percent
                          ? (pct / 5) * riskSimulation.impact_percent
                          : -pct
                        return (
                          <tr key={pct} className="border-b border-white/[0.04] hover:bg-white/[0.03]">
                            <td className="py-6 px-8 font-mono text-slate-300 text-sm md:text-base">{copy.down} {pct}%</td>
                            <td className="py-6 px-4 text-right numeric-value text-red-400 text-sm md:text-base">{formatSafeSigned(portfolioImpact)}%</td>
                            <td className="py-6 px-8 text-right numeric-value text-slate-300 text-sm md:text-base">-{safeDisplayCurrency(impact, displayCurrency)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-8 py-4 bg-white/[0.01]">
                  <p className="text-xs text-slate-500 leading-relaxed">{copy.scenarioNote}</p>
                </div>
              </div>
            </ProGate>
          </section>
        )}

        {/* PRO: Portfolio Sensitivity per asset */}
        {enrichedHoldings.length > 0 && (
          <section className="space-y-8 animate-in fade-in duration-1000">
            <div className="space-y-2">
              <span className="label-uppercase">{language === 'id' ? 'Sensitivitas' : 'Sensitivity'}</span>
              <h3 className="text-2xl font-medium tracking-tight">{language === 'id' ? 'Kontribusi per Aset' : 'Contribution by Asset'}</h3>
            </div>
            <ProGate title={language === 'id' ? 'Lihat seberapa besar tiap aset memengaruhi pergerakan total portofolio' : 'See how much each asset affects total portfolio movement'} userPlan={userPlan}>
              <div className="space-y-3">
                {enrichedHoldings
                  .slice()
                  .sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0))
                  .map(h => {
                    const weight = enrichedSummary.totalCurrentValue > 0
                      ? (h.currentValue / enrichedSummary.totalCurrentValue) * 100
                      : 0
                    const sensitivity = weight * 0.05 // 5% move on this asset
                    return (
                      <div key={h.id} className="premium-card flex items-center gap-6 bg-white/[0.02]">
                        <div className="w-10 h-10 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center font-bold text-teal-400 text-xs flex-shrink-0">
                          {h.symbol.slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{h.symbol}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-teal-500/60 rounded-full"
                                style={{ width: `${Math.min(weight, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono text-slate-400 tabular-nums">{formatSafePercent(weight, 1)}</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-slate-500">{language === 'id' ? 'Jika turun 5%' : 'If down 5%'}</p>
                          <p className="text-sm font-mono text-red-400 mt-0.5">-{formatSafePercent(sensitivity, 2)}</p>
                        </div>
                      </div>
                    )
                  })
                }
              </div>
            </ProGate>
          </section>
        )}

        <RiskBudgetCard
          snapshot={normalizedSnapshot}
          language={language}
          isPro={isPro}
          onBudgetChange={setRiskBudget}
          onAddAsset={() => document.getElementById('portfolio-form-section')?.scrollIntoView({ behavior: 'smooth' })}
        />

        <PortfolioActionWatchlist
          items={actionWatchlist}
          language={language}
          isPro={isPro}
          onAddAsset={() => document.getElementById('portfolio-form-section')?.scrollIntoView({ behavior: 'smooth' })}
        />

        <DecisionJournal
          snapshot={normalizedSnapshot}
          language={language}
          isPro={isPro}
          riskBudgetEvaluation={riskBudgetEvaluation}
          watchlistItems={actionWatchlist}
        />

        <section className="animate-in fade-in duration-1000">
          <AiChat
            sectionId="portfolio-ask-ting-ai"
            variant="panel"
            language={language}
            portfolio={normalizedPortfolio}
            userPlan={userPlan}
            pageContext="portfolio"
            hasProfitLossData={hasProfitLossData}
            analysisStatus={{
              label: isPro ? copy.portfolioCopilot : copy.basicInsight,
              detail: isPro ? `${copy.portfolioStatus}. ${copy.portfolioCopilotDetail}` : copy.basicInsightDetail
            }}
            insightContext={(intelligence.largestPosition || actionWatchlistContext || decisionJournalContext) ? {
              quickInsight: portfolioHeroInsight?.headline || undefined,
              reality: portfolioHeroInsight?.reasons?.[0] || undefined,
              tradeoff: portfolioHeroInsight?.reasons?.[1] || undefined,
              direction: portfolioHeroInsight?.action || undefined,
              portfolioSummary: [
                `${copy.portfolioSummaryPrefix}: ${enrichedHoldings.length} ${copy.assets}`,
                intelligence.largestPosition
                  ? `${copy.largest}: ${intelligence.largestPosition.label} (${intelligence.largestPosition.weight.toFixed(1)}%)`
                  : '',
                !hasProfitLossData
                  ? copy.allocationOnlyNote
                  : enrichedSummary.totalPnlPct !== 0
                  ? `PnL: ${enrichedSummary.totalPnlPct > 0 ? '+' : ''}${enrichedSummary.totalPnlPct.toFixed(2)}%`
                  : '',
                actionWatchlistContext,
                riskBudgetContext,
                decisionJournalContext
              ].filter(Boolean).join(' | ')
            } : null}
          />
        </section>

        <section className="space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <span className="label-uppercase">{language === 'id' ? 'Manajemen Aset' : 'Asset Management'}</span>
              <h3 className="text-2xl font-medium tracking-tight">{language === 'id' ? 'Daftar Posisi' : 'Position List'}</h3>
            </div>
            <div className="flex gap-3">
              <button 
                className="premium-button px-5 py-3 bg-white/[0.05] text-white border border-white/10 font-medium rounded-sm hover:bg-white/10 transition-all text-sm"
                onClick={restoreDefaultPositions}
              >
                {language === 'id' ? 'Muat portofolio bawaan' : 'Load default portfolio'}
              </button>
              <button 
                className="premium-button px-6 py-3 bg-white text-black font-semibold rounded-sm hover:bg-teal-400 transition-all text-sm shadow-lg shadow-white/5"
                onClick={() => {
                  setEditingHoldingId(null);
                  setForm(initialForm);
                  document.getElementById('portfolio-form-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {language === 'id' ? 'Tambah Posisi Baru' : 'Add New Position'}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {enrichedHoldings.length ? enrichedHoldings.map(holding => (
              <div key={holding.id} className="premium-card flex flex-col lg:flex-row lg:items-center justify-between gap-8 hover:bg-white/[0.07]">
                <div className="flex items-center gap-6 min-w-[240px]">
                  <div className="w-12 h-12 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center font-bold text-teal-400">
                    {normalizeDisplaySymbol(holding.symbol).slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-semibold text-lg tracking-tight flex items-center gap-2">
                      {normalizeDisplaySymbol(holding.symbol)}
                      {getStatusBadge(holding.status, language)}
                      {holding.supportStatus === 'live_data' && getStatusBadge('live', language)}
                      {holding.source === 'manual' && getStatusBadge('manual', language)}
                      {holding.supportStatus === 'data_limited' && getStatusBadge('data_limited', language)}
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{assetTypeLabel(holding.assetType === 'stock' && holding.region === 'ID' ? 'indonesian_stock' : holding.assetType, language)} • {holding.region}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 flex-1">
                  <div>
                    <span className="label-uppercase opacity-40 text-[10px]">{copy.quantity}</span>
                    <p className="numeric-value mt-1">{isSafeNumber(holding.quantity) ? holding.quantity : '—'}</p>
                  </div>
                  <div>
                    <span className="label-uppercase opacity-40 text-[10px]">Entry</span>
                    <p className="numeric-value mt-1">{safeDisplayCurrency(holding.entryPrice, holding.entryCurrency)}</p>
                  </div>
                  <div>
                    <span className="label-uppercase opacity-40 text-[10px]">{copy.latest}</span>
                    <p className={`numeric-value mt-1 ${holding.status === 'fallback' ? 'opacity-80' : ''}`}>
                      {holding.status === 'error' ? '—' : safeDisplayCurrency(holding.latestPrice, holding.assetCurrency)}
                    </p>
                    {/* Show ≈ converted value when asset currency differs from base */}
                    {holding.status !== 'error' && holding.assetCurrency !== baseCurrency && isSafeNumber(holding.currentValue) && (
                      <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                        ≈ {safeDisplayCurrency(holding.currentValue / Math.max(holding.quantity, 1), baseCurrency)}
                      </p>
                    )}
                    {holding.status === 'fallback' && <p className="text-xs text-slate-500 mt-1">{copy.basedOnEstimate}</p>}
                    {holding.status === 'delayed' && <p className="text-xs text-slate-500 mt-1">{copy.delayedData}</p>}
                    {holding.status === 'error' && <p className="text-xs text-slate-500 mt-1">{copy.unavailableData}</p>}
                  </div>
                  <div>
                    <span className="label-uppercase opacity-40 text-[10px]">
                      {!hasProfitLossData
                        ? (language === 'id' ? 'Mode alokasi' : 'Allocation mode')
                        : holding.status === 'fallback' ? 'PnL (estimasi)' : 'PnL'}
                    </span>
                    <p className={`numeric-value mt-1 ${!hasProfitLossData || holding.status === 'error' ? 'text-slate-500' : holding.pnl >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                      {!hasProfitLossData
                        ? (language === 'id' ? 'Belum dihitung' : 'Unavailable')
                        : holding.status === 'error' ? '—' : `${formatSafeSigned(holding.pnlPct)}%`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t lg:border-t-0 pt-4 lg:pt-0 border-white/5">
                  <button className="p-2 text-slate-500 hover:text-white transition-colors" onClick={() => handleStartEdit(holding)}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button className="p-2 text-slate-500 hover:text-red-400 transition-colors" onClick={() => handleDeleteHolding(holding.id)}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            )) : (
              <div className="premium-card text-center py-20 bg-white/[0.01] border-dashed border border-white/10 rounded-none">
                <div className="w-16 h-16 rounded-sm bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <p className="text-slate-300 font-semibold text-lg">{copy.noPositions}</p>
                <p className="text-slate-500 text-sm mt-2 max-w-xs mx-auto leading-relaxed">{copy.addFirstAsset}</p>
                <button
                  id="portfolio-empty-add-cta"
                  type="button"
                  className="mt-6 px-6 py-3 bg-teal-500 hover:bg-teal-400 text-black font-semibold rounded-sm transition-all text-sm shadow-none"
                  onClick={() => document.getElementById('portfolio-form-section')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  {language === 'id' ? '+ Tambahkan Aset Pertama' : '+ Add Your First Asset'}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Upgrade CTA — only shown to free users */}
        {userPlan === 'free' && (
          <div className="max-w-3xl mx-auto">
            <UpgradeSection />
          </div>
        )}
        </>)}

        <section id="portfolio-form-section" className="max-w-3xl mx-auto animate-in fade-in duration-1000">
           <div className="premium-card p-8 md:p-12 space-y-10 bg-white/[0.03]">
              <div className="text-center space-y-2">
                <span className="label-uppercase">{editingHoldingId ? copy.editMode : copy.newRecord}</span>
                <h3 className="text-2xl font-medium tracking-tight">{editingHoldingId ? copy.editPosition : copy.addPosition}</h3>
              </div>

              <form className="space-y-8" onSubmit={handleSubmit}>
                <div className="grid md:grid-cols-3 gap-8">
                  <div className="space-y-4">
                    <label className="label-uppercase opacity-60">{copy.assetSymbol}</label>
                    <input 
                      className="w-full bg-[#0A0A0A] border border-white/10 rounded-sm px-6 py-4 text-white focus:outline-none focus:border-teal-500/40 transition-colors font-mono uppercase"
                      type="text"
                      placeholder={copy.symbolPlaceholder}
                      value={form.symbol} 
                      onChange={e => {
                        const nextSymbol = e.target.value.toUpperCase()
                        const inferredAssetType = inferAssetTypeFromInput(nextSymbol)
                        setForm(p => ({
                          ...p,
                          symbol: nextSymbol,
                          assetType: inferredAssetType !== 'other' ? inferredAssetType : p.assetType,
                          region: inferredAssetType === 'indonesian_stock'
                            ? 'ID'
                            : ['crypto', 'gold', 'us_stock'].includes(inferredAssetType)
                            ? 'GLOBAL'
                            : p.region,
                        }))
                        setResolverCandidate(null)
                        setResolverMessage('')
                      }}
                      required={!manualMode}
                    />
                    {!editingHoldingId && (
                      <button
                        type="button"
                        onClick={() => void resolveAsset()}
                        disabled={resolverLoading}
                        className="w-full text-xs px-4 py-3 rounded-sm border border-teal-400/20 bg-teal-400/10 text-teal-200 hover:bg-teal-400/15 transition-all disabled:opacity-50"
                      >
                        {resolverLoading ? copy.resolvingAsset : copy.resolveAsset}
                      </button>
                    )}
                  </div>
                  <div className="space-y-4">
                    <label className="label-uppercase opacity-60">{copy.category}</label>
                    <select 
                      className="w-full bg-[#0A0A0A] border border-white/10 rounded-sm px-6 py-4 text-white focus:outline-none focus:border-teal-500/40 transition-colors"
                      value={form.assetType} 
                      onChange={e => {
                        const assetType = e.target.value as FormState['assetType']
                        setForm(p => ({ ...p, assetType, region: ['commodity', 'crypto', 'gold', 'us_stock'].includes(assetType) ? 'GLOBAL' : assetType === 'indonesian_stock' ? 'ID' : p.region }))
                        setResolverCandidate(null)
                      }}
                      required
                    >
                      <option value="stock">{copy.stock}</option>
                      <option value="us_stock">{copy.usStock}</option>
                      <option value="indonesian_stock">{language === 'en' ? 'Indonesian stock' : 'Saham Indonesia'}</option>
                      <option value="commodity">{copy.commodity}</option>
                      <option value="crypto">{copy.crypto}</option>
                      <option value="gold">{copy.gold}</option>
                      <option value="cash">{copy.cash}</option>
                      <option value="mutual_fund">{copy.mutualFund}</option>
                      <option value="other">{copy.other}</option>
                    </select>
                  </div>
                  <div className="space-y-4">
                    <label className="label-uppercase opacity-60">{copy.region}</label>
                    <select 
                      className="w-full bg-[#0A0A0A] border border-white/10 rounded-sm px-6 py-4 text-white focus:outline-none focus:border-teal-500/40 transition-colors"
                      value={form.region} 
                      onChange={e => setForm(p => ({ ...p, region: e.target.value as any }))} 
                      required
                    >
                      <option value="ID">Indonesia (ID)</option>
                      <option value="GLOBAL">Global</option>
                    </select>
                  </div>
                </div>

                {resolverCandidate && !manualMode && (
                  <div className="rounded-sm border border-teal-400/20 bg-teal-400/[0.04] p-5 space-y-3">
                    <p className="text-sm font-semibold text-white">
                      {language === 'id' ? 'Apakah ini aset yang kamu maksud?' : 'Is this the asset you mean?'}
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <p className="font-mono text-teal-200 text-lg">{resolverCandidate.symbol}</p>
                        <p className="text-sm text-slate-300">{resolverCandidate.name}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {resolverCandidate.exchange === 'IDX' || resolverCandidate.assetType === 'indonesian_stock'
                            ? (language === 'id' ? 'Saham Indonesia · Live Data' : 'Indonesian stock · Live Data')
                            : `${resolverCandidate.assetType} · Live Data`}
                        </p>
                      </div>
                      <span className="self-start sm:self-center bg-teal-500/10 text-teal-300 border border-teal-500/20 px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider">
                        Live Data
                      </span>
                    </div>
                  </div>
                )}

                {manualMode && (
                  <div className="rounded-sm border border-amber-400/20 bg-amber-400/[0.04] p-5 space-y-5">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-white">{resolverMessage || (language === 'id' ? 'Aset belum ditemukan' : 'Asset not found')}</p>
                      <p className="text-sm text-slate-400 leading-relaxed">
                        {language === 'id'
                          ? 'Kami belum menemukan data market untuk aset ini. Kamu tetap bisa menambahkannya manual agar Ting AI bisa membaca komposisi dan risiko portofolio kamu.'
                          : 'We have not found market data for this asset. You can still add it manually so Ting AI can read your portfolio composition and risk.'}
                      </p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="label-uppercase opacity-60">{copy.assetName}</label>
                        <input
                          className="w-full bg-[#0A0A0A] border border-white/10 rounded-sm px-4 py-3 text-white focus:outline-none focus:border-amber-500/40 transition-colors"
                          value={form.assetName}
                          onChange={e => setForm(p => ({ ...p, assetName: e.target.value }))}
                          placeholder={language === 'id' ? 'Contoh: Bumi Resources' : 'Example: Bumi Resources'}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="label-uppercase opacity-60">{copy.manualValue}</label>
                        <input
                          className="w-full bg-[#0A0A0A] border border-white/10 rounded-sm px-4 py-3 text-white focus:outline-none focus:border-amber-500/40 transition-colors font-mono"
                          type="number"
                          step="any"
                          value={form.manualValue}
                          onChange={e => setForm(p => ({ ...p, manualValue: e.target.value }))}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="label-uppercase opacity-60">{copy.allocationPercent}</label>
                        <input
                          className="w-full bg-[#0A0A0A] border border-white/10 rounded-sm px-4 py-3 text-white focus:outline-none focus:border-amber-500/40 transition-colors font-mono"
                          type="number"
                          min="0"
                          max="99"
                          step="any"
                          value={form.allocationPercent}
                          onChange={e => setForm(p => ({ ...p, allocationPercent: e.target.value }))}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="label-uppercase opacity-60">{copy.note}</label>
                      <textarea
                        className="w-full bg-[#0A0A0A] border border-white/10 rounded-sm px-4 py-3 text-white focus:outline-none focus:border-amber-500/40 transition-colors min-h-[88px]"
                        value={form.note}
                        onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                        placeholder={language === 'id' ? 'Opsional: alasan kamu mencatat aset ini.' : 'Optional: why you track this asset.'}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="bg-slate-500/10 text-slate-300 border border-slate-500/20 px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider">Manual</span>
                      <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider">{language === 'id' ? 'Data terbatas' : 'Limited Data'}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setManualMode(false)
                          setResolverMessage('')
                          setResolverCandidate(null)
                        }}
                        className="text-[11px] text-slate-400 hover:text-white px-3 py-1 rounded-full border border-white/10"
                      >
                        {language === 'id' ? 'Coba format ticker lain' : 'Try another ticker format'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid md:grid-cols-3 gap-8">
                  <div className="space-y-4">
                    <label className="label-uppercase opacity-60">{copy.quantityLot}</label>
                    <input 
                      className="w-full bg-[#0A0A0A] border border-white/10 rounded-sm px-6 py-4 text-white focus:outline-none focus:border-teal-500/40 transition-colors font-mono"
                      type="number" 
                      step="any" 
                      placeholder="0.00"
                      value={form.quantity} 
                      onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} 
                      required={!manualMode}
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="label-uppercase opacity-60">{copy.averagePrice}</label>
                    <input 
                      className="w-full bg-[#0A0A0A] border border-white/10 rounded-sm px-6 py-4 text-white focus:outline-none focus:border-teal-500/40 transition-colors font-mono"
                      type="number" 
                      step="any" 
                      placeholder="0.00"
                      value={form.entryPrice} 
                      onChange={e => setForm(p => ({ ...p, entryPrice: e.target.value }))} 
                      required={!manualMode}
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="label-uppercase opacity-60">{copy.currency}</label>
                    <select 
                      className="w-full bg-[#0A0A0A] border border-white/10 rounded-sm px-6 py-4 text-white focus:outline-none focus:border-teal-500/40 transition-colors"
                      value={form.entryCurrency} 
                      onChange={e => setForm(p => ({ ...p, entryCurrency: e.target.value as any }))} 
                      required
                    >
                      <option value="IDR">IDR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row gap-4">
                  <button className="premium-button flex-1 py-4 bg-white text-black font-bold rounded-sm hover:bg-teal-400 transition-all shadow-none" type="submit">
                    {editingHoldingId ? copy.saveChanges : copy.addToPortfolio}
                  </button>
                  {editingHoldingId && (
                    <button className="px-8 py-4 bg-white/5 text-white font-semibold rounded-sm hover:bg-white/10 transition-all" type="button" onClick={handleCancelEdit}>
                      {copy.cancel}
                    </button>
                  )}
                </div>
              </form>
           </div>
        </section>

        <section className="pt-12 border-t border-white/5">
          <div className="flex flex-col md:flex-row justify-between items-start gap-12">
            <div className="max-w-sm space-y-4">
              <span className="label-uppercase text-slate-600">{copy.dataNote}</span>
              <p className="text-xs text-slate-500 leading-relaxed font-mono">
                {copy.dataNoteBody}
              </p>
            </div>
            <p className="text-[10px] font-mono text-slate-700 md:text-right">
              Ting AI Intelligence Hub · Personal Workspace · v2.0
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
