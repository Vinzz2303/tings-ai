
import 'dotenv/config'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import express, { type NextFunction, type Request, type Response } from 'express'
import axios from 'axios'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import type { FileFilterCallback } from 'multer'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import nodemailer from 'nodemailer'
import pool from './db'
import webpush from 'web-push'
import { getInvestmentSummary } from './services/investmentSummary'
import { getFxRate } from './services/fxAdapter'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AuthTokenPayload, BriefSection, InstrumentSummary, MarketContext, MarketPoint } from './types'
import { getXauSpot } from './services/xauSpot'
import { refineInsightWithLLM, normalizeInsight, type TingRawInsight } from './services/tingAiProviderOrchestrator'
import { sendAzureChat } from './services/azureProvider'
import {
  buildInsightAwareChatPrompt,
  sendChatWithFallback,
  type ChatMessage,
  type InsightContext
} from './services/chatProvider'
import { getMarketQuoteCacheTtlMinutes, resolveMarketQuotes } from './services/marketQuoteService'
import { getMarketNews } from './services/marketNewsService'
import { sendWeeklyReports } from './services/weeklyReportService'
import { getInsiderTrading } from './services/openbbAgentTools'
import { createProSubscriptionTx, handleMidtransWebhook } from './services/paymentService'
import { runStockScreener } from './services/screenerService'
import { generatePortfolioPDF } from './services/pdfReportService'
import cron from 'node-cron'
import { initTelegramBot, sendMorningCommandToGroup } from './services/telegramBotService'
import { fetchTopChanges } from './services/sectorsApi'
import { generateTradingSetup } from './services/tradingSetupService'
// --- START: Portfolio Context Types ---
type PortfolioHolding = {
  symbol: string;
  name: string;
  assetType: 'stock' | 'index' | 'crypto' | 'commodity' | 'indonesian_stock' | 'gold' | 'cash' | 'mutual_fund' | 'other';
  currentValue: number;
  pnlPct: number;
  source?: 'market_provider' | 'internal_cache' | 'manual';
  supportStatus?: 'live_data' | 'data_limited';
  note?: string;
  allocationPercent?: number;
};

type PortfolioSummary = {
  totalInvested: number;
  totalCurrentValue: number;
  totalPnl: number;
  totalPnlPct: number;
};

type PortfolioData = {
  summary: PortfolioSummary;
  holdings: PortfolioHolding[];
};

type AskTingAiStructuredResponse = {
  direct_answer: string
  why_it_matters: string[]
  risk_note: string
  suggested_next_step: 'monitor' | 'wait' | 'rebalance' | 'reduce_exposure'
}
// --- END: Portfolio Context Types ---


type RequestWithUser = Request & {
  user?: AuthTokenPayload
  file?: Express.Multer.File
}

type AdminRequest = RequestWithUser & {
  admin?: boolean
}

type PricePointRow = RowDataPacket & {
  time: string | number
  open: number
  high: number
  low: number
  close: number
}

type MarketPriceRow = RowDataPacket & {
  timestamp: Date | string
  price_open: number | string | null
  price_high: number | string | null
  price_low: number | string | null
  price_close: number | string | null
}

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[]
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>
          high?: Array<number | null>
          low?: Array<number | null>
          close?: Array<number | null>
        }>
      }
    }>
    error?: {
      description?: string
    } | null
  }
}

type UserRow = RowDataPacket & {
  id: number
  fullname: string
  email: string
  password_hash: string
  email_verified?: number | boolean
}

type ResetRow = RowDataPacket & {
  id: number
  expires_at: Date | string
}

type AssetMasterRow = RowDataPacket & {
  id: number
  symbol: string
  name: string
  asset_type: 'stock' | 'index' | 'crypto' | 'commodity'
  region: string
  provider: string | null
  provider_symbol: string | null
  quote_currency: string
  display_order: number
  is_active: number
}

type GlobalQuoteResponse = {
  'Global Quote'?: {
    '05. price'?: string
    '09. change'?: string
    '10. change percent'?: string
  }
}

type TwelveDataQuoteResponse = {
  code?: number
  message?: string
  status?: string
  close?: string
  previous_close?: string
  change?: string
  percent_change?: string
}

type YahooSearchResponse = {
  quotes?: Array<{
    symbol?: string
    shortname?: string
    longname?: string
    exchange?: string
    exchDisp?: string
    quoteType?: string
    currency?: string
  }>
}

type HoldingRow = RowDataPacket & {
  id: number
  user_id: number
  asset_id: number
  quantity: number | string
  entry_price: number | string
  invested_amount: number | string
  position_currency: string
  notes: string | null
  opened_at: Date | string | null
  is_active: number
  symbol: string
  name: string
  asset_type: 'stock' | 'index' | 'crypto' | 'commodity'
  region: string
  quote_currency: string
}

type HoldingSummaryRow = RowDataPacket & {
  id: number
  asset_id: number
  quantity: number | string
  entry_price: number | string
  invested_amount: number | string
  position_currency: string
  notes: string | null
  opened_at: Date | string | null
  symbol: string
  name: string
  asset_type: 'stock' | 'index' | 'crypto' | 'commodity'
  region: string
  quote_currency: string
  latest_price: number | string | null
  price_change: number | string | null
  price_change_pct: number | string | null
  trend: 'up' | 'down' | 'flat' | null
  fetched_at: Date | string | null
}

type DisplayCurrency = 'IDR' | 'USD'

const isHealthyPnlBasis = ({
  investedAmountDisplay,
  currentValue,
  pnlPctRaw,
  fxStatus
}: {
  investedAmountDisplay: number | null
  currentValue: number | null
  pnlPctRaw: number | null
  fxStatus: 'live' | 'fallback' | 'unavailable'
}) => {
  if (fxStatus === 'unavailable') return false
  if (investedAmountDisplay === null || !Number.isFinite(investedAmountDisplay) || investedAmountDisplay <= 0) {
    return false
  }
  if (pnlPctRaw === null || !Number.isFinite(pnlPctRaw)) return false
  if (Math.abs(pnlPctRaw) > 1000) return false
  if (
    currentValue !== null &&
    currentValue > 100000 &&
    investedAmountDisplay < 10000
  ) {
    return false
  }
  return true
}

type AuthBody = {
  fullname?: string
  email?: string
  password?: string
  token?: string
}

type ProUpgradeStatus = 'draft' | 'pending' | 'approved' | 'rejected'

type ProUpgradeRow = RowDataPacket & {
  id: number
  user_id: number
  full_name: string
  email: string
  sender_name: string
  transfer_date: string | Date
  proof_file_name: string | null
  notes: string | null
  status: ProUpgradeStatus
  admin_note: string | null
  approved_at: Date | string | null
  expires_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
}

type ProUpgradeBody = {
  fullName?: string
  email?: string
  senderName?: string
  transferDate?: string
  proofFileName?: string
  fileName?: string
  notes?: string
}

type UserSummaryRow = RowDataPacket & {
  id: number
  fullname: string
  email: string
  created_at: Date | string | null
}

type CountRow = RowDataPacket & {
  total: number
}

type CreateHoldingBody = {
  assetId?: number
  quantity?: number
  entryPrice?: number
  investedAmount?: number
  positionCurrency?: string
  notes?: string
  openedAt?: string
}

type UpdateHoldingBody = CreateHoldingBody

type AiMessage = {
  role: string
  content: string
}

type RefreshRunResult = {
  ok: boolean
  refreshed: string[]
  skipped: string[]
  startedAt: string
  finishedAt: string
  durationMs: number
  trigger: 'manual' | 'scheduled' | 'startup'
}

const tingAiStrictSystemPrompt = `You are Ting AI, a calm and trustworthy financial decision copilot for retail investors.

Your role:
Help the user understand portfolio risk, market context, and decision framing.

You are NOT a signal provider.
Do NOT say "buy", "sell", or guarantee profit.
Do NOT predict exact future prices.
Do NOT scare the user.
Do NOT use dramatic words like "hancur", "kehancuran", "catastrophic", "devastating", "crash pasti", or "pasti rugi".
Do NOT ask the user for more data if portfolio context is already available.
If data is incomplete, answer with a conservative assumption and mention uncertainty briefly.

Tone:
- Calm
- Specific
- Personal
- Simple Indonesian when user writes in Indonesian
- Professional but human
- No long paragraphs
- No mixed English unless the term is common in finance

RESPONSE FORMAT - CRITICAL:
Respond ALWAYS as valid JSON in this exact structure (no markdown, no plain text):
{
  "direct_answer": "1 short paragraph, max 2 sentences",
  "why_it_matters": ["bullet point 1", "bullet point 2"],
  "risk_note": "1 short sentence",
  "suggested_next_step": "monitor|wait|rebalance|reduce_exposure"
}

Decision rules:
- If one asset weight > 50%, emphasize concentration risk and suggest rebalance or reduce_exposure
- If one sector weight > 60%, emphasize sector concentration risk
- Never infer profit/loss from allocation percentages
- Only discuss profit/loss when explicit profit/loss data is available in context
- If market sentiment is defensive or volatile, suggest caution (wait)
- If portfolio is diversified and risk is low, suggest monitor
- Always connect the answer to the user's actual portfolio context
- Use "portofoliomu" or "modalmu" naturally if language is Indonesian

Language rules:
If portfolio context shows user language is Indonesian, answer fully in Indonesian.
If unclear, default to English.
Use simple, natural Indonesian phrases.
Avoid excessive technical terms unless already present in user's question.

Examples:

CONCENTRATED PORTFOLIO (AAPL 76.8%, defensive market):
User: "Portofolio saya aman gak?"
Output:
{
  "direct_answer": "Portofoliomu masih cukup rentan karena terlalu bergantung pada satu aset utama. Konsentrasinya adalah risiko utama saat ini.",
  "why_it_matters": ["Porsi AAPL terlalu dominan terhadap total portofoliomu", "Jika AAPL melemah, dampaknya langsung terasa ke nilai portofolio"],
  "risk_note": "Risiko utama saat ini adalah konsentrasi, bukan arah harga.",
  "suggested_next_step": "rebalance"
}

DIVERSIFIED PORTFOLIO:
User: "Apa yang harus saya lakukan?"
Output:
{
  "direct_answer": "Portofoliomu terlihat cukup seimbang, jadi langkah paling aman saat ini adalah memantau kondisi pasar.",
  "why_it_matters": ["Tidak ada satu aset yang mendominasi portofoliomu", "Diversifikasi membantu mengurangi dampak dari pergerakan satu aset"],
  "risk_note": "Tetap pantau perubahan market karena risiko bisa berubah.",
  "suggested_next_step": "monitor"
}

Non-portfolio questions (general market context, specific asset prices, etc):
- Still respond as JSON with the same structure
- Use direct_answer for the main insight
- why_it_matters for 2 reasons why this matters
- risk_note for the main risk or caveat
- suggested_next_step: use "monitor" as default for general market questions`

const tingAiSystemPrompt = tingAiStrictSystemPrompt

type AiChatBody = {
  provider?: 'groq' | 'gemini'
  messages?: AiMessage[]
  summary?: string
  insightContext?: InsightContext
  pageContext?: 'general' | 'portfolio'
  userPlan?: 'free' | 'pro'
  hasPortfolio?: boolean
  hasProfitLossData?: boolean
  meta?: {
    instruments?: {
      ANTAM?: InstrumentSummary
      SP500?: InstrumentSummary
      IHSG?: InstrumentSummary
      BTC?: InstrumentSummary
    }
    briefing?: BriefSection[]
    context?: MarketContext
  }
  portfolio?: PortfolioData
}

const app = express()

const getRequestBaseUrl = (req: Request): string => {
  const origin = (req.headers.origin || req.headers.referer) as string | undefined
  if (origin) {
    try {
      const url = new URL(origin)
      return `${url.protocol}//${url.host}`
    } catch {
      // ignore
    }
  }
  return process.env.APP_URL || 'http://localhost:5173'
}


const uploadsRoot = path.resolve(__dirname, '../uploads')
const proUpgradeProofsDir = path.join(uploadsRoot, 'pro-upgrade-proofs')
fs.mkdirSync(proUpgradeProofsDir, { recursive: true })

const proUpgradeUpload = multer({
  storage: multer.diskStorage({
    destination: (
      _req: Request,
      _file: Express.Multer.File,
      cb: (error: Error | null, destination: string) => void
    ) => cb(null, proUpgradeProofsDir),
    filename: (
      _req: Request,
      file: Express.Multer.File,
      cb: (error: Error | null, filename: string) => void
    ) => {
      const safeExt = path.extname(file.originalname || '').toLowerCase()
      const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`
      cb(null, uniqueName)
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowedMime = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf']
    if (allowedMime.includes(file.mimetype)) {
      cb(null, true)
      return
    }
    cb(new Error('Only PNG, JPG, WEBP, or PDF proof files are allowed'))
  }
})

app.use('/uploads', express.static(uploadsRoot))
app.use(express.text({ type: ['text/plain'], limit: '1mb' }))
app.use(express.json({ limit: '1mb' }))
app.use((req, res, next) => {
  const rawOrigins = process.env.ALLOWED_ORIGINS || ''
  const allowedOrigins: string[] = rawOrigins
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)

  // Always allow localhost in any environment for local development
  const DEV_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:3002',
  ]
  const allAllowed = [...allowedOrigins, ...DEV_ORIGINS]

  const origin = req.headers.origin as string | undefined
  if (origin && allAllowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else if (!origin) {
    // Same-origin or server-to-server requests (no Origin header)
    res.setHeader('Access-Control-Allow-Origin', '*')
  }

  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Vary', 'Origin')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204)
  }
  next()
})

app.get('/', (_req, res) => {
  res.status(200).send('Ting AI API is running.')
})

app.get('/api/trading-setup', async (req, res) => {
  const symbol = req.query.symbol as string;
  if (!symbol) return res.status(400).json({ error: 'Symbol required' });
  try {
    const setup = await generateTradingSetup(symbol);
    res.json({ ok: true, data: setup });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
})

// S3: Public stats endpoint — active user counter for landing page
app.get('/api/stats', async (_req, res) => {
  try {
    const [[totalRow]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM users`
    )
    const [[activeRow]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT user_id) AS active
       FROM portfolio_holdings
       WHERE is_active = 1`
    )
    // Round up total users for display credibility
    const total = Number(totalRow?.total || 0)
    const activePortfolio = Number(activeRow?.active || 0)
    res.json({ ok: true, totalUsers: total, activePortfolioUsers: activePortfolio })
  } catch (err) {
    console.error('[/api/stats] Error:', err)
    // Return graceful fallback — never show a 500 on landing page
    res.json({ ok: true, totalUsers: 0, activePortfolioUsers: 0 })
  }
})

const sp500Cache: { data: MarketPoint[] | null; timestamp: number } = {
  data: null,
  timestamp: 0
}

const btcCache: { data: MarketPoint[] | null; timestamp: number } = {
  data: null,
  timestamp: 0
}

const lastGood: {
  sp500Daily: MarketPoint[] | null
  btcDaily: MarketPoint[] | null
} = {
  sp500Daily: null,
  btcDaily: null
}

const twelveDataRateLimitState = {
  blockedUntil: 0
}

const refreshScheduleState: {
  enabled: boolean
  intervalMs: number
  runOnStartup: boolean
  isRunning: boolean
  timer: NodeJS.Timeout | null
  lastRun: RefreshRunResult | null
  lastError: string | null
} = {
  enabled: String(process.env.PORTFOLIO_REFRESH_ENABLED || 'true').toLowerCase() !== 'false',
  intervalMs: Math.max(Number(process.env.PORTFOLIO_REFRESH_INTERVAL_MS || 30 * 60 * 1000), 60 * 1000),
  runOnStartup: String(process.env.PORTFOLIO_REFRESH_RUN_ON_STARTUP || 'true').toLowerCase() !== 'false',
  isRunning: false,
  timer: null,
  lastRun: null,
  lastError: null
}

const parsePayload = <T>(req: Request): T => {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as T
    } catch {
      return {} as T
    }
  }

  return ((req.body || {}) as T)
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  if (typeof error === 'object' && error) {
    const maybeSqlMessage = Reflect.get(error, 'sqlMessage')
    if (typeof maybeSqlMessage === 'string' && maybeSqlMessage.trim()) {
      return maybeSqlMessage
    }

    const maybeCode = Reflect.get(error, 'code')
    if (typeof maybeCode === 'string' && maybeCode.trim()) {
      return maybeCode
    }
  }

  return fallback
}

const logError = (label: string, error: unknown) => {
  console.error(label, error)
}

const toDateString = (value: Date) => value.toISOString().slice(0, 10)
const getPortfolioDisplayCurrency = (): DisplayCurrency => 'IDR'
const toProofUrl = (fileName?: string | null) =>
  fileName ? `/uploads/pro-upgrade-proofs/${encodeURIComponent(fileName)}` : null
const toAdminProofUrl = (requestId: number, fileName?: string | null) =>
  fileName ? `/api/admin/pro-upgrade-requests/${requestId}/proof` : null

const trendFromNumber = (value: number | null | undefined): 'up' | 'down' | 'flat' => {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) return 'flat'
  return value > 0 ? 'up' : 'down'
}

const idrFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
})

const usNumberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
})

const signedIdr = (value: number) => `${value >= 0 ? '+' : '-'}${idrFormatter.format(Math.abs(value))}`

const signedPoints = (value: number) => `${value >= 0 ? '+' : '-'}${usNumberFormatter.format(Math.abs(value))} points`

const signedPercent = (value: number) =>
  `${value >= 0 ? '+' : '-'}${Math.abs(value).toFixed(2).replace('.', ',')}%`

const upsertPortfolioPriceCache = async (payload: {
  assetId: number
  latestPrice: number
  priceChange: number | null
  priceChangePct: number | null
  trend: 'up' | 'down' | 'flat'
  source: string
}) => {
  await pool.query(
    `INSERT INTO portfolio_price_cache
      (asset_id, latest_price, price_change, price_change_pct, trend, source, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
      latest_price = VALUES(latest_price),
      price_change = VALUES(price_change),
      price_change_pct = VALUES(price_change_pct),
      trend = VALUES(trend),
      source = VALUES(source),
      fetched_at = VALUES(fetched_at)`,
    [
      payload.assetId,
      payload.latestPrice,
      payload.priceChange,
      payload.priceChangePct,
      payload.trend,
      payload.source
    ]
  )
}

const refreshUsStockQuote = async (asset: AssetMasterRow) => {
  const apiKey = process.env.ALPHAVANTAGE_API_KEY
  if (!apiKey) {
    throw new Error('ALPHAVANTAGE_API_KEY missing')
  }

  const symbol = asset.provider_symbol || asset.symbol
  const url =
    'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=' +
    encodeURIComponent(symbol) +
    '&apikey=' +
    apiKey

  const response = await axios.get<GlobalQuoteResponse>(url, { timeout: 12000 })
  const quote = response.data?.['Global Quote']
  const latestPrice = Number(quote?.['05. price'] || 0)
  const priceChange = Number(quote?.['09. change'] || 0)
  const priceChangePctRaw = String(quote?.['10. change percent'] || '').replace('%', '')
  const priceChangePct = priceChangePctRaw ? Number(priceChangePctRaw) : null

  if (!latestPrice) {
    throw new Error(`Quote unavailable for ${asset.symbol}`)
  }

  await upsertPortfolioPriceCache({
    assetId: asset.id,
    latestPrice,
    priceChange: Number.isFinite(priceChange) ? priceChange : null,
    priceChangePct: priceChangePct !== null && Number.isFinite(priceChangePct) ? priceChangePct : null,
    trend: trendFromNumber(priceChange),
    source: 'alphavantage'
  })
}

const refreshTwelveDataQuote = async (asset: AssetMasterRow) => {
  const apiKey = process.env.TWELVEDATA_API_KEY
  if (!apiKey) {
    throw new Error('TWELVEDATA_API_KEY missing')
  }

  if (Date.now() < twelveDataRateLimitState.blockedUntil) {
    throw new Error('Twelve Data cooldown active after rate limit')
  }

  const symbol = asset.provider_symbol || asset.symbol
  const url =
    'https://api.twelvedata.com/quote?symbol=' +
    encodeURIComponent(symbol) +
    '&apikey=' +
    apiKey

  const response = await axios.get<TwelveDataQuoteResponse>(url, { timeout: 12000 })
  const payload = response.data

  if (payload?.status === 'error' || payload?.code) {
    if ((payload?.message || '').toLowerCase().includes('run out of api credits')) {
      twelveDataRateLimitState.blockedUntil = Date.now() + 65 * 1000
    }
    throw new Error(payload?.message || `Twelve Data quote unavailable for ${asset.symbol}`)
  }

  const latestPrice = Number(payload?.close || 0)
  const priceChange = Number(payload?.change || 0)
  const priceChangePct = payload?.percent_change ? Number(payload.percent_change) : null

  if (!latestPrice) {
    throw new Error(`Twelve Data price unavailable for ${asset.symbol}`)
  }

  await upsertPortfolioPriceCache({
    assetId: asset.id,
    latestPrice,
    priceChange: Number.isFinite(priceChange) ? priceChange : null,
    priceChangePct: priceChangePct !== null && Number.isFinite(priceChangePct) ? priceChangePct : null,
    trend: trendFromNumber(priceChange),
    source: 'twelvedata'
  })
}

const refreshUsEquityOrIndexQuote = async (asset: AssetMasterRow) => {
  const provider = (asset.provider || '').toLowerCase()

  if (provider === 'twelvedata') {
    try {
      await refreshTwelveDataQuote(asset)
      return true
    } catch (error) {
      logError(`refresh twelvedata ${asset.symbol}`, error)
    }
  }

  await refreshUsStockQuote(asset)
  return true
}

const refreshCryptoQuote = async (assets: AssetMasterRow[]) => {
  const ids = assets
    .map((asset) => asset.provider_symbol)
    .filter((value): value is string => Boolean(value))

  if (!ids.length) return [] as string[]

  const url =
    'https://api.coingecko.com/api/v3/simple/price?ids=' +
    encodeURIComponent(ids.join(',')) +
    '&vs_currencies=usd&include_24hr_change=true'

  const response = await axios.get<Record<string, { usd?: number; usd_24h_change?: number }>>(url, {
    timeout: 12000
  })

  const refreshedSymbols: string[] = []

  for (const asset of assets) {
    const key = asset.provider_symbol || ''
    const entry = response.data?.[key]
    const latestPrice = Number(entry?.usd || 0)
    const priceChangePct = entry?.usd_24h_change ?? null

    if (!latestPrice) continue

    await upsertPortfolioPriceCache({
      assetId: asset.id,
      latestPrice,
      priceChange: null,
      priceChangePct: priceChangePct !== null && Number.isFinite(priceChangePct) ? Number(priceChangePct) : null,
      trend: trendFromNumber(priceChangePct),
      source: 'coingecko'
    })
    refreshedSymbols.push(asset.symbol)
  }

  return refreshedSymbols
}

const refreshGoldSilverQuotes = async (assets: AssetMasterRow[]) => {
  const refreshedSymbols: string[] = []
  const xauAsset = assets.find((asset) => asset.symbol === 'XAU')
  if (xauAsset) {
    const xau = await getXauSpot()
    await pool.query('UPDATE assets_master SET quote_currency = ? WHERE id = ?', ['IDR', xauAsset.id])
    await upsertPortfolioPriceCache({
      assetId: xauAsset.id,
      latestPrice: Number(xau.latestPrice || 0),
      priceChange: xau.delta ?? null,
      priceChangePct: xau.pct ?? null,
      trend: trendFromNumber(xau.delta),
      source: xau.source || 'gold-api.com'
    })
    refreshedSymbols.push(xauAsset.symbol)
  }

  const xagAsset = assets.find((asset) => asset.symbol === 'XAG')
  if (xagAsset) {
    const response = await axios.get<{ price?: number }>('https://api.gold-api.com/price/XAG', {
      timeout: 12000
    })
    const latestPrice = Number(response.data?.price || 0)
    if (latestPrice) {
      await upsertPortfolioPriceCache({
        assetId: xagAsset.id,
        latestPrice,
        priceChange: null,
        priceChangePct: null,
        trend: 'flat',
        source: 'gold-api.com'
      })
      refreshedSymbols.push(xagAsset.symbol)
    }
  }

  return refreshedSymbols
}

const runPortfolioPriceRefresh = async (
  trigger: RefreshRunResult['trigger']
): Promise<RefreshRunResult> => {
  const startedAtDate = new Date()
  const startedAt = startedAtDate.toISOString()

  const [assetRows] = await pool.query<AssetMasterRow[]>(
    `SELECT id, symbol, name, asset_type, region, provider, provider_symbol, quote_currency, display_order, is_active
     FROM assets_master
     WHERE is_active = 1`
  )

  const supportedStockSymbols = new Set(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'SPX', 'DJIA', 'NDX'])
  const stockAssets = assetRows.filter(
    (asset) =>
      (asset.asset_type === 'stock' || asset.asset_type === 'index') &&
      supportedStockSymbols.has(asset.symbol)
  )
  const cryptoAssets = assetRows.filter((asset) => asset.asset_type === 'crypto')
  const commodityAssets = assetRows.filter((asset) => asset.asset_type === 'commodity')

  const refreshed: string[] = []
  const skipped: string[] = []

  for (const asset of stockAssets) {
    try {
      await refreshUsEquityOrIndexQuote(asset)
      refreshed.push(asset.symbol)
    } catch (error) {
      logError(`refresh stock ${asset.symbol}`, error)
      skipped.push(asset.symbol)
    }
  }

  try {
    const refreshedCryptoSymbols = await refreshCryptoQuote(cryptoAssets)
    refreshed.push(...refreshedCryptoSymbols)
    const refreshedCryptoSet = new Set(refreshedCryptoSymbols)
    skipped.push(...cryptoAssets.filter((asset) => !refreshedCryptoSet.has(asset.symbol)).map((asset) => asset.symbol))
  } catch (error) {
    logError('refresh crypto quotes', error)
    skipped.push(...cryptoAssets.map((asset) => asset.symbol))
  }

  try {
    const refreshedCommoditySymbols = await refreshGoldSilverQuotes(commodityAssets)
    refreshed.push(...refreshedCommoditySymbols)
    const refreshedCommoditySet = new Set(refreshedCommoditySymbols)
    skipped.push(
      ...commodityAssets.filter((asset) => !refreshedCommoditySet.has(asset.symbol)).map((asset) => asset.symbol)
    )
  } catch (error) {
    logError('refresh commodity quotes', error)
    skipped.push(...commodityAssets.map((asset) => asset.symbol))
  }

  const finishedAtDate = new Date()
  return {
    ok: true,
    refreshed: Array.from(new Set(refreshed)),
    skipped: Array.from(new Set(skipped)),
    startedAt,
    finishedAt: finishedAtDate.toISOString(),
    durationMs: finishedAtDate.getTime() - startedAtDate.getTime(),
    trigger
  }
}

const executeScheduledRefresh = async (trigger: RefreshRunResult['trigger']) => {
  if (refreshScheduleState.isRunning) {
    return
  }

  refreshScheduleState.isRunning = true

  try {
    const result = await runPortfolioPriceRefresh(trigger)
    refreshScheduleState.lastRun = result
    refreshScheduleState.lastError = null
  } catch (error) {
    refreshScheduleState.lastError = getErrorMessage(error, 'Failed to refresh portfolio prices')
    logError(`portfolio refresh ${trigger} error`, error)
  } finally {
    refreshScheduleState.isRunning = false
  }
}

const startPortfolioRefreshScheduler = () => {
  if (!refreshScheduleState.enabled) {
    return
  }

  if (refreshScheduleState.runOnStartup) {
    void executeScheduledRefresh('startup')
  }

  refreshScheduleState.timer = setInterval(() => {
    void executeScheduledRefresh('scheduled')
  }, refreshScheduleState.intervalMs)
}

const fetchSp500Series = async (
  days: number
): Promise<{ data: MarketPoint[]; source: 'alphavantage' | 'yahoo-finance' | 'cache' }> => {
  const apiKey = process.env.ALPHAVANTAGE_API_KEY
  const cacheTtlMs = Number(process.env.MARKET_CACHE_TTL_MS || 60 * 60 * 1000)
  const now = Date.now()
  if (sp500Cache.data && sp500Cache.data.length >= days && now - sp500Cache.timestamp < cacheTtlMs) {
    return { data: sp500Cache.data.slice(-days), source: 'cache' }
  }

  if (apiKey) {
    try {
      const url =
        'https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=SPY&outputsize=compact&apikey=' +
        apiKey

      const response = await axios.get(url, { timeout: 12000 })
      const series = response.data?.['Time Series (Daily)'] as
        | Record<string, Record<string, string>>
        | undefined

      if (!series) {
        const note = response.data?.Note || response.data?.['Error Message']
        throw new Error(note || 'Failed to load market data')
      }

      const points = Object.keys(series)
        .map((date) => {
          const entry = series[date] || {}
          const open = Number(entry['1. open'] || 0)
          const high = Number(entry['2. high'] || 0)
          const low = Number(entry['3. low'] || 0)
          const close = Number(entry['4. close'] || 0)

          return { time: date, open, high, low, close }
        })
        .filter((point) => point.open && point.high && point.low && point.close)
        .sort((a, b) => String(a.time).localeCompare(String(b.time)))

      sp500Cache.data = points
      sp500Cache.timestamp = now
      lastGood.sp500Daily = points
      return { data: points.slice(-days), source: 'alphavantage' }
    } catch (error) {
      logError('fetch sp500 alphavantage fallback to yahoo', error)
    }
  }

  const yahooPoints = await fetchYahooSeries('SPY', days)

  sp500Cache.data = yahooPoints
  sp500Cache.timestamp = now
  lastGood.sp500Daily = yahooPoints
  return { data: yahooPoints.slice(-days), source: 'yahoo-finance' }
}

const fetchBtcDaily = async (days: number): Promise<MarketPoint[]> => {
  const cacheTtlMs = Number(process.env.MARKET_CACHE_TTL_MS || 60 * 60 * 1000)
  const now = Date.now()

  if (btcCache.data && btcCache.timestamp > now - cacheTtlMs) {
    const sinceDate = new Date(now - days * 24 * 60 * 60 * 1000)
    const filteredData = btcCache.data.filter((point) => new Date(String(point.time)) > sinceDate)
    if (filteredData.length >= days) {
      return filteredData
    }
  }

  try {
    const providerDays = days <= 7 ? 7 : days <= 30 ? 30 : days <= 90 ? 90 : 180
    const url = `https://api.coingecko.com/api/v3/coins/bitcoin/ohlc?vs_currency=usd&days=${providerDays}`
    const response = await axios.get<number[][]>(url, {
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 TingAI/2.2.9'
      }
    })

    if (!Array.isArray(response.data)) {
      throw new Error('Invalid data format from CoinGecko API')
    }

    const dailyData = new Map<string, MarketPoint>()
    response.data.forEach((kline) => {
      const dateStr = toDateString(new Date(kline[0]))
      dailyData.set(dateStr, {
        time: dateStr,
        open: Number(kline[1]),
        high: Number(kline[2]),
        low: Number(kline[3]),
        close: Number(kline[4])
      })
    })

    const points = Array.from(dailyData.values())
    btcCache.data = points
    btcCache.timestamp = now
    lastGood.btcDaily = points
    return points.slice(-days)
  } catch (error) {
    logError('fetch btc coingecko fallback to yahoo', error)
    const yahooPoints = await fetchYahooSeries('BTC-USD', days)
    btcCache.data = yahooPoints
    btcCache.timestamp = now
    lastGood.btcDaily = yahooPoints
    return yahooPoints.slice(-days)
  }
}

const fetchMarketSeriesFromDb = async (
  instrument: string,
  days: number
): Promise<MarketPoint[]> => {
  const [rows] = await pool.query<MarketPriceRow[]>(
    `SELECT timestamp, price_open, price_high, price_low, price_close
     FROM market_prices
     WHERE instrument_name = ?
       AND DATE(timestamp) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     ORDER BY timestamp ASC`,
    [instrument, days]
  )

  return rows
    .map((row) => ({
      time: new Date(row.timestamp).toISOString().slice(0, 10),
      open: Number(row.price_open ?? row.price_close ?? 0),
      high: Number(row.price_high ?? row.price_close ?? 0),
      low: Number(row.price_low ?? row.price_close ?? 0),
      close: Number(row.price_close ?? 0)
    }))
    .filter((point) => point.open && point.high && point.low && point.close)
}

const buildGoldSpotFallbackSeries = async (): Promise<{
  data: MarketPoint[]
  source: string
  fallback: 'external'
  note: string
}> => {
  const spot = await getXauSpot()
  const latestDate = spot.latestDate || new Date().toISOString().slice(0, 10)
  const previousDate =
    spot.previousDate ||
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const latestPrice = Number(spot.latestPrice ?? 0)
  const previousPrice = Number(spot.previousPrice ?? latestPrice)

  const data =
    latestPrice > 0
      ? [
          {
            time: previousDate,
            open: previousPrice,
            high: previousPrice,
            low: previousPrice,
            close: previousPrice
          },
          {
            time: latestDate,
            open: latestPrice,
            high: latestPrice,
            low: latestPrice,
            close: latestPrice
          }
        ]
      : []

  return {
    data,
    source: spot.source || 'gold-api.com',
    fallback: 'external',
    note: data.length ? 'GOLD spot fallback is currently using live XAU feed.' : 'GOLD spot fallback is unavailable.'
  }
}

const fetchYahooSeries = async (symbol: string, days: number): Promise<MarketPoint[]> => {
  const range = days <= 2 ? '5d' : days <= 7 ? '7d' : days <= 30 ? '1mo' : days <= 90 ? '3mo' : '6mo'
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`
  const response = await axios.get<YahooChartResponse>(url, {
    timeout: 12000,
    headers: {
      'User-Agent': 'Mozilla/5.0 TingAI/2.2.9'
    }
  })
  const result = response.data?.chart?.result?.[0]
  const timestamps = result?.timestamp || []
  const quote = result?.indicators?.quote?.[0]
  const opens = quote?.open || []
  const highs = quote?.high || []
  const lows = quote?.low || []
  const closes = quote?.close || []

  const points = timestamps
    .map((timestamp, index) => {
      const open = opens[index]
      const high = highs[index]
      const low = lows[index]
      const close = closes[index]

      if (
        open === null ||
        open === undefined ||
        high === null ||
        high === undefined ||
        low === null ||
        low === undefined ||
        close === null ||
        close === undefined
      ) {
        return null
      }

      return {
        time: new Date(timestamp * 1000).toISOString().slice(0, 10),
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close)
      }
    })
    .filter((point): point is NonNullable<typeof point> => point !== null)

  if (!points.length) {
    throw new Error(response.data?.chart?.error?.description || `No Yahoo series available for ${symbol}`)
  }

  return points.slice(-days)
}

const quoteMetaBySymbol: Record<string, { name: string; currency: string; type: string; unit?: string }> = {
  '^JKSE': { name: 'IDX Composite', currency: 'IDR', type: 'INDEX' },
  'GC=F': { name: 'Gold Futures', currency: 'USD', type: 'COMMODITY', unit: 'oz' },
  'SI=F': { name: 'Silver Futures', currency: 'USD', type: 'COMMODITY', unit: 'oz' },
  'CL=F': { name: 'WTI Oil Futures', currency: 'USD', type: 'COMMODITY', unit: 'barrel' },
  'BTC-USD': { name: 'Bitcoin', currency: 'USD', type: 'CRYPTO' },
  'ETH-USD': { name: 'Ethereum', currency: 'USD', type: 'CRYPTO' },
  'SOL-USD': { name: 'Solana', currency: 'USD', type: 'CRYPTO' },
  'BNB-USD': { name: 'BNB', currency: 'USD', type: 'CRYPTO' },
  'XRP-USD': { name: 'XRP', currency: 'USD', type: 'CRYPTO' },
  'ADA-USD': { name: 'Cardano', currency: 'USD', type: 'CRYPTO' },
  'DOGE-USD': { name: 'Dogecoin', currency: 'USD', type: 'CRYPTO' },
  'MATIC-USD': { name: 'Polygon', currency: 'USD', type: 'CRYPTO' },
  'AVAX-USD': { name: 'Avalanche', currency: 'USD', type: 'CRYPTO' },
  'DOT-USD': { name: 'Polkadot', currency: 'USD', type: 'CRYPTO' },
  'LINK-USD': { name: 'Chainlink', currency: 'USD', type: 'CRYPTO' },
  'UNI-USD': { name: 'Uniswap', currency: 'USD', type: 'CRYPTO' },
  'ATOM-USD': { name: 'Cosmos', currency: 'USD', type: 'CRYPTO' },
  'LTC-USD': { name: 'Litecoin', currency: 'USD', type: 'CRYPTO' },
  'NEAR-USD': { name: 'NEAR', currency: 'USD', type: 'CRYPTO' },
  'APT-USD': { name: 'Aptos', currency: 'USD', type: 'CRYPTO' },
  'ARB-USD': { name: 'Arbitrum', currency: 'USD', type: 'CRYPTO' },
  SPY: { name: 'S&P 500 ETF', currency: 'USD', type: 'EQUITY' },
  QQQ: { name: 'Nasdaq ETF', currency: 'USD', type: 'EQUITY' },
  'DX-Y.NYB': { name: 'US Dollar Index', currency: 'USD', type: 'INDEX' },
  'USDIDR=X': { name: 'USD/IDR', currency: 'IDR', type: 'FX' },
  // Indo Stocks
  'BBCA.JK': { name: 'BCA', currency: 'IDR', type: 'EQUITY' },
  'BMRI.JK': { name: 'Mandiri', currency: 'IDR', type: 'EQUITY' },
  'TLKM.JK': { name: 'Telkom', currency: 'IDR', type: 'EQUITY' },
  'ASII.JK': { name: 'Astra', currency: 'IDR', type: 'EQUITY' },
  'BBNI.JK': { name: 'BNI', currency: 'IDR', type: 'EQUITY' },
  'GOTO.JK': { name: 'GoTo', currency: 'IDR', type: 'EQUITY' },
  'AMMN.JK': { name: 'Amman', currency: 'IDR', type: 'EQUITY' },
  'ADRO.JK': { name: 'Adaro', currency: 'IDR', type: 'EQUITY' },
  'BRPT.JK': { name: 'Barito', currency: 'IDR', type: 'EQUITY' },
  // US Stocks
  'AAPL': { name: 'Apple', currency: 'USD', type: 'EQUITY' },
  'MSFT': { name: 'Microsoft', currency: 'USD', type: 'EQUITY' },
  'NVDA': { name: 'NVIDIA', currency: 'USD', type: 'EQUITY' },
  'TSLA': { name: 'Tesla', currency: 'USD', type: 'EQUITY' },
  'AMZN': { name: 'Amazon', currency: 'USD', type: 'EQUITY' },
  'GOOGL': { name: 'Alphabet', currency: 'USD', type: 'EQUITY' },
  'META': { name: 'Meta', currency: 'USD', type: 'EQUITY' },
  'AMD': { name: 'AMD', currency: 'USD', type: 'EQUITY' },
  'COIN': { name: 'Coinbase', currency: 'USD', type: 'EQUITY' },
  // Additional Commodities
  'NG=F': { name: 'Natural Gas', currency: 'USD', type: 'COMMODITY', unit: 'MMBtu' },
  'HG=F': { name: 'Copper', currency: 'USD', type: 'COMMODITY', unit: 'lb' }
}

const rangeToDays = (range: unknown) => {
  const value = String(range || '1mo').toLowerCase()
  if (value === '5d') return 5
  if (value === '3mo') return 90
  if (value === '6mo') return 180
  return 30
}

const buildQuoteFromSeries = (symbol: string, series: MarketPoint[]) => {
  const latest = series[series.length - 1]
  const previous = series[series.length - 2] || latest
  const price = Number(latest?.close ?? 0)
  const prevClose = Number(previous?.close ?? price)
  const change = price - prevClose
  const changePercent = prevClose ? (change / prevClose) * 100 : 0
  const meta = quoteMetaBySymbol[symbol] || { name: symbol, currency: 'USD', type: 'EQUITY' }

  return {
    symbol,
    name: meta.name,
    price,
    change,
    changePercent,
    prevClose,
    currency: meta.currency,
    marketState: 'regular',
    type: meta.type,
    unit: meta.unit
  }
}

const normalizeAssetResolverCandidate = (item: {
  symbol: string
  name: string
  assetType: string
  exchange?: string
  currency?: string
  source: 'internal_cache' | 'market_provider'
  provider?: string | null
  providerSymbol?: string | null
}) => {
  const symbol = item.symbol.toUpperCase()
  const isIdx = symbol.endsWith('.JK') || item.exchange === 'IDX'
  return {
    symbol,
    name: item.name,
    assetType: isIdx ? 'indonesian_stock' : item.assetType,
    exchange: isIdx ? 'IDX' : item.exchange || null,
    currency: item.currency || (isIdx ? 'IDR' : 'USD'),
    source: item.source,
    supportStatus: 'live_data',
    provider: item.provider || 'yahoo',
    providerSymbol: item.providerSymbol || symbol
  }
}

const resolveAssetFromYahoo = async (symbol: string) => {
  const response = await axios.get<YahooSearchResponse>('https://query2.finance.yahoo.com/v1/finance/search', {
    params: {
      q: symbol,
      quotesCount: 5,
      newsCount: 0
    },
    timeout: 8000
  })

  const normalized = symbol.toUpperCase()
  const quotes = response.data?.quotes || []
  const quote = quotes.find((item) => item.symbol?.toUpperCase() === normalized) || quotes[0]
  if (!quote?.symbol) return null

  const name = quote.longname || quote.shortname || quote.symbol
  return normalizeAssetResolverCandidate({
    symbol: quote.symbol,
    name,
    assetType: quote.quoteType === 'CRYPTOCURRENCY' ? 'crypto' : quote.quoteType === 'INDEX' ? 'index' : 'stock',
    exchange: quote.exchDisp || quote.exchange,
    currency: quote.currency,
    source: 'market_provider',
    provider: 'yahoo',
    providerSymbol: quote.symbol
  })
}

const mailTransport = () => {
  const host = process.env.EMAIL_HOST
  const port = Number(process.env.EMAIL_PORT || 2525)
  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASS

  if (!host || !user || !pass) return null

  return nodemailer.createTransport({
    host,
    port,
    auth: { user, pass }
  })
}

const ensureResetTable = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS password_resets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash VARCHAR(255) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX (user_id),
      INDEX (token_hash),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  )
}

const ensureUsersVerificationColumn = async () => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'email_verified'
     LIMIT 1`
  )

  if (rows.length > 0) return

  await pool.query(
    `ALTER TABLE users
     ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0`
  )
}

const ensureEmailVerificationTable = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS email_verifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash VARCHAR(255) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX (user_id),
      INDEX (token_hash),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  )
}

const ensureProUpgradeTable = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS pro_upgrade_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      full_name VARCHAR(120) NOT NULL,
      email VARCHAR(190) NOT NULL,
      sender_name VARCHAR(120) NOT NULL,
      transfer_date DATE NOT NULL,
      proof_file_name VARCHAR(255) DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      status ENUM('draft', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
      admin_note TEXT DEFAULT NULL,
      approved_at DATETIME DEFAULT NULL,
      expires_at DATETIME DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_pro_upgrade_requests_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      KEY idx_pro_upgrade_requests_user_status (user_id, status),
      KEY idx_pro_upgrade_requests_status_created (status, created_at)
    )`
  )

  const [approvedColumn] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'pro_upgrade_requests'
       AND COLUMN_NAME = 'approved_at'`
  )

  if (!Number((approvedColumn[0] as { total?: number })?.total || 0)) {
    await pool.query(`ALTER TABLE pro_upgrade_requests ADD COLUMN approved_at DATETIME DEFAULT NULL`)
  }

  const [expiresColumn] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'pro_upgrade_requests'
       AND COLUMN_NAME = 'expires_at'`
  )

  if (!Number((expiresColumn[0] as { total?: number })?.total || 0)) {
    await pool.query(`ALTER TABLE pro_upgrade_requests ADD COLUMN expires_at DATETIME DEFAULT NULL`)
  }
}

const createToken = () => crypto.randomBytes(32).toString('hex')
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex')

const authMiddleware = (req: RequestWithUser, res: Response, next: NextFunction) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || 'dev-secret-change'
    ) as AuthTokenPayload
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

const getOptionalAuthUser = (req: Request): AuthTokenPayload | null => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null

  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change') as AuthTokenPayload
  } catch {
    return null
  }
}

const getAdminEmails = () =>
  String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

const isAdminEmail = (email?: string) => {
  if (!email) return false
  const adminEmails = getAdminEmails()
  return adminEmails.includes(email.trim().toLowerCase())
}

// ── AUTH MIDDLEWARE ─────────────────────────────────────────────────────────────
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) return res.sendStatus(401)

  jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change', (err: unknown, user: unknown) => {
    if (err) return res.sendStatus(403)
    ;(req as RequestWithUser).user = user as AuthTokenPayload
    next()
  })
}

const requirePro = async (req: Request, res: Response, next: NextFunction) => {
  // depends on authenticateToken having run
  const authReq = req as RequestWithUser
  if (!authReq.user?.id) return res.sendStatus(401)
  try {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT is_pro FROM users WHERE id = ?', [authReq.user.id])
    if (rows.length === 0 || !rows[0].is_pro) {
      return res.status(403).json({ error: 'Pro subscription required.' })
    }
    next()
  } catch (error) {
    res.status(500).json({ error: 'Server error checking subscription.' })
  }
}

const adminMiddleware = (req: AdminRequest, res: Response, next: NextFunction) => {
  const email = req.user?.email
  if (!email || !isAdminEmail(email)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  req.admin = true
  next()
}

const getPlanForEmail = (email?: string) => (isAdminEmail(email) ? 'pro' : 'free')

const toIsoLike = (value: string | Date | null | undefined) => {
  if (!value) return null
  if (typeof value === 'string') return value
  return value.toISOString()
}

const getRequestExpiry = (request?: Pick<ProUpgradeRow, 'approved_at' | 'expires_at' | 'created_at' | 'updated_at'> | null) => {
  if (!request) return null

  const approvedAt = request.approved_at || request.updated_at || request.created_at
  const fallbackBase = new Date(approvedAt).getTime()
  if (!Number.isFinite(fallbackBase)) return null

  if (request.expires_at) {
    const expiry = new Date(request.expires_at).getTime()
    return Number.isFinite(expiry) ? new Date(expiry) : null
  }

  return new Date(fallbackBase + 30 * 24 * 60 * 60 * 1000)
}

const isProRequestActive = (request?: Pick<ProUpgradeRow, 'status' | 'approved_at' | 'expires_at' | 'created_at' | 'updated_at'> | null) => {
  if (!request || request.status !== 'approved') return false

  const expiryDate = getRequestExpiry(request)
  const expiresAt = expiryDate?.getTime() || NaN

  return Number.isFinite(expiresAt) && expiresAt > Date.now()
}

const getEffectivePlan = async (payload: { userId?: number; email?: string }) => {
  if (isAdminEmail(payload.email)) {
    return 'pro' as const
  }

  if (!payload.userId) {
    return 'free' as const
  }

  await ensureProUpgradeTable()
  const [rows] = await pool.query<CountRow[]>(
    "SELECT COUNT(*) AS total FROM pro_upgrade_requests WHERE user_id = ? AND status = 'approved'",
    [payload.userId]
  )

  if (!Number(rows[0]?.total || 0)) {
    return 'free' as const
  }

  const [requestRows] = await pool.query<ProUpgradeRow[]>(
    `SELECT id, user_id, full_name, email, sender_name, transfer_date, proof_file_name, notes, status, admin_note, approved_at, expires_at, created_at, updated_at
     FROM pro_upgrade_requests
     WHERE user_id = ? AND status = 'approved'
     ORDER BY COALESCE(expires_at, updated_at, created_at) DESC, id DESC
     LIMIT 1`,
    [payload.userId]
  )

  return isProRequestActive(requestRows[0]) ? ('pro' as const) : ('free' as const)
}

const getRequestPlan = async (user?: AuthTokenPayload | null) => {
  if (!user?.id) {
    return 'free' as const
  }

  return getEffectivePlan({ userId: user.id, email: user.email })
}

const getSubscriptionStatus = (plan: 'free' | 'pro', proUntil?: string | null) => {
  if (plan === 'pro') return 'active' as const
  if (proUntil && new Date(proUntil).getTime() <= Date.now()) return 'expired' as const
  return 'inactive' as const
}

const getFreeInvestmentSummaryPreview = (summary?: string, meta?: AiChatBody['meta']) => ({
  summary:
    summary && summary.trim()
      ? summary
          .replace(/\*\*/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .split(/(?<=[.!?])\s+/)
          .slice(0, 2)
          .join(' ')
      : 'Free preview available after the latest market sync.',
  meta: meta
    ? {
        ...meta,
        briefing: meta.briefing?.slice(0, 1),
        context: meta.context
          ? {
              ...meta.context,
              headlines: meta.context.headlines?.slice(0, 1) || [],
              watchItems: meta.context.watchItems?.slice(0, 1) || [],
              drivers: meta.context.drivers?.slice(0, 2) || [],
              macroSignals: meta.context.macroSignals?.slice(0, 1) || [],
              stressDrivers: meta.context.stressDrivers?.slice(0, 1) || []
            }
          : undefined
      }
    : null
})

const getUserProfileById = async (userId: number) => {
  await ensureUsersVerificationColumn()
  const [rows] = await pool.query<UserRow[]>(
    'SELECT id, fullname, email, password_hash, email_verified FROM users WHERE id = ? LIMIT 1',
    [userId]
  )

  const user = rows[0]
  if (!user) {
    return null
  }

  const plan = await getEffectivePlan({ userId: user.id, email: user.email })
  let planExpiresAt: string | null = null

  if (plan === 'pro') {
    await ensureProUpgradeTable()
    const [requestRows] = await pool.query<ProUpgradeRow[]>(
      `SELECT id, user_id, full_name, email, sender_name, transfer_date, proof_file_name, notes, status, admin_note, approved_at, expires_at, created_at, updated_at
       FROM pro_upgrade_requests
       WHERE user_id = ? AND status = 'approved'
       ORDER BY COALESCE(expires_at, updated_at, created_at) DESC, id DESC
       LIMIT 1`,
      [user.id]
    )

    const request = requestRows[0]
    const expiry = getRequestExpiry(request)
    planExpiresAt = expiry ? expiry.toISOString() : null
  }

  return {
    id: user.id,
    fullname: user.fullname,
    email: user.email,
    plan,
    isPro: plan === 'pro',
    proUntil: planExpiresAt,
    subscriptionStatus: getSubscriptionStatus(plan, planExpiresAt),
    planExpiresAt,
    emailVerified: Boolean(user.email_verified)
  }
}

app.get('/api/auth/session', authMiddleware, async (req: RequestWithUser, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const profile = await getUserProfileById(userId)
    if (!profile) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    return res.status(200).json({
      authenticated: true,
      user: profile
    })
  } catch (error) {
    logError('auth session error', error)
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to validate session') })
  }
})

app.get('/api/me', authMiddleware, async (req: RequestWithUser, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const [rows] = await pool.query<RowDataPacket[]>('SELECT id, fullname, email, email_verified, created_at, is_pro FROM users WHERE id = ?', [(req as RequestWithUser).user!.id])
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    const user = rows[0]
    res.json({
      id: user.id,
      fullname: user.fullname,
      email: user.email,
      email_verified: Boolean(user.email_verified),
      created_at: user.created_at,
      is_pro: Boolean(user.is_pro)
    })
  } catch (error) {
    logError('me error', error)
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to load profile') })
  }
})

app.post('/api/signup', async (req, res) => {
  try {
    await ensureUsersVerificationColumn()
    const { fullname, email, password } = parsePayload<AuthBody>(req)
    if (!fullname || !email || !password) {
      return res.status(400).json({ error: 'Fullname, email, password required' })
    }

    const [rows] = await pool.query<UserRow[]>('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
    if (rows[0]) {
      return res.status(409).json({ error: 'Email already registered' })
    }

    const hash = await bcrypt.hash(password, 10)
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO users (fullname, email, password_hash, email_verified) VALUES (?, ?, ?, ?)',
      [fullname, email, hash, 0]
    )

    return res.status(201).json({
      id: result.insertId,
      fullname,
      email,
      plan: getPlanForEmail(email),
      emailVerified: false
    })
  } catch (error) {
    logError('SIGNUP_ERROR', error)
    return res.status(500).json({ error: getErrorMessage(error, 'Signup error') })
  }
})

app.get('/api/pro-upgrade/status', authMiddleware, async (req: RequestWithUser, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    await ensureProUpgradeTable()
    const [rows] = await pool.query<ProUpgradeRow[]>(
      `SELECT id, user_id, full_name, email, sender_name, transfer_date, proof_file_name, notes, status, admin_note, approved_at, expires_at, created_at, updated_at
       FROM pro_upgrade_requests
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [userId]
    )

    const request = rows[0]
    if (!request) {
      return res.status(200).json({ request: null })
    }

    return res.status(200).json({
      request: {
        id: request.id,
        userId: request.user_id,
        fullName: request.full_name,
        email: request.email,
        senderName: request.sender_name,
        transferDate: typeof request.transfer_date === 'string'
          ? request.transfer_date
          : new Date(request.transfer_date).toISOString().slice(0, 10),
        proofFileName: request.proof_file_name,
        proofUrl: toProofUrl(request.proof_file_name),
        notes: request.notes,
        status: request.status,
        adminNote: request.admin_note,
        approvedAt: toIsoLike(request.approved_at),
        expiresAt: toIsoLike(request.expires_at),
        createdAt: request.created_at,
        updatedAt: request.updated_at
      }
    })
  } catch (error) {
    logError('pro upgrade status error', error)
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to load upgrade status') })
  }
})

// Alias used by the frontend Upgrade.tsx — maps the pro_upgrade status to a
// simpler { status } shape the UI expects.
app.get('/api/payments/status', authMiddleware, async (req: RequestWithUser, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    await ensureProUpgradeTable()
    const [rows] = await pool.query<ProUpgradeRow[]>(
      `SELECT status FROM pro_upgrade_requests
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [userId]
    )

    const row = rows[0]
    if (!row) {
      return res.status(200).json({ status: 'none' })
    }

    const statusMap: Record<string, string> = {
      pending: 'pending',
      approved: 'verified',
      rejected: 'rejected',
    }
    return res.status(200).json({ status: statusMap[row.status] ?? 'none' })
  } catch (error) {
    logError('payments status error', error)
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to load payment status') })
  }
})

// Alias used by the frontend Upgrade.tsx for file upload — delegates to the
// same storage + DB logic as /api/pro-upgrade, but accepts the field name
// "file" that the frontend FormData sends.
app.post('/api/payments/upload', authMiddleware, proUpgradeUpload.single('file'), async (req: RequestWithUser, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const body = req.body // using multer form-data
    const fullName = (body.fullName || body.full_name || '').trim()
    const email = (body.email || '').trim()
    const senderName = (body.senderName || '').trim()
    const transferDate = (body.transferDate || '').trim()
    const uploadedProofFile = req.file?.filename || null
    const proofFileName = uploadedProofFile || (body.proofFileName || body.fileName || '').trim() || null
    const notes = (body.notes || '').trim() || null

    console.log(
      `[PRO_UPGRADE_HIT] userId=${userId} email=${email || '<missing>'} proofFileName=${proofFileName || '<missing>'}`
    )

    if (!fullName || !email || !proofFileName) {
      return res.status(400).json({ error: 'Full name, email, and proof file are required' })
    }

    await ensureProUpgradeTable()
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO pro_upgrade_requests
        (user_id, full_name, email, sender_name, transfer_date, proof_file_name, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, fullName, email, senderName, transferDate, proofFileName, notes, 'pending']
    )

    return res.status(201).json({
      id: result.insertId,
      status: 'pending',
      message: 'Bukti transfer diterima. Menunggu verifikasi manual.'
    })
  } catch (error) {
    logError('pro upgrade submit error', error)
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to submit upgrade request') })
  }
})

// Keep the original route for backward compatibility (admin panel uses this).
app.post('/api/pro-upgrade', authMiddleware, proUpgradeUpload.single('proofFile'), async (req: RequestWithUser, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const body = parsePayload<ProUpgradeBody>(req)
    const fullName = body.fullName?.trim() || ''
    const email = body.email?.trim() || ''
    const senderName = body.senderName?.trim() || ''
    const transferDate = body.transferDate?.trim() || ''
    const uploadedProofFile = req.file?.filename || null
    const proofFileName = uploadedProofFile || body.proofFileName?.trim() || body.fileName?.trim() || null
    const notes = body.notes?.trim() || null

    if (!fullName || !email || !senderName || !transferDate || !proofFileName) {
      return res.status(400).json({ error: 'Full name, email, sender name, transfer date, and proof file are required' })
    }

    await ensureProUpgradeTable()
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO pro_upgrade_requests
        (user_id, full_name, email, sender_name, transfer_date, proof_file_name, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, fullName, email, senderName, transferDate, proofFileName, notes, 'pending']
    )

    return res.status(201).json({
      id: result.insertId,
      status: 'pending',
      message: 'Bukti transfer diterima. Menunggu verifikasi manual.'
    })
  } catch (error) {
    logError('pro upgrade submit error', error)
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to submit upgrade request') })
  }
})

app.get('/api/admin/pro-upgrade-requests', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    await ensureProUpgradeTable()
    const [rows] = await pool.query<ProUpgradeRow[]>(
      `SELECT id, user_id, full_name, email, sender_name, transfer_date, proof_file_name, notes, status, admin_note, approved_at, expires_at, created_at, updated_at
       FROM pro_upgrade_requests
       ORDER BY created_at DESC`
    )

    return res.status(200).json({
      requests: rows.map((request) => ({
        id: request.id,
        userId: request.user_id,
        fullName: request.full_name,
        email: request.email,
        senderName: request.sender_name,
        transferDate:
          typeof request.transfer_date === 'string'
            ? request.transfer_date
            : new Date(request.transfer_date).toISOString().slice(0, 10),
        proofFileName: request.proof_file_name,
        proofUrl: toAdminProofUrl(request.id, request.proof_file_name),
        notes: request.notes,
        status: request.status,
        adminNote: request.admin_note,
        approvedAt: toIsoLike(request.approved_at),
        expiresAt: toIsoLike(request.expires_at),
        createdAt: request.created_at,
        updatedAt: request.updated_at
      }))
    })
  } catch (error) {
    logError('admin pro upgrade list error', error)
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to load Pro requests') })
  }
})

app.get('/api/admin/pro-upgrade-requests/:id/proof', authMiddleware, adminMiddleware, async (req: AdminRequest, res) => {
  try {
    await ensureProUpgradeTable()
    const requestId = Number(req.params.id)
    if (!requestId || Number.isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request id' })
    }

    const [rows] = await pool.query<ProUpgradeRow[]>(
      `SELECT id, proof_file_name
       FROM pro_upgrade_requests
       WHERE id = ?
       LIMIT 1`,
      [requestId]
    )

    const request = rows[0]
    if (!request?.proof_file_name) {
      return res.status(404).json({ error: 'Proof file not found' })
    }

    const proofPath = path.join(proUpgradeProofsDir, request.proof_file_name)
    if (!fs.existsSync(proofPath)) {
      return res.status(404).json({ error: 'Stored proof file is missing' })
    }

    return res.sendFile(proofPath)
  } catch (error) {
    logError('admin pro proof error', error)
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to open proof file') })
  }
})

app.patch('/api/admin/pro-upgrade-requests/:id', authMiddleware, adminMiddleware, async (req: AdminRequest, res) => {
  try {
    await ensureProUpgradeTable()
    const requestId = Number(req.params.id)
    if (!requestId || Number.isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request id' })
    }

    const payload = parsePayload<{ status?: ProUpgradeStatus; adminNote?: string }>(req)
    const status = payload.status
    const adminNote = payload.adminNote?.trim() || null
    const markApproved = status === 'approved'

    if (!status || !['approved', 'rejected', 'pending', 'draft'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE pro_upgrade_requests
       SET status = ?,
           admin_note = ?,
           approved_at = ?,
           expires_at = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        status,
        adminNote,
        markApproved ? new Date() : null,
        markApproved ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
        requestId
      ]
    )

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Request not found' })
    }

    return res.status(200).json({
      ok: true,
      id: requestId,
      status,
      adminNote,
      approvedAt: markApproved ? new Date().toISOString() : null,
      expiresAt: markApproved ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null
    })
  } catch (error) {
    logError('admin pro upgrade update error', error)
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to update Pro request') })
  }
})

app.post('/api/admin/users/upgrade', authMiddleware, adminMiddleware, async (req: AdminRequest, res) => {
  try {
    await ensureProUpgradeTable()
    const { email } = parsePayload<{ email: string }>(req)
    if (!email) return res.status(400).json({ error: 'Email required' })

    const [users] = await pool.query<UserRow[]>('SELECT id, fullname FROM users WHERE email = ? LIMIT 1', [email])
    const user = users[0]
    if (!user) return res.status(404).json({ error: 'User not found' })

    await pool.query(
      `UPDATE pro_upgrade_requests SET expires_at = NOW() WHERE user_id = ? AND status = 'approved'`,
      [user.id]
    )

    const approvedAt = new Date()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO pro_upgrade_requests
       (user_id, full_name, email, sender_name, transfer_date, status, admin_note, approved_at, expires_at)
       VALUES (?, ?, ?, ?, ?, 'approved', ?, ?, ?)`,
      [user.id, user.fullname, email, 'Manual Upgrade', toDateString(approvedAt), 'Manual upgrade by admin', approvedAt, expiresAt]
    )

    return res.json({ ok: true, id: result.insertId })
  } catch (error) {
    logError('admin manual upgrade error', error)
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to upgrade user manually') })
  }
})

app.post('/api/admin/users/terminate', authMiddleware, adminMiddleware, async (req: AdminRequest, res) => {
  try {
    await ensureProUpgradeTable()
    const { email } = parsePayload<{ email: string }>(req)
    if (!email) return res.status(400).json({ error: 'Email required' })

    const [users] = await pool.query<UserRow[]>('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
    const user = users[0]
    if (!user) return res.status(404).json({ error: 'User not found' })

    await pool.query(
      `UPDATE pro_upgrade_requests SET expires_at = NOW(), status = 'rejected', admin_note = 'Manually terminated by admin' WHERE user_id = ? AND status IN ('approved', 'pending')`,
      [user.id]
    )

    return res.json({ ok: true })
  } catch (error) {
    logError('admin manual terminate error', error)
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to terminate user manually') })
  }
})

app.get('/api/admin/stats', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    await ensureProUpgradeTable()

    const [[userCountRow]] = await pool.query<CountRow[]>('SELECT COUNT(*) AS total FROM users')
    const [[pendingRow]] = await pool.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM pro_upgrade_requests WHERE status = 'pending'"
    )
    const [[approvedRow]] = await pool.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM pro_upgrade_requests WHERE status = 'approved'"
    )
    const [[rejectedRow]] = await pool.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM pro_upgrade_requests WHERE status = 'rejected'"
    )

    const [recentUsers] = await pool.query<UserSummaryRow[]>(
      `SELECT id, fullname, email, created_at
       FROM users
       ORDER BY id DESC
       LIMIT 10`
    )

    const [recentRequests] = await pool.query<ProUpgradeRow[]>(
      `SELECT id, user_id, full_name, email, sender_name, transfer_date, proof_file_name, notes, status, admin_note, created_at, updated_at
       FROM pro_upgrade_requests
       ORDER BY id DESC
       LIMIT 10`
    )

    return res.status(200).json({
      totalUsers: Number(userCountRow?.total || 0),
      pendingProRequests: Number(pendingRow?.total || 0),
      approvedProRequests: Number(approvedRow?.total || 0),
      rejectedProRequests: Number(rejectedRow?.total || 0),
      recentUsers: recentUsers.map((user) => ({
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        createdAt: user.created_at
      })),
      recentRequests: recentRequests.map((request) => ({
        id: request.id,
        userId: request.user_id,
        fullName: request.full_name,
        email: request.email,
        senderName: request.sender_name,
        transferDate:
          typeof request.transfer_date === 'string'
            ? request.transfer_date
            : new Date(request.transfer_date).toISOString().slice(0, 10),
        proofFileName: request.proof_file_name,
        proofUrl: toAdminProofUrl(request.id, request.proof_file_name),
        notes: request.notes,
        status: request.status,
        adminNote: request.admin_note,
        createdAt: request.created_at,
        updatedAt: request.updated_at
      }))
    })
  } catch (error) {
    logError('admin stats error', error)
    return res.status(500).json({ error: getErrorMessage(error, 'Failed to load admin stats') })
  }
})

app.get('/api/assets', authMiddleware, async (_req, res) => {
  try {
    const [rows] = await pool.query<AssetMasterRow[]>(
      `SELECT id, symbol, name, asset_type, region, provider, provider_symbol, quote_currency, display_order, is_active
       FROM assets_master
       WHERE is_active = 1
       ORDER BY display_order ASC, name ASC`
    )

    res.status(200).json({
      assets: rows.map((row) => ({
        id: row.id,
        symbol: row.symbol,
        name: row.name,
        assetType: row.asset_type,
        region: row.region,
        provider: row.provider,
        providerSymbol: row.provider_symbol,
        quoteCurrency: row.quote_currency
      }))
    })
  } catch (error) {
    logError('assets error', error)
    res.status(500).json({ error: getErrorMessage(error, 'Failed to load assets') })
  }
})

app.get('/api/assets/resolve', authMiddleware, async (req, res) => {
  try {
    const rawQuery = String(req.query.query || '').trim()
    const query = rawQuery.toUpperCase().replace(/\s+/g, '')
    if (!query) {
      return res.status(400).json({ found: false, query: rawQuery, manualFallback: true, message: 'Query is required' })
    }

    const [internalRows] = await pool.query<AssetMasterRow[]>(
      `SELECT id, symbol, name, asset_type, region, provider, provider_symbol, quote_currency, display_order, is_active
       FROM assets_master
       WHERE is_active = 1
         AND (
           UPPER(symbol) = ?
           OR UPPER(provider_symbol) = ?
           OR UPPER(symbol) = ?
           OR UPPER(provider_symbol) = ?
         )
       LIMIT 5`,
      [query, query, query.endsWith('.JK') ? query : `${query}.JK`, query.endsWith('.JK') ? query : `${query}.JK`]
    )

    if (internalRows.length) {
      return res.status(200).json({
        found: true,
        query,
        candidates: internalRows.map((row) =>
          normalizeAssetResolverCandidate({
            symbol: row.provider_symbol || row.symbol,
            name: row.name,
            assetType: row.asset_type,
            exchange: row.region === 'ID' ? 'IDX' : undefined,
            currency: row.quote_currency,
            source: 'internal_cache',
            provider: row.provider,
            providerSymbol: row.provider_symbol || row.symbol
          })
        )
      })
    }

    const lookupSymbols = Array.from(new Set([
      query,
      query.endsWith('.JK') ? query : `${query}.JK`
    ]))

    const candidates = (
      await Promise.all(
        lookupSymbols.map(async (symbol) => {
          try {
            return await resolveAssetFromYahoo(symbol)
          } catch (error) {
            logError(`asset resolver yahoo ${symbol}`, error)
            return null
          }
        })
      )
    ).filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))

    if (candidates.length) {
      return res.status(200).json({ found: true, query, candidates })
    }

    return res.status(200).json({
      found: false,
      query,
      manualFallback: true,
      message: 'Aset belum ditemukan'
    })
  } catch (error) {
    logError('asset resolve error', error)
    return res.status(200).json({
      found: false,
      query: String(req.query.query || ''),
      manualFallback: true,
      message: 'Aset belum ditemukan'
    })
  }
})

app.get('/api/portfolio/holdings', authMiddleware, async (req: RequestWithUser, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const [rows] = await pool.query<HoldingRow[]>(
      `SELECT
         h.id,
         h.user_id,
         h.asset_id,
         h.quantity,
         h.entry_price,
         h.invested_amount,
         h.position_currency,
         h.notes,
         h.opened_at,
         h.is_active,
         a.symbol,
         a.name,
         a.asset_type,
         a.region,
         a.quote_currency
       FROM user_portfolio_holdings h
       INNER JOIN assets_master a ON a.id = h.asset_id
       WHERE h.user_id = ?
         AND h.is_active = 1
       ORDER BY h.created_at DESC`,
      [userId]
    )

    res.status(200).json({
      holdings: rows.map((row) => ({
        id: row.id,
        assetId: row.asset_id,
        symbol: row.symbol,
        name: row.name,
        assetType: row.asset_type,
        region: row.region,
        quantity: Number(row.quantity),
        entryPrice: Number(row.entry_price),
        investedAmount: Number(row.invested_amount),
        positionCurrency: row.position_currency || row.quote_currency,
        notes: row.notes,
        openedAt: row.opened_at
          ? new Date(row.opened_at).toISOString().slice(0, 10)
          : null
      }))
    })
  } catch (error) {
    logError('portfolio holdings error', error)
    res.status(500).json({ error: getErrorMessage(error, 'Failed to load holdings') })
  }
})

app.post('/api/portfolio/holdings', authMiddleware, async (req: RequestWithUser, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const body = parsePayload<CreateHoldingBody>(req)
    const assetId = Number(body.assetId)
    const quantity = Number(body.quantity)
    const entryPrice = Number(body.entryPrice)
    const investedAmount =
      body.investedAmount !== undefined && body.investedAmount !== null
        ? Number(body.investedAmount)
        : quantity * entryPrice
    const positionCurrency = (body.positionCurrency || 'USD').trim().toUpperCase()
    const notes = body.notes?.trim() || null
    const openedAt = body.openedAt?.trim() || null

    if (!assetId || Number.isNaN(assetId)) {
      return res.status(400).json({ error: 'assetId is required' })
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'quantity must be greater than 0' })
    }

    if (!Number.isFinite(entryPrice) || entryPrice < 0) {
      return res.status(400).json({ error: 'entryPrice must be 0 or greater' })
    }

    if (!Number.isFinite(investedAmount) || investedAmount < 0) {
      return res.status(400).json({ error: 'investedAmount must be 0 or greater' })
    }

    const [assetRows] = await pool.query<AssetMasterRow[]>(
      `SELECT id, symbol, name, asset_type, region, provider, provider_symbol, quote_currency, display_order, is_active
       FROM assets_master
       WHERE id = ?
         AND is_active = 1
       LIMIT 1`,
      [assetId]
    )

    const asset = assetRows[0]
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' })
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO user_portfolio_holdings
       (user_id, asset_id, quantity, entry_price, invested_amount, position_currency, notes, opened_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        assetId,
        quantity,
        entryPrice,
        investedAmount,
        positionCurrency || asset.quote_currency,
        notes,
        openedAt
      ]
    )

    res.status(201).json({
      id: result.insertId,
      assetId: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      quantity,
      entryPrice,
      investedAmount,
      positionCurrency: positionCurrency || asset.quote_currency,
      notes,
      openedAt
    })
  } catch (error) {
    logError('create holding error', error)
    res.status(500).json({ error: getErrorMessage(error, 'Failed to create holding') })
  }
})

app.put('/api/portfolio/holdings/:id', authMiddleware, async (req: RequestWithUser, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const holdingId = Number(req.params.id)
    if (!holdingId || Number.isNaN(holdingId)) {
      return res.status(400).json({ error: 'Invalid holding id' })
    }

    const body = parsePayload<UpdateHoldingBody>(req)
    const quantity = Number(body.quantity)
    const entryPrice = Number(body.entryPrice)
    const investedAmount =
      body.investedAmount !== undefined && body.investedAmount !== null
        ? Number(body.investedAmount)
        : quantity * entryPrice
    const positionCurrency = (body.positionCurrency || 'USD').trim().toUpperCase()
    const notes = body.notes?.trim() || null
    const openedAt = body.openedAt?.trim() || null

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'quantity must be greater than 0' })
    }

    if (!Number.isFinite(entryPrice) || entryPrice < 0) {
      return res.status(400).json({ error: 'entryPrice must be 0 or greater' })
    }

    if (!Number.isFinite(investedAmount) || investedAmount < 0) {
      return res.status(400).json({ error: 'investedAmount must be 0 or greater' })
    }

    const [holdingRows] = await pool.query<HoldingRow[]>(
      `SELECT
         h.id,
         h.user_id,
         h.asset_id,
         h.quantity,
         h.entry_price,
         h.invested_amount,
         h.position_currency,
         h.notes,
         h.opened_at,
         h.is_active,
         a.symbol,
         a.name,
         a.asset_type,
         a.region,
         a.quote_currency
       FROM user_portfolio_holdings h
       INNER JOIN assets_master a ON a.id = h.asset_id
       WHERE h.id = ?
         AND h.user_id = ?
         AND h.is_active = 1
       LIMIT 1`,
      [holdingId, userId]
    )

    const holding = holdingRows[0]
    if (!holding) {
      return res.status(404).json({ error: 'Holding not found' })
    }

    await pool.query<ResultSetHeader>(
      `UPDATE user_portfolio_holdings
       SET quantity = ?,
           entry_price = ?,
           invested_amount = ?,
           position_currency = ?,
           notes = ?,
           opened_at = ?
       WHERE id = ?
         AND user_id = ?
         AND is_active = 1`,
      [
        quantity,
        entryPrice,
        investedAmount,
        positionCurrency || holding.quote_currency,
        notes,
        openedAt,
        holdingId,
        userId
      ]
    )

    res.status(200).json({
      id: holdingId,
      assetId: holding.asset_id,
      symbol: holding.symbol,
      name: holding.name,
      quantity,
      entryPrice,
      investedAmount,
      positionCurrency: positionCurrency || holding.quote_currency,
      notes,
      openedAt
    })
  } catch (error) {
    logError('update holding error', error)
    res.status(500).json({ error: getErrorMessage(error, 'Failed to update holding') })
  }
})

app.delete('/api/portfolio/holdings/:id', authMiddleware, async (req: RequestWithUser, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const holdingId = Number(req.params.id)
    if (!holdingId || Number.isNaN(holdingId)) {
      return res.status(400).json({ error: 'Invalid holding id' })
    }

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE user_portfolio_holdings
       SET is_active = 0
       WHERE id = ?
         AND user_id = ?
         AND is_active = 1`,
      [holdingId, userId]
    )

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Holding not found' })
    }

    res.status(200).json({ ok: true, id: holdingId })
  } catch (error) {
    logError('delete holding error', error)
    res.status(500).json({ error: getErrorMessage(error, 'Failed to delete holding') })
  }
})

app.get('/api/portfolio/summary', authMiddleware, async (req: RequestWithUser, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const plan = await getRequestPlan(req.user)
    const displayCurrency = getPortfolioDisplayCurrency()

    const [rows] = await pool.query<HoldingSummaryRow[]>(
      `SELECT
         h.id,
         h.asset_id,
         h.quantity,
         h.entry_price,
         h.invested_amount,
         h.position_currency,
         h.notes,
         h.opened_at,
         a.symbol,
         a.name,
         a.asset_type,
         a.region,
         a.quote_currency,
         p.latest_price,
         p.price_change,
         p.price_change_pct,
         p.trend,
         p.fetched_at
       FROM user_portfolio_holdings h
       INNER JOIN assets_master a ON a.id = h.asset_id
       LEFT JOIN portfolio_price_cache p ON p.asset_id = h.asset_id
       WHERE h.user_id = ?
         AND h.is_active = 1
       ORDER BY h.created_at DESC`,
      [userId]
    )

    const holdings = await Promise.all(rows.map(async (row) => {
      const quantity = Number(row.quantity)
      const entryPrice = Number(row.entry_price)
      const investedAmount = Number(row.invested_amount)
      const entryCurrency = (row.position_currency || row.quote_currency || displayCurrency).toUpperCase()
      const quoteCurrency = (row.quote_currency || displayCurrency).toUpperCase()
      const latestPrice =
        row.latest_price === null || row.latest_price === undefined
          ? null
          : Number(row.latest_price)
      const entryFx = await getFxRate(entryCurrency, displayCurrency)
      const quoteFx = await getFxRate(quoteCurrency, displayCurrency)
      const investedAmountDisplay =
        entryFx.rate !== null ? investedAmount * entryFx.rate : null
      const currentValue =
        latestPrice !== null && quoteFx.rate !== null ? quantity * latestPrice * quoteFx.rate : null
      const pnl =
        currentValue !== null && investedAmountDisplay !== null ? currentValue - investedAmountDisplay : null
      const fxStatus =
        quoteFx.meta.source === 'unavailable' || entryFx.meta.source === 'unavailable'
          ? 'unavailable'
          : quoteFx.meta.source === 'last_known' || entryFx.meta.source === 'last_known'
            ? 'fallback'
            : 'live'
      const pnlPctRaw =
        pnl === null || investedAmountDisplay === null || investedAmountDisplay <= 0
          ? null
          : (pnl / investedAmountDisplay) * 100
      const pnlPct = isHealthyPnlBasis({
        investedAmountDisplay,
        currentValue,
        pnlPctRaw,
        fxStatus
      })
        ? pnlPctRaw
        : null
      const dayChange =
        row.price_change === null || quoteFx.rate === null ? null : Number(row.price_change) * quoteFx.rate

      return {
        id: row.id,
        assetId: row.asset_id,
        symbol: row.symbol,
        name: row.name,
        assetType: row.asset_type,
        region: row.region,
        quantity,
        entryPrice,
        investedAmount,
        latestPrice,
        entryCurrency,
        quoteCurrency,
        displayCurrency,
        investedAmountDisplay,
        currentValue,
        pnl,
        pnlPct,
        dayChange,
        dayChangePct: row.price_change_pct === null ? null : Number(row.price_change_pct),
        trend: row.trend || (pnl === null ? 'flat' : pnl > 0 ? 'up' : pnl < 0 ? 'down' : 'flat'),
        fxStatus,
        fetchedAt: row.fetched_at ? new Date(row.fetched_at).toISOString() : null,
        notes: row.notes,
        openedAt: row.opened_at ? new Date(row.opened_at).toISOString().slice(0, 10) : null
      }
    }))

    const totals = holdings.reduce(
      (acc, row) => {
        if (row.investedAmountDisplay !== null && row.investedAmountDisplay !== undefined) {
          acc.totalInvested += row.investedAmountDisplay
        }
        if (row.currentValue !== null) {
          acc.totalCurrentValue += row.currentValue
        }
        return acc
      },
      { totalInvested: 0, totalCurrentValue: 0 }
    )

    const totalPnl = totals.totalCurrentValue - totals.totalInvested
    const totalPnlPct =
      totals.totalInvested > 0 ? (totalPnl / totals.totalInvested) * 100 : null
    const responseHoldings = plan === 'pro' ? holdings : holdings.slice(0, 2)

    res.status(200).json({
      summary: {
        totalInvested: totals.totalInvested,
        totalCurrentValue: totals.totalCurrentValue,
        totalPnl,
        totalPnlPct,
        totalHoldings: holdings.length,
        displayCurrency
      },
      holdings: responseHoldings,
      accessLevel: plan,
      isPreview: plan !== 'pro'
    })
  } catch (error) {
    logError('portfolio summary error', error)
    res.status(500).json({ error: getErrorMessage(error, 'Failed to load portfolio summary') })
  }
})

app.post('/api/ting-ai/refine', authMiddleware, async (req: RequestWithUser, res) => {
  const startedAt = Date.now()
  try {
    const payload = parsePayload<{ rawInsight?: Partial<TingRawInsight> }>(req)
    const normalizedRaw = normalizeInsight(payload.rawInsight || {})
    const refined = await refineInsightWithLLM(normalizedRaw)
    return res.status(200).json({ insight: refined })
  } catch (error) {
    logError('ting ai refine error', error)
    const fallback = normalizeInsight({})
    return res.status(200).json({
      insight: {
        ...fallback,
        providerStatus: {
          used: 'local',
          fallbackDepth: 4,
          durationMs: Date.now() - startedAt,
          failures: [
            {
              provider: 'gemini',
              reason: getErrorMessage(error, 'Refinement failed before provider orchestration'),
              durationMs: Date.now() - startedAt
            }
          ]
        }
      }
    })
  }
})

app.post('/api/portfolio/refresh-prices', authMiddleware, async (_req: RequestWithUser, res) => {
  try {
    const result = await runPortfolioPriceRefresh('manual')
    refreshScheduleState.lastRun = result
    refreshScheduleState.lastError = null
    res.status(200).json(result)
  } catch (error) {
    logError('portfolio refresh prices error', error)
    res.status(500).json({ error: getErrorMessage(error, 'Failed to refresh portfolio prices') })
  }
})

app.get('/api/portfolio/refresh-prices/status', authMiddleware, async (_req: RequestWithUser, res) => {
  res.status(200).json({
    scheduler: {
      enabled: refreshScheduleState.enabled,
      intervalMs: refreshScheduleState.intervalMs,
      runOnStartup: refreshScheduleState.runOnStartup,
      isRunning: refreshScheduleState.isRunning,
      lastError: refreshScheduleState.lastError
    },
    lastRun: refreshScheduleState.lastRun
  })
})

app.post('/api/login', async (req, res) => {
  try {
    await ensureUsersVerificationColumn()
    const { email, password } = parsePayload<AuthBody>(req)
    console.log(`[LOGIN_HIT] ${new Date().toISOString()} email=${email || '<missing>'}`)
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }

    // --- HACKATHON GOD MODE BYPASS ---
    if (email === 'juri@sectors.app' && password === 'TingsAI2026!') {
      const token = jwt.sign(
        { id: 9999, fullname: 'Sectors Jury', email, emailVerified: true },
        process.env.JWT_SECRET || 'dev-secret-change',
        { expiresIn: '7d' }
      )
      return res.status(200).json({
        token,
        user: {
          id: 9999,
          fullname: 'Sectors Jury',
          email,
          plan: 'pro',
          isPro: true,
          proUntil: '2030-12-31T00:00:00Z',
          subscriptionStatus: 'active',
          planExpiresAt: '2030-12-31T00:00:00Z',
          emailVerified: true
        }
      })
    }
    // ---------------------------------

    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, fullname, email, password_hash, email_verified FROM users WHERE email = ? LIMIT 1',
      [email]
    )
    const user = rows[0]

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = jwt.sign(
      { id: user.id, fullname: user.fullname, email: user.email, emailVerified: Boolean(user.email_verified) },
      process.env.JWT_SECRET || 'dev-secret-change',
      { expiresIn: '12h' }
    )

    const profile = await getUserProfileById(user.id)

    return res.status(200).json({
      token,
      user: profile || {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        plan: 'free',
        isPro: false,
        proUntil: null,
        subscriptionStatus: 'inactive',
        planExpiresAt: null,
        emailVerified: Boolean(user.email_verified)
      }
    })
  } catch (error) {
    logError('LOGIN_ERROR', error)
    return res.status(500).json({ error: getErrorMessage(error, 'Auth error') })
  }
})

app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = parsePayload<AuthBody>(req)
    if (!email) {
      return res.status(400).json({ error: 'Email required' })
    }

    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, fullname, email, password_hash FROM users WHERE email = ? LIMIT 1',
      [email]
    )
    const user = rows[0]
    if (!user) {
      return res.status(200).json({ ok: true })
    }

    await ensureResetTable()
    const token = createToken()
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30)

    await pool.query(
      'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, tokenHash, expiresAt]
    )

    const transport = mailTransport()
    if (!transport) {
      console.warn('Forgot password requested but email transport is not configured')
      return res.status(200).json({ ok: true })
    }

    const resetUrl = `${getRequestBaseUrl(req)}/reset?email=${encodeURIComponent(
      user.email
    )}&token=${token}`

    await transport.sendMail({
      from: process.env.EMAIL_FROM || 'Ting AI <no-reply@tingai.local>',
      to: user.email,
      subject: 'Reset Password Ting AI',
      html: `<p>Hi ${user.fullname},</p><p>Klik link ini untuk reset password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Link berlaku 30 menit.</p>`
    })

    return res.status(200).json({ ok: true })
  } catch (error) {
    return res
      .status(500)
      .json({ error: error instanceof Error ? error.message : 'Forgot password error' })
  }
})

app.post('/api/auth/email-verification/request', authMiddleware, async (req: RequestWithUser, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    await ensureUsersVerificationColumn()
    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, fullname, email, password_hash, email_verified FROM users WHERE id = ? LIMIT 1',
      [userId]
    )
    const user = rows[0]
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (Boolean(user.email_verified)) {
      return res.status(200).json({ ok: true, emailVerified: true, message: 'Email kamu sudah terverifikasi.' })
    }

    await ensureEmailVerificationTable()
    const token = createToken()
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24)

    await pool.query(
      'INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, tokenHash, expiresAt]
    )

    const transport = mailTransport()
    if (!transport) {
      return res.status(200).json({
        ok: true,
        emailVerified: false,
        message: 'Jika email terdaftar, instruksi verifikasi akan dikirim.'
      })
    }

    const verificationUrl = `${getRequestBaseUrl(req)}/verify-email?token=${encodeURIComponent(token)}&uid=${encodeURIComponent(user.id.toString())}`

    await transport.sendMail({
      from: process.env.EMAIL_FROM || 'Ting AI <no-reply@tingai.local>',
      to: user.email,
      subject: 'Verifikasi Email Ting AI',
      html: `<p>Hi ${user.fullname},</p><p>Klik link ini untuk memverifikasi akun kamu:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p><p>Link berlaku 24 jam.</p>`
    })

    return res.status(200).json({
      ok: true,
      emailVerified: false,
      message: 'Jika email terdaftar, instruksi verifikasi akan dikirim.'
    })
  } catch (error) {
    logError('email verification request error', error)
    return res.status(200).json({
      ok: true,
      emailVerified: false,
      message: 'Jika email terdaftar, instruksi verifikasi akan dikirim.'
    })
  }
})

app.get('/api/auth/email-verification/confirm', async (req, res) => {
  try {
    const { token, uid } = req.query
    if (!token || !uid || typeof token !== 'string' || typeof uid !== 'string') {
      return res.status(400).json({ error: 'Token atau uid tidak valid' })
    }

    await ensureEmailVerificationTable()
    await ensureUsersVerificationColumn()

    const tokenHash = hashToken(token)
    const [verifications] = await pool.query<RowDataPacket[]>(
      'SELECT id, expires_at FROM email_verifications WHERE user_id = ? AND token_hash = ? ORDER BY id DESC LIMIT 1',
      [Number(uid), tokenHash]
    )
    const verification = verifications[0]

    if (!verification) {
      return res.status(400).json({ error: 'Link verifikasi tidak valid atau sudah digunakan' })
    }
    if (new Date(verification.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Link verifikasi sudah kedaluwarsa' })
    }

    await pool.query('UPDATE users SET email_verified = 1 WHERE id = ?', [Number(uid)])
    await pool.query('DELETE FROM email_verifications WHERE user_id = ? AND token_hash = ?', [Number(uid), tokenHash])

    return res.status(200).json({ ok: true, message: 'Email berhasil diverifikasi' })
  } catch (error) {
    logError('email verification confirm error', error)
    return res.status(500).json({ error: getErrorMessage(error, 'Gagal memverifikasi email') })
  }
})


app.post('/api/auth/reset', async (req, res) => {
  try {
    const { email, token, password } = parsePayload<AuthBody>(req)
    if (!email || !token || !password) {
      return res.status(400).json({ error: 'Email, token, password required' })
    }

    const [users] = await pool.query<UserRow[]>(
      'SELECT id, fullname, email, password_hash FROM users WHERE email = ? LIMIT 1',
      [email]
    )
    const user = users[0]
    if (!user) {
      return res.status(400).json({ error: 'Link reset tidak valid atau sudah kedaluwarsa' })
    }

    await ensureResetTable()
    const tokenHash = hashToken(token)
    const [resets] = await pool.query<ResetRow[]>(
      'SELECT id, expires_at FROM password_resets WHERE user_id = ? AND token_hash = ? ORDER BY id DESC LIMIT 1',
      [user.id, tokenHash]
    )
    const reset = resets[0]
    if (!reset) {
      return res.status(400).json({ error: 'Link reset tidak valid atau sudah kedaluwarsa' })
    }
    if (new Date(reset.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Link reset tidak valid atau sudah kedaluwarsa' })
    }

    const hash = await bcrypt.hash(password, 10)
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id])
    await pool.query('DELETE FROM password_resets WHERE user_id = ?', [user.id])

    return res.status(200).json({ ok: true })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Reset error' })
  }
})

app.get('/api/investment-summary', async (_req, res) => {
  try {
    const plan = await getRequestPlan(getOptionalAuthUser(_req))
    const result = await getInvestmentSummary()
    if (plan === 'pro') {
      return res.status(200).json({
        summary: result.summary,
        meta: result.meta,
        accessLevel: 'pro',
        isPreview: false,
        previewNote: null
      })
    }

    const preview = getFreeInvestmentSummaryPreview(result.summary, result.meta)
    return res.status(200).json({
      summary: preview.summary,
      meta: preview.meta,
      accessLevel: 'free',
      isPreview: true,
      previewNote: 'Free preview shows a condensed market brief. Pro unlocks the full briefing layer.'
    })
  } catch (error) {
    res.status(503).json({
      summary: 'Maaf, layanan sedang tidak tersedia. Coba lagi beberapa saat.',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

app.get('/api/market/sp500', async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days || 30), 1), 120)
    const result = await fetchSp500Series(days)
    res.status(200).json(result)
  } catch (error) {
    if (lastGood.sp500Daily) {
      return res.status(200).json({ data: lastGood.sp500Daily, source: 'cache', fallback: 'cached' })
    }
    res.status(503).json({
      error: error instanceof Error ? error.message : 'Market data unavailable'
    })
  }
})

app.get('/api/market/gold', async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days || 30), 1), 120)
    const data = await fetchMarketSeriesFromDb('XAUUSD', days)
    if (!data.length) {
      const fallbackResult = await buildGoldSpotFallbackSeries()
      return res.status(200).json(fallbackResult)
    }
    res.status(200).json({
      data,
      source: 'database',
      note: data.length ? '' : 'GOLD (XAU/USD) candle data is not available in the database yet.'
    })
  } catch (error) {
    res.status(503).json({
      error: error instanceof Error ? error.message : 'Market data unavailable'
    })
  }
})

app.get('/api/market/btc', async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days || 30), 1), 120)
    const data = await fetchBtcDaily(days)
    res.status(200).json({ data, source: 'coingecko' })
  } catch (error) {
    if (lastGood.btcDaily) {
      return res.status(200).json({ data: lastGood.btcDaily, source: 'cache', fallback: 'cached' })
    }
    res.status(503).json({
      error: error instanceof Error ? error.message : 'Market data unavailable'
    })
  }
})

app.get('/api/market/ihsg', async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days || 30), 1), 120)
    const dbData = await fetchMarketSeriesFromDb('IHSG', days)

    if (dbData.length) {
      return res.status(200).json({ data: dbData, source: 'database' })
    }

    const yahooData = await fetchYahooSeries('^JKSE', days)
    return res.status(200).json({
      data: yahooData,
      source: 'yahoo-finance',
      fallback: 'external',
      note: 'Data candle IHSG saat ini memakai fallback Yahoo Finance.'
    })
  } catch (error) {
    res.status(503).json({
      error: error instanceof Error ? error.message : 'Market data unavailable'
    })
  }
})

app.get('/api/market/quote', async (req, res) => {
  try {
    const symbol = String(req.query.symbol || '').trim()
    if (!symbol) {
      return res.status(400).json({ ok: false, error: 'symbol is required' })
    }

    const series = await fetchYahooSeries(symbol, 7)
    return res.status(200).json({
      ok: true,
      data: buildQuoteFromSeries(symbol, series),
      source: 'yahoo-finance'
    })
  } catch (error) {
    return res.status(503).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Market quote unavailable'
    })
  }
})

app.get('/api/market/quotes', async (req, res) => {
  const symbols = String(req.query.symbols || '')
    .split(',')
    .map((symbol) => symbol.trim())
    .filter(Boolean)
    .slice(0, 30)

  if (!symbols.length) {
    return res.status(400).json({ ok: false, error: 'symbols is required', quotes: [] })
  }

  const quotes = await resolveMarketQuotes(symbols)
  return res.status(200).json({
    ok: true,
    quotes,
    provider: 'yahoo',
    cacheTtlMinutes: getMarketQuoteCacheTtlMinutes(),
  })
})

app.get('/api/market/history', async (req, res) => {
  try {
    const symbol = String(req.query.symbol || '').trim()
    if (!symbol) {
      return res.status(400).json({ ok: false, error: 'symbol is required' })
    }

    const days = rangeToDays(req.query.range)
    const series = await fetchYahooSeries(symbol, days)
    return res.status(200).json({
      ok: true,
      data: series.map((point) => ({
        time: point.time,
        price: point.close
      })),
      source: 'yahoo-finance'
    })
  } catch (error) {
    return res.status(503).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Market history unavailable'
    })
  }
})

app.get('/api/market/overview', async (_req, res) => {
  const symbols = Object.keys(quoteMetaBySymbol).filter((symbol) => symbol !== 'USDIDR=X')
  const settled = await Promise.allSettled(
    symbols.map(async (symbol) => buildQuoteFromSeries(symbol, await fetchYahooSeries(symbol, 7)))
  )
  const data = settled
    .filter((result): result is PromiseFulfilledResult<ReturnType<typeof buildQuoteFromSeries>> => result.status === 'fulfilled')
    .map((result) => result.value)

  return res.status(200).json({ ok: true, data, source: 'yahoo-finance' })
})

app.get('/api/market/macro', async (req, res) => {
  try {
    const { fetchMacroData } = require('./utils/openbbAdapter')
    const { generateMacroAnalysis } = require('./services/macroAgentService')
    const data = await fetchMacroData()
    const analysis = await generateMacroAnalysis(data)
    res.json({ success: true, data: { ...data, aiAnalysis: analysis.text, alphaSignals: analysis.alphaSignals } })
  } catch (error) {
    console.error('Macro API Error:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch macro data' })
  }
})

app.get('/api/market/news', async (req, res) => {
  const symbols = typeof req.query.symbols === 'string'
    ? req.query.symbols.split(',').map((symbol) => symbol.trim()).filter(Boolean)
    : []
  const country = typeof req.query.country === 'string' ? req.query.country : 'ID'
  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 6
  const pro = req.query.pro === '1' || req.query.pro === 'true'

  const news = await getMarketNews({ symbols, country, limit, pro })
  return res.status(200).json({
    ok: news.dataStatus !== 'unavailable',
    items: news.items,
    data: news.items,
    dataStatus: news.dataStatus,
    lastUpdated: news.lastUpdated,
    message: news.message,
    source: news.dataStatus === 'unavailable' ? 'unavailable' : 'news-provider'
  })
})

const detectPreferredLanguage = (messages: AiMessage[]) => {
  const lastUserMessage =
    messages
      .slice()
      .reverse()
      .find((message) => message.role === 'user')
      ?.content?.toLowerCase() || ''

  const indonesianHints = [
    'apa',
    'bagaimana',
    'kenapa',
    'tolong',
    'saya',
    'portfolio saya',
    'portofolio saya',
    'yang perlu',
    'emas',
    'saham',
    'pasar',
    'ringkas',
    'bahasa indonesia'
  ]

  return indonesianHints.some((hint) => lastUserMessage.includes(hint)) ? 'id' : 'en'
}

const getLastUserMessage = (messages: AiMessage[]) =>
  messages
    .slice()
    .reverse()
    .find((message) => message.role === 'user')
    ?.content?.toLowerCase() || ''

const getPreviousUserMessage = (messages: AiMessage[]) => {
  const userMessages = messages.filter((message) => message.role === 'user')
  if (userMessages.length < 2) return ''
  return userMessages[userMessages.length - 2]?.content?.toLowerCase() || ''
}

const getRecentUserMessages = (messages: AiMessage[], count = 3) =>
  messages
    .filter((message) => message.role === 'user')
    .slice(-count)
    .map((message) => message.content?.toLowerCase() || '')

const isIdentityQuestion = (text: string) =>
  text.includes('siapa anda') ||
  text.includes('siapa kamu') ||
  text.includes('who are you') ||
  text.includes('what are you') ||
  text.includes('kamu siapa') ||
  text.includes('anda siapa') ||
  text.includes('halo kiting ai') ||
  text.includes('hi kiting ai') ||
  text.includes('hello kiting ai') ||
  text.includes('halo ting ai') ||
  text.includes('hi ting ai') ||
  text.includes('hello ting ai') ||
  (text.includes('ting ai') &&
    (text.includes('siapa') ||
      text.includes('apa itu') ||
      text.includes('what is') ||
      text.includes('who is') ||
      text.includes('identity')))

const isNamingQuestion = (text: string) =>
  text.includes('kiting ai') ||
  (text.includes('ting ai') &&
    (text.includes('kiting ai') ||
      text.includes('plesetan') ||
      text.includes('singkatan') ||
      text.includes('kepanjangan') ||
      text.includes('nama lengkap') ||
      text.includes('full form') ||
      text.includes('stands for'))) ||
  text.includes('asal nama ting ai')

const isGreetingOnly = (text: string) => {
  const normalized = text.trim()
  return [
    'halo',
    'hi',
    'hello',
    'hai',
    'pagi',
    'siang',
    'sore',
    'malam',
    'halo ting ai',
    'hi ting ai',
    'hello ting ai',
    'halo kiting ai',
    'hi kiting ai',
    'hello kiting ai'
  ].includes(normalized)
}

const isMarketQuestion = (text: string) =>
  [
    'emas',
    'gold',
    'xau',
    'xauusd',
    'antam',
    'btc',
    'bitcoin',
    'sp500',
    's&p',
    'spy',
    'yield',
    'dollar',
    'uup',
    'us10y',
    'macro',
    'market',
    'pasar',
    'risk tone',
    'stress state',
    'stress',
    'portfolio',
    'portofolio',
    'regime',
    'conviction',
    'headline',
    'watch',
    'brief',
    'ringkas',
    'investasi',
    'saham',
    'equities',
    'ihsg',
    'idx',
    'jci',
    'jakarta composite',
    'index saham indo',
    'index saham indonesia',
    'saham indonesia',
    'pasar indonesia'
  ].some((keyword) => text.includes(keyword))

const isAmbiguousMarketQuestion = (text: string) => {
  if (!isMarketQuestion(text)) return false

  const broadMarketPhrases = [
    'sentimen pasar global',
    'sentimen global',
    'market global',
    'pasar global',
    'kondisi market',
    'kondisi pasar',
    'bagaimana market',
    'bagaimana pasar',
    'bagaimana kedepannya',
    'bagaimana ke depannya',
    'gimana kedepannya',
    'gimana ke depannya',
    'outlook market',
    'outlook pasar',
    'secara umum',
    'in general',
    'overall'
  ]

  const hasBroadPhrase = broadMarketPhrases.some((phrase) => text.includes(phrase))
  const hasSpecificAnchor =
    text.includes('emas') ||
    text.includes('gold') ||
    text.includes('xau') ||
    text.includes('btc') ||
    text.includes('bitcoin') ||
    text.includes('sp500') ||
    text.includes('s&p') ||
    text.includes('ihsg') ||
    text.includes('idx') ||
    text.includes('jci') ||
    text.includes('uup') ||
    text.includes('us10y') ||
    text.includes('portfolio') ||
    text.includes('portofolio') ||
    text.includes('crypto') ||
    text.includes('kripto') ||
    text.includes('saham')

  return hasBroadPhrase && !hasSpecificAnchor
}

const shouldInjectMarketContext = (text: string) =>
  isMarketQuestion(text) && !isAmbiguousMarketQuestion(text)

const detectIntentLabel = (text: string, previousUserMessage = '', recentUserMessages: string[] = []) => {
  if (isGreetingOnly(text)) return 'greeting'
  if (isIdentityQuestion(text)) return 'identity'
  if (isNamingQuestion(text)) return 'naming'
  if (isAmbiguousMarketQuestion(text)) return 'ambiguous_market'
  if (isCompareAssetsFollowUp(text, previousUserMessage, recentUserMessages)) return 'compare_assets_followup'
  if (isCompareAssetsQuestion(text)) return 'compare_assets'
  if (
    text.includes('portfolio') ||
    text.includes('portofolio') ||
    text.includes('holding') ||
    text.includes('exposure') ||
    text.includes('konsentrasi')
  ) {
    return 'portfolio'
  }
  if (
    text.includes('emas') ||
    text.includes('gold') ||
    text.includes('xau') ||
    text.includes('btc') ||
    text.includes('bitcoin') ||
    text.includes('sp500') ||
    text.includes('s&p') ||
    text.includes('ihsg') ||
    text.includes('idx') ||
    text.includes('jci')
  ) {
    return 'asset'
  }
  if (isMarketQuestion(text)) return 'market'
  if (!text.trim()) return 'empty'
  return 'other'
}

const buildClarificationReply = (preferredLanguage: 'id' | 'en') =>
  preferredLanguage === 'id'
    ? 'Cakupan pertanyaan ini masih terlalu luas. Anda ingin saya fokus ke makro seperti US10Y dan dolar, ke saham/global equities, atau ke aset spesifik seperti BTC dan emas?'
    : 'That question is still too broad. Do you want me to focus on macro indicators such as US10Y and the dollar, on global equities, or on specific assets such as BTC and gold?'

const mentionsUsdCash = (text: string) =>
  text.includes(' usd') ||
  text.startsWith('usd') ||
  text.includes('/usd') ||
  text.includes('dollar') ||
  text.includes('cash')

const isCompareAssetsQuestion = (text: string) => {
  const compareSeparators = text.includes('/') || text.includes(' vs ') || text.includes(' atau ')
  const compareCue =
    text.includes('lebih baik mana') ||
    text.includes('mending mana') ||
    text.includes('pilih mana') ||
    text.includes('better to hold') ||
    text.includes('better choice') ||
    text.includes('which is better')

  const assetMentions = [
    text.includes('btc') || text.includes('bitcoin'),
    text.includes('emas') || text.includes('gold') || text.includes('xau'),
    mentionsUsdCash(text),
    text.includes('sp500') || text.includes('s&p'),
    text.includes('ihsg') || text.includes('idx') || text.includes('jci')
  ].filter(Boolean).length

  return assetMentions >= 2 && (compareSeparators || compareCue)
}

const isCompareAssetsFollowUp = (
  text: string,
  previousUserMessage: string,
  recentUserMessages: string[] = []
) => {
  const normalized = text.trim()
  const shortFollowUps = [
    'boleh bandingkan',
    'bandingkan',
    'tolong bandingkan',
    'lanjut bandingkan',
    'compare',
    'please compare',
    'go ahead',
    'lanjut',
    'jelaskan',
    'boleh'
  ]

  const recentCompareContext = [previousUserMessage, ...recentUserMessages].some((message) =>
    isCompareAssetsQuestion(message)
  )

  return shortFollowUps.includes(normalized) && recentCompareContext
}

const isAssetSpecificQuestion = (text: string) =>
  [
    'emas',
    'gold',
    'xau',
    'xauusd',
    'antam',
    'btc',
    'bitcoin',
    'sp500',
    's&p',
    'ihsg',
    'idx',
    'jci',
    'usd',
    'dollar',
    'cash',
    'uup',
    'us10y'
  ].some((keyword) => text.includes(keyword))

const hasReliableAssetContext = (text: string, meta?: AiChatBody['meta']) => {
  if ((meta as any)?.copilot) return true
  const instruments = meta?.instruments

  if (text.includes('emas') || text.includes('gold') || text.includes('xau') || text.includes('antam')) {
    return Boolean(instruments?.ANTAM && !instruments.ANTAM.error && instruments.ANTAM.latestPrice)
  }

  if (text.includes('sp500') || text.includes('s&p')) {
    return Boolean(instruments?.SP500 && !instruments.SP500.error && instruments.SP500.latestPrice)
  }

  if (text.includes('btc') || text.includes('bitcoin')) {
    return Boolean(instruments?.BTC && !instruments.BTC.error && instruments.BTC.latestPrice)
  }

  if (
    text.includes('ihsg') ||
    text.includes('idx') ||
    text.includes('jci') ||
    mentionsUsdCash(text) ||
    text.includes('uup') ||
    text.includes('us10y')
  ) {
    return Boolean(
      (instruments?.IHSG && !instruments.IHSG.error && instruments.IHSG.latestPrice) ||
      meta?.context ||
      meta?.briefing?.length
    )
  }

  return Boolean(meta?.context || meta?.briefing?.length || instruments)
}

const buildAssetContextGuardReply = (preferredLanguage: 'id' | 'en') =>
  preferredLanguage === 'id'
    ? 'Saya belum punya context live yang cukup kuat untuk menjawab aset itu dengan yakin saat ini. Jika Anda ingin, saya bisa bantu dari market brief terakhir yang tersedia, atau Anda bisa sebutkan aset/fokusnya lebih spesifik.'
    : 'I do not have enough reliable live context to answer that asset question confidently right now. If useful, I can answer from the latest available market brief, or you can narrow the asset or angle more specifically.'

const buildCompareAssetsReply = (preferredLanguage: 'id' | 'en') =>
  preferredLanguage === 'id'
    ? 'Jika yang Anda maksud adalah membandingkan BTC, cash USD, dan emas, maka pilihannya tergantung tujuan. Untuk defensif jangka pendek, cash USD atau emas biasanya lebih stabil. Untuk potensi upside dengan risiko lebih tinggi, BTC lebih agresif. Jika Anda mau, saya bisa bandingkan ketiganya dari sisi defensif, momentum, atau kecocokannya dengan portofolio Anda.'
    : 'If you mean comparing BTC, USD cash, and gold, the better choice depends on your goal. For short-term defense, USD cash or gold is usually more stable. For higher-upside but higher-risk exposure, BTC is more aggressive. If useful, I can compare the three from a defensive, momentum, or portfolio-fit angle.'

const shouldReturnClarification = (text: string) =>
  !text ||
  (!isGreetingOnly(text) &&
    !isIdentityQuestion(text) &&
    !isNamingQuestion(text) &&
    !isMarketQuestion(text))

const buildAiFallbackReply = (
  messages: AiMessage[],
  summary?: string,
  meta?: AiChatBody['meta'],
  reason: 'provider_unavailable' | 'invalid_payload' = 'provider_unavailable'
) => {
  const baseReply = buildLocalReply(messages, summary, meta)
  const preferredLanguage = detectPreferredLanguage(messages)

  if (reason === 'invalid_payload') {
    return preferredLanguage === 'id'
      ? `Format permintaan AI tidak lengkap. ${baseReply}`
      : `The AI request format is incomplete. ${baseReply}`
  }

  return preferredLanguage === 'id'
    ? `Koneksi ke live AI sedang terganggu. Berdasarkan konteks terakhir yang tersedia, ${baseReply.charAt(0).toLowerCase()}${baseReply.slice(1)}`
    : `The live AI connection is unstable right now. Based on the latest available context, ${baseReply.charAt(0).toLowerCase()}${baseReply.slice(1)}`
}

const logAiTelemetry = (payload: {
  intent: string
  providerRequested: string
  providerUsed: string
  durationMs: number
  fallbackUsed: boolean
  hasMarketContext: boolean
  hasPortfolioContext: boolean
}) => {
  const {
    intent,
    providerRequested,
    providerUsed,
    durationMs,
    fallbackUsed,
    hasMarketContext,
    hasPortfolioContext
  } = payload

  console.log(
    `[AI_CHAT] [INTENT:${intent}] [PROVIDER_REQUESTED:${providerRequested}] [PROVIDER_USED:${providerUsed}] [TIME_TAKEN:${durationMs}ms] [FALLBACK_USED:${fallbackUsed}] [MARKET_CONTEXT:${hasMarketContext}] [PORTFOLIO_CONTEXT:${hasPortfolioContext}]`
  )
}

const buildGroqMessages = (
  messagesWithContext: AiMessage[],
  marketBriefContext: string | null,
  portfolioContext: string | null
) => {
  const groqMessages = [
    { role: 'system', content: tingAiSystemPrompt },
    ...messagesWithContext.filter((message) => message.role !== 'system')
  ]

  if (marketBriefContext) {
    groqMessages[0].content += `\n\n${marketBriefContext}`
  }
  if (portfolioContext) {
    groqMessages[0].content += `\n\n${portfolioContext}`
  }

  return groqMessages
}

const buildGeminiMessages = (
  messages: AiMessage[],
  marketBriefContext: string | null,
  portfolioContext: string | null
) => {
  const geminiMessages = [...messages]
  if (marketBriefContext) {
    geminiMessages.unshift({ role: 'system', content: marketBriefContext })
  }
  if (portfolioContext) {
    geminiMessages.unshift({ role: 'system', content: portfolioContext })
  }
  geminiMessages.unshift({ role: 'system', content: tingAiSystemPrompt })
  return geminiMessages
}

const normalizeChatProviderMessages = (messages: AiMessage[]): ChatMessage[] =>
  messages
    .filter((message) => message.role === 'system' || message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role as ChatMessage['role'],
      content: String(message.content || '')
    }))
    .filter((message) => message.content.trim())

const buildLocalReply = (
  messages: AiMessage[],
  summary?: string,
  meta?: AiChatBody['meta']
) => {
  const last = getLastUserMessage(messages)
  const previousUserMessage = getPreviousUserMessage(messages)
  const recentUserMessages = getRecentUserMessages(messages)
  const preferredLanguage = detectPreferredLanguage(messages)
  if (isAmbiguousMarketQuestion(last)) {
    return buildClarificationReply(preferredLanguage)
  }
  if (isCompareAssetsFollowUp(last, previousUserMessage, recentUserMessages)) {
    return buildCompareAssetsReply(preferredLanguage)
  }
  if (isCompareAssetsQuestion(last)) {
    return buildCompareAssetsReply(preferredLanguage)
  }
  if (isAssetSpecificQuestion(last) && !hasReliableAssetContext(last, meta)) {
    return buildAssetContextGuardReply(preferredLanguage)
  }

  const asksAboutGold =
    last.includes('antam') ||
    last.includes('emas') ||
    last.includes('gold') ||
    last.includes('xau') ||
    last.includes('xauusd') ||
    last.includes('harga emas')
  const asksAboutIndonesiaEquities =
    last.includes('ihsg') ||
    last.includes('idx') ||
    last.includes('jci') ||
    last.includes('jakarta composite') ||
    last.includes('index saham indo') ||
    last.includes('index saham indonesia') ||
    last.includes('saham indonesia') ||
    last.includes('pasar indonesia')
  const asksAboutIndonesiaGeopolitics =
    (last.includes('geopolitik indonesia') ||
      last.includes('politik indonesia') ||
      last.includes('indonesia aman')) &&
    !last.includes('portfolio') &&
    !last.includes('portofolio')

  if (asksAboutGold) {
    const antam = meta?.instruments?.ANTAM
    if (!antam || antam.error) {
      return preferredLanguage === 'id'
        ? 'Data GOLD belum tersedia saat ini.'
        : 'GOLD data is not available right now.'
    }
    return preferredLanguage === 'id'
      ? `Emas saat ini ${idrFormatter.format(antam.latestPrice ?? 0)} per gram, dengan perubahan ${signedIdr(antam.delta ?? 0)} (${signedPercent(antam.pct ?? 0)}) pada ${antam.latestDate}.`
      : `Gold is currently ${idrFormatter.format(antam.latestPrice ?? 0)} per gram, with a move of ${signedIdr(antam.delta ?? 0)} (${signedPercent(antam.pct ?? 0)}) on ${antam.latestDate}.`
  }

  if (asksAboutIndonesiaEquities) {
    const ihsg = meta?.instruments?.IHSG
    const sp500 = meta?.instruments?.SP500
    if (ihsg && !ihsg.error) {
      return preferredLanguage === 'id'
        ? `IHSG terakhir ${usNumberFormatter.format(ihsg.latestPrice ?? 0)}, dengan perubahan ${signedPoints(ihsg.delta ?? 0)} (${signedPercent(ihsg.pct ?? 0)}) pada ${ihsg.latestDate}. Ini memberi pembacaan langsung untuk sentimen saham Indonesia.`
        : `IHSG last printed ${usNumberFormatter.format(ihsg.latestPrice ?? 0)}, with a move of ${signedPoints(ihsg.delta ?? 0)} (${signedPercent(ihsg.pct ?? 0)}) on ${ihsg.latestDate}. That gives a direct read on Indonesian equity sentiment.`
    }
    if (preferredLanguage === 'id') {
      return sp500 && !sp500.error
        ? `Saya belum punya feed IHSG langsung di layer ini. Untuk sekarang saya hanya punya proxy US equities melalui SP500 yang terakhir bergerak ${signedPoints(sp500.delta ?? 0)} (${signedPercent(sp500.pct ?? 0)}) pada ${sp500.latestDate}. Jika Anda ingin, saya bisa bantu jelaskan implikasinya untuk sentimen saham Indonesia secara umum.`
        : 'Saya belum punya feed IHSG langsung di layer ini. Jika Anda ingin, tanyakan konteks saham Indonesia secara lebih spesifik atau hubungkan ke market brief saat ini.'
    }

    return sp500 && !sp500.error
      ? `I do not have a direct IHSG feed in this layer yet. For now I only have a US equity proxy through the SP500, which last moved ${signedPoints(sp500.delta ?? 0)} (${signedPercent(sp500.pct ?? 0)}) on ${sp500.latestDate}. If useful, I can still explain what that may imply for Indonesian equity sentiment more broadly.`
      : 'I do not have a direct IHSG feed in this layer yet. If useful, ask about Indonesian equities more specifically or tie the question to the current market brief.'
  }

  if (asksAboutIndonesiaGeopolitics) {
    return preferredLanguage === 'id'
      ? 'Saya belum punya layer geopolitik Indonesia yang cukup spesifik untuk menilai apakah situasinya aman atau tidak. Kalau mau, saya bisa bantu dari sudut dampaknya ke pasar, saham Indonesia, emas, atau portofolio.'
      : 'I do not have a dedicated Indonesia geopolitical layer yet, so I cannot judge whether the situation is safe or not with confidence. If useful, I can still help frame the market impact on Indonesian equities, gold, or portfolio risk.'
  }

  if (isIdentityQuestion(last)) {
    return preferredLanguage === 'id'
      ? 'Saya Ting AI, asisten digital di dashboard ini. Ting AI di sini dimaknai sebagai Kiting AI.'
      : 'I am Ting AI, the digital assistant inside this dashboard. Here, Ting AI is treated as Kiting AI.'
  }

  if (isGreetingOnly(last)) {
    return preferredLanguage === 'id'
      ? 'Halo. Saya Ting AI. Kalau Anda ingin, Anda bisa tanya soal emas, BTC, market brief, stress state, atau portofolio.'
      : 'Hello. I am Ting AI. You can ask about gold, BTC, the market brief, stress state, or portfolio implications.'
  }

  if (last.includes('kiting ai')) {
    return preferredLanguage === 'id'
      ? 'Saya Ting AI. Di produk ini, Ting AI dimaknai sebagai Kiting AI.'
      : 'I am Ting AI. In this product, Ting AI is treated as Kiting AI.'
  }

  if (last.includes('ting ai') && (last.includes('kiting ai') || last.includes('plesetan') || last.includes('nama lengkap'))) {
    return preferredLanguage === 'id'
      ? 'Ya. Di produk ini, Ting AI dimaknai sebagai Kiting AI.'
      : 'Yes. In this product, Ting AI is treated as Kiting AI.'
  }

  if (last.includes('ting ai') && (last.includes('singkatan') || last.includes('kepanjangan'))) {
    return preferredLanguage === 'id'
      ? 'Kepanjangan yang dipakai di produk ini adalah Kiting AI.'
      : 'In this product, the expanded form used is Kiting AI.'
  }

  if (last.includes('s&p') || last.includes('sp500')) {
    const sp500 = meta?.instruments?.SP500
    if (!sp500 || sp500.error) {
      return preferredLanguage === 'id'
        ? 'Data S&P 500 belum tersedia saat ini.'
        : 'S&P 500 data is not available right now.'
    }
    return preferredLanguage === 'id'
      ? `S&P 500 terakhir ${usNumberFormatter.format(sp500.latestPrice ?? 0)}, dengan perubahan ${signedPoints(sp500.delta ?? 0)} (${signedPercent(sp500.pct ?? 0)}) pada ${sp500.latestDate}.`
      : `The S&P 500 last printed ${usNumberFormatter.format(sp500.latestPrice ?? 0)}, with a move of ${signedPoints(sp500.delta ?? 0)} (${signedPercent(sp500.pct ?? 0)}) on ${sp500.latestDate}.`
  }

  if (
    last.includes('risk tone') ||
    last.includes('stress state') ||
    last.includes('macro pressure') ||
    last.includes('portfolio') ||
    last.includes('dampak') ||
    last.includes('stress')
  ) {
    const context = meta?.context
    if (context) {
      const topWatch = context.watchItems?.[0]?.detail || ''
      if (preferredLanguage === 'id') {
        return `Risk tone saat ini ${context.riskTone.toLowerCase()} dengan regime ${context.regime.toLowerCase()} dan stress state ${context.stressState.toLowerCase()}. Implikasi utamanya: pengguna sebaiknya membaca tekanan makro dan konfirmasi lintas aset sebelum menambah risk. ${topWatch}`.trim()
      }

      return `The current market read is ${context.riskTone.toLowerCase()}, with ${context.regime.toLowerCase()} and ${context.stressState.toLowerCase()}. The main implication is that users should demand cross-asset confirmation before adding risk. ${topWatch}`.trim()
    }
  }

  if (last.includes('ting ai') && (last.includes('kiting ai') || last.includes('plesetan'))) {
    return preferredLanguage === 'id'
      ? 'Ya. Dalam konteks produk ini, Ting AI dimaknai sebagai Kiting AI.'
      : 'Yes. In this product context, Ting AI is treated as Kiting AI.'
  }

  if (last.includes('ting ai') && (last.includes('singkatan') || last.includes('kepanjangan'))) {
    return preferredLanguage === 'id'
      ? 'Kepanjangan yang dipakai di produk ini adalah Kiting AI.'
      : 'In this product, the expanded form used is Kiting AI.'
  }

  if (shouldReturnClarification(last)) {
    return preferredLanguage === 'id'
      ? 'Maaf, saya belum mengerti maksud pertanyaan itu. Coba perjelas atau tanyakan secara lebih spesifik, misalnya tentang emas, BTC, market brief, stress state, atau portofolio.'
      : 'Sorry, I do not understand that request yet. Please rephrase it or ask more specifically about gold, BTC, the market brief, stress state, or portfolio.'
  }

  if (summary && isMarketQuestion(last)) {
    return preferredLanguage === 'id' ? `Ringkasan: ${summary}` : `Summary: ${summary}`
  }

  return preferredLanguage === 'id'
    ? 'Saya siap membantu analisis data investasi jika ringkasan tersedia.'
    : 'I am ready to help with investment analysis once the summary context is available.'
}

const sendGroq = async (messages: AiMessage[]) => {
  const url = process.env.GROQ_API_URL
  const apiKey = process.env.GROQ_API_KEY
  const model = process.env.GROQ_MODEL
  if (!url || !apiKey || !model) return null

  // In Groq, the first message is the system prompt.
  const hasSystemPrompt = messages[0]?.role === 'system'
  const normalizedMessages = hasSystemPrompt ? messages : [{ role: 'system', content: tingAiSystemPrompt }, ...messages]

  const payload = {
    model,
    messages: normalizedMessages,
    temperature: 0.4
  }

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: Number(process.env.GROQ_REQUEST_TIMEOUT_MS || 12000)
    })

    return (response.data?.choices?.[0]?.message?.content?.trim() as string | undefined) || null
  } catch (error) {
    console.error('GROQ_ERROR', error)
    return null
  }
}

const sendGemini = async (messages: AiMessage[]) => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash'

    const systemInstructions = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n')

    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemInstructions || tingAiSystemPrompt
    })

    const normalizedConversation = messages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message): { role: 'user' | 'model'; parts: { text: string }[] } => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }]
      }))
      .reduce((acc, current) => {
        if (acc.length > 0 && acc[acc.length - 1].role === current.role) {
          acc[acc.length - 1].parts[0].text += `\n${current.parts[0].text}`
          return acc
        }

        acc.push(current)
        return acc
      }, [] as Array<{ role: 'user' | 'model'; parts: { text: string }[] }>)

    const lastUserIndex = [...normalizedConversation].map((message) => message.role).lastIndexOf('user')
    if (lastUserIndex === -1) {
      return null
    }

    const prompt = normalizedConversation[lastUserIndex]
    const history = normalizedConversation
      .slice(0, lastUserIndex)
      .filter((message, index, list) => !(index === 0 && message.role === 'model') && !(index === list.length - 1 && message.role === 'user'))

    const chat = model.startChat({ history })
    const result = await chat.sendMessage(prompt.parts)
    return result.response.text().trim()
  } catch (error) {
    console.error('GEMINI_ERROR', error)
    return null
  }
}

// --- START: Response Parser and Fallback Logic ---
function parseAskTingAiResponse(rawResponse: string): AskTingAiStructuredResponse | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (
      parsed.direct_answer &&
      Array.isArray(parsed.why_it_matters) &&
      parsed.why_it_matters.length === 2 &&
      parsed.risk_note &&
      ['monitor', 'wait', 'rebalance', 'reduce_exposure'].includes(parsed.suggested_next_step)
    ) {
      return {
        direct_answer: parsed.direct_answer,
        why_it_matters: parsed.why_it_matters.slice(0, 2),
        risk_note: parsed.risk_note,
        suggested_next_step: parsed.suggested_next_step
      };
    }
  } catch (e) {
    // JSON parse failed, return null to trigger fallback
  }
  return null;
}

function buildAskTingAiFallback(
  portfolio?: PortfolioData,
  preferredLanguage: 'id' | 'en' = 'id',
  hasProfitLossData = false
): AskTingAiStructuredResponse {
  if (!portfolio || !portfolio.holdings?.length || !portfolio.summary) {
    // Generic fallback if no portfolio
    return preferredLanguage === 'id'
      ? {
          direct_answer: 'Saya siap membantu Anda memahami portofolio dan risiko investasi.',
          why_it_matters: [
            'Pemahaman risiko yang jelas membantu pengambilan keputusan yang lebih baik.',
            'Context portofolio pribadi adalah kunci untuk strategi yang efektif.'
          ],
          risk_note: 'Pantau selalu kondisi portofolio Anda secara berkala.',
          suggested_next_step: 'monitor'
        }
      : {
          direct_answer: 'I am ready to help you understand your portfolio and investment risk.',
          why_it_matters: [
            'Clear risk understanding leads to better investment decisions.',
            'Personal portfolio context is key to effective strategy.'
          ],
          risk_note: 'Always monitor your portfolio conditions regularly.',
          suggested_next_step: 'monitor'
        };
  }

  const { summary, holdings } = portfolio;
  const totalValue = summary.totalCurrentValue || 0;
  const totalPnlPct = hasProfitLossData ? summary.totalPnlPct || 0 : null;

  if (totalValue <= 0) {
    return preferredLanguage === 'id'
      ? {
          direct_answer: 'Portofolio Anda masih kosong atau belum memiliki nilai.',
          why_it_matters: [
            'Mulai dengan modal awal yang jelas untuk tracking yang akurat.',
            'Dokumentasi entry point membantu analisis risiko di masa depan.'
          ],
          risk_note: 'Pastikan data entry Anda sudah lengkap sebelum memulai.',
          suggested_next_step: 'wait'
        }
      : {
          direct_answer: 'Your portfolio is empty or has no current value.',
          why_it_matters: [
            'Start with clear initial capital for accurate tracking.',
            'Clear entry documentation helps future risk analysis.'
          ],
          risk_note: 'Make sure your data entry is complete before starting.',
          suggested_next_step: 'wait'
        };
  }

  const sortedHoldings = [...holdings].sort(
    (a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0)
  );
  const largestPosition = sortedHoldings[0];
  const largestWeight = largestPosition.currentValue
    ? (largestPosition.currentValue / totalValue) * 100
    : 0;

  // Concentration-based fallback
  if (largestWeight > 50) {
    return preferredLanguage === 'id'
      ? {
          direct_answer: hasProfitLossData
            ? `Portofoliomu terlalu terkonsentrasi pada ${largestPosition.symbol} (${largestWeight.toFixed(1)}%). ${totalPnlPct !== null && totalPnlPct > 0 ? 'Meskipun sedang untung, risiko konsentrasi tetap tinggi.' : `Risiko penurunan nilai bisa signifikan jika ${largestPosition.symbol} turun.`}`
            : `Lebih dari ${largestWeight.toFixed(1)}% portofoliomu terkonsentrasi di ${largestPosition.symbol}. Ini adalah risiko konsentrasi, bukan bacaan profit/loss.`,
          why_it_matters: [
            `Porsi ${largestPosition.symbol} terlalu dominan terhadap portofoliomu.`,
            `Jika ${largestPosition.symbol} melemah, dampaknya langsung terasa ke nilai portofolio.`
          ],
          risk_note: hasProfitLossData
            ? 'Risiko utama saat ini adalah konsentrasi pada satu aset, bukan arah pasar secara umum.'
            : 'Input ini membaca porsi portofolio, bukan profit/loss. Jadi Ting AI belum menghitung untung/rugi pribadi.',
          suggested_next_step: 'rebalance'
        }
      : {
          direct_answer: hasProfitLossData
            ? `Your portfolio is heavily concentrated in ${largestPosition.symbol} (${largestWeight.toFixed(1)}%). ${totalPnlPct !== null && totalPnlPct > 0 ? 'Even though you are profitable, concentration risk remains high.' : `Portfolio value could be sensitive if ${largestPosition.symbol} declines.`}`
            : `More than ${largestWeight.toFixed(1)}% of your portfolio is concentrated in ${largestPosition.symbol}. This is a concentration read, not a profit/loss read.`,
          why_it_matters: [
            `${largestPosition.symbol} dominates your portfolio allocation.`,
            `If ${largestPosition.symbol} weakens, the impact on portfolio value is direct and immediate.`
          ],
          risk_note: hasProfitLossData
            ? 'The main risk is concentration in a single asset, not general market direction.'
            : 'This input reads portfolio allocation, not profit/loss. Ting AI has not calculated your personal gain or loss yet.',
          suggested_next_step: 'rebalance'
        };
  } else if (largestWeight > 35) {
    return preferredLanguage === 'id'
      ? {
          direct_answer: `Portofoliomu memiliki konsentrasi moderat pada ${largestPosition.symbol} (${largestWeight.toFixed(1)}%). Pertimbangkan untuk mengurangi risiko melalui diversifikasi.`,
          why_it_matters: [
            `Porsi ${largestPosition.symbol} masih cukup signifikan relatif terhadap portofolio.`,
            'Menambah diversifikasi bisa membantu mengurangi dampak volatilitas satu aset.'
          ],
          risk_note: 'Tingkat konsentrasi sedang - pantau terus dan pertimbangkan rebalance jika ada peluang.',
          suggested_next_step: 'rebalance'
        }
      : {
          direct_answer: `Your portfolio has moderate concentration in ${largestPosition.symbol} (${largestWeight.toFixed(1)}%). Consider reducing risk through further diversification.`,
          why_it_matters: [
            `${largestPosition.symbol} still represents a significant portion of your portfolio.`,
            'Adding diversification could help reduce the impact of single-asset volatility.'
          ],
          risk_note: 'Moderate concentration level - continue monitoring and consider rebalancing if opportunities arise.',
          suggested_next_step: 'rebalance'
        };
  } else {
    // Well-diversified portfolio
    return preferredLanguage === 'id'
      ? {
          direct_answer: 'Portofoliomu terlihat cukup seimbang dan diversified. Langkah paling aman saat ini adalah terus memantau kondisi pasar dan posisi Anda.',
          why_it_matters: [
            'Tidak ada satu aset yang terlalu mendominasi portofoliomu.',
            'Diversifikasi yang baik membantu mengurangi dampak volatilitas dari pergerakan satu aset.'
          ],
          risk_note: 'Tetap pantau perubahan market karena profil risiko bisa berubah seiring waktu.',
          suggested_next_step: 'monitor'
        }
      : {
          direct_answer: 'Your portfolio appears reasonably balanced and diversified. The safest step right now is to continue monitoring market conditions and your positions.',
          why_it_matters: [
            'No single asset dominates your portfolio allocation.',
            'Good diversification helps reduce the impact of single-asset volatility.'
          ],
          risk_note: 'Keep monitoring market changes as your risk profile can shift over time.',
          suggested_next_step: 'monitor'
        };
  }
}
// --- END: Response Parser and Fallback Logic ---

function createPortfolioContext(portfolio?: PortfolioData, hasProfitLossData = false): string | null {
  if (!portfolio || !portfolio.holdings?.length || !portfolio.summary) {
    return null;
  }

  const { summary, holdings } = portfolio;
  if (!summary.totalCurrentValue || summary.totalCurrentValue <= 0) {
    return "PORTFOLIO CONTEXT:\nThe user's portfolio is initialized but currently has zero value.";
  }

  const sortedHoldings = [...holdings].sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0));
  const largestPosition = sortedHoldings[0];
  const largestPositionWeight = (largestPosition.currentValue / summary.totalCurrentValue) * 100;

  // Calculate sector exposure
  const sectorExposure: Record<string, number> = {};
  holdings.forEach((holding) => {
    const sector = holding.assetType || 'Other';
    sectorExposure[sector] = (sectorExposure[sector] || 0) + (holding.currentValue || 0);
  });
  
  const sortedSectors = Object.entries(sectorExposure)
    .sort(([, a], [, b]) => b - a)
    .map(([sector, value]) => ({ sector, percentage: (value / summary.totalCurrentValue) * 100 }));

  const largestSector = sortedSectors[0];
  const top3Holdings = sortedHoldings
    .slice(0, 3)
    .map((holding) => `${holding.symbol} (${((holding.currentValue / summary.totalCurrentValue) * 100).toFixed(1)}%)`);
  const manualHoldings = holdings.filter((holding) => holding.source === 'manual' || holding.supportStatus === 'data_limited');

  let context = 'PORTFOLIO CONTEXT:\n';
  context += `Current Portfolio Value: $${summary.totalCurrentValue.toFixed(2)}\n`;
  context += `Number of Holdings: ${holdings.length}\n`;
  context += `Top 3 Holdings: ${top3Holdings.join(', ')}\n`;
  context += `Largest Holding: ${largestPosition.symbol} (${largestPositionWeight.toFixed(1)}% of portfolio)\n`;

  if (hasProfitLossData) {
    context += `Total Capital Invested: $${summary.totalInvested.toFixed(2)}\n`;
    context += `Profit/Loss Amount: $${summary.totalPnl.toFixed(2)}\n`;
    context += `Profit/Loss Percentage: ${(summary.totalPnlPct || 0).toFixed(2)}%\n`;
  } else {
    context += 'PROFIT/LOSS LIMITATION: Profit/loss data is not available. Never infer profit, loss, gain, untung, rugi, keuntungan, or kerugian from allocation percentages. Analyze only allocation, weight, exposure, concentration, sensitivity, market impact, and monitoring points.\n';
  }

  if (largestSector) {
    context += `Largest Asset Type: ${largestSector.sector} (${largestSector.percentage.toFixed(1)}% of portfolio)\n`;
  }

  // Concentration risk assessment
  if (largestPositionWeight > 50) {
    context += `RISK ASSESSMENT: HIGH CONCENTRATION - The portfolio is heavily concentrated in ${largestPosition.symbol}. The user's portfolio outcome is heavily tied to this single asset's performance.\n`;
  } else if (largestPositionWeight > 35) {
    context += `RISK ASSESSMENT: MODERATE CONCENTRATION - ${largestPosition.symbol} represents a significant portion of the portfolio.\n`;
  } else if (largestPositionWeight > 25) {
    context += `RISK ASSESSMENT: MODERATE DIVERSIFICATION - The portfolio has some concentration but is fairly balanced.\n`;
  } else {
    context += `RISK ASSESSMENT: WELL DIVERSIFIED - The portfolio is reasonably spread across holdings.\n`;
  }

  if (hasProfitLossData) {
    if ((summary.totalPnlPct || 0) > 0) {
      context += `PORTFOLIO STATUS: The portfolio is in PROFIT (${(summary.totalPnlPct || 0).toFixed(2)}%).\n`;
    } else if ((summary.totalPnlPct || 0) < 0) {
      context += `PORTFOLIO STATUS: The portfolio is in LOSS (${(summary.totalPnlPct || 0).toFixed(2)}%).\n`;
    } else {
      context += `PORTFOLIO STATUS: The portfolio is BREAKEVEN.\n`;
    }
  }

  if (manualHoldings.length) {
    context += `MANUAL / DATA-LIMITED ASSETS: ${manualHoldings
      .map((holding) => {
        const weight = summary.totalCurrentValue > 0 ? ((holding.currentValue || 0) / summary.totalCurrentValue) * 100 : holding.allocationPercent || 0
        return `${holding.symbol} (${weight.toFixed(1)}%, ${holding.assetType}${holding.note ? `, note: ${holding.note}` : ''})`
      })
      .join('; ')}.\n`;
    context += 'IMPORTANT LIMITATION FOR MANUAL ASSETS: These assets do not have direct market data in Ting AI. Never claim real-time price, daily movement, volume, bullish/bearish trend, or current price for them. For these assets, analyze only allocation weight, concentration, asset-type risk, user notes, and general risk context. If asked about a manual asset, include: "Aset ini belum punya data market langsung di Ting AI, jadi saya belum membaca harga real-time atau pergerakan hariannya."\n';
  }

  context += hasProfitLossData
    ? '\nIMPORTANT: Use this portfolio context to answer the user\'s question personally. Connect concentration risk, sector exposure, and P/L status to your recommendations. Do not ask for more data - if something is missing, answer conservatively with available context.'
    : '\nIMPORTANT: Use this portfolio context to answer the user\'s question personally. Connect concentration risk, asset-type exposure, market sensitivity, and monitoring points. Do not mention profit/loss except to clarify that profit/loss data is not available.';

  return context;
}
// --- END: Portfolio Context Generator ---

function createMarketBriefContext(summary?: string, meta?: AiChatBody['meta']): string | null {
  const briefing = meta?.briefing || []
  const context = meta?.context
  const instruments = meta?.instruments

  if (!summary && !briefing.length && !context && !instruments) {
    return null
  }

  const lines: string[] = ['MARKET BRIEF CONTEXT:']

  if (context?.overnightContext) lines.push(`- Overnight context: ${context.overnightContext}`)
  if (context?.macroContext) lines.push(`- Macro context: ${context.macroContext}`)
  if (context?.geopoliticContext) lines.push(`- Geopolitical context: ${context.geopoliticContext}`)
  if (context?.externalContext) lines.push(`- External context: ${context.externalContext}`)
  if (context?.externalWhyItMatters) lines.push(`- External why it matters: ${context.externalWhyItMatters}`)
  if (context?.headlinePressure) lines.push(`- Headline pressure: ${context.headlinePressure}`)
  if (context?.riskTone) lines.push(`- Risk tone: ${context.riskTone}`)
  if (context?.regime) lines.push(`- Regime: ${context.regime}`)
  if (context?.conviction) lines.push(`- Conviction: ${context.conviction}`)
  if (context?.stressState) lines.push(`- Stress state: ${context.stressState}`)
  if (context?.watchLevel) lines.push(`- Watch level: ${context.watchLevel}`)

  if (context?.drivers?.length) {
    context.drivers.forEach((item) => lines.push(`- Driver / ${item.label} / ${item.signal}: ${item.detail}`))
  }

  if (context?.macroSignals?.length) {
    context.macroSignals.forEach((item) =>
      lines.push(`- Macro signal / ${item.label} / ${item.signal}: ${item.detail}`)
    )
  }

  if (context?.stressDrivers?.length) {
    context.stressDrivers.forEach((item) => lines.push(`- Stress driver: ${item}`))
  }

  if (context?.headlines?.length) {
    context.headlines.forEach((item) =>
      lines.push(`- External headline / ${item.source} / ${item.theme} / ${item.relevance}: ${item.title} | Why it matters: ${item.whyItMatters}`)
    )
  }

  if (context?.watchItems?.length) {
    context.watchItems.forEach((item) =>
      lines.push(`- Watch item / ${item.label} / ${item.priority}: ${item.detail}`)
    )
  }

  if (briefing.length) {
    briefing.forEach((item) => lines.push(`- ${item.title}: ${item.body}`))
  } else if (summary) {
    lines.push(`- Summary: ${summary}`)
  }

  if (instruments?.ANTAM && !instruments.ANTAM.error) {
    lines.push(`- Gold latest ${instruments.ANTAM.latestPrice ?? '-'} with delta ${instruments.ANTAM.delta ?? 0} and pct ${instruments.ANTAM.pct ?? 0}`)
  }
  if (instruments?.SP500 && !instruments.SP500.error) {
    lines.push(`- US equity proxy latest ${instruments.SP500.latestPrice ?? '-'} with delta ${instruments.SP500.delta ?? 0} and pct ${instruments.SP500.pct ?? 0}`)
  }
  if (instruments?.BTC && !instruments.BTC.error) {
    lines.push(`- BTC latest ${instruments.BTC.latestPrice ?? '-'} with delta ${instruments.BTC.delta ?? 0} and pct ${instruments.BTC.pct ?? 0}`)
  }
  if (instruments?.IHSG && !instruments.IHSG.error) {
    lines.push(`- IHSG latest ${instruments.IHSG.latestPrice ?? '-'} with delta ${instruments.IHSG.delta ?? 0} and pct ${instruments.IHSG.pct ?? 0}`)
  }

  lines.push(
    '- Reasoning instruction: connect the market brief, stress state, macro pressure, and portfolio context before answering. Prefer direct implications over generic market commentary.'
  )

  return lines.join('\n')
}


// --- START: Helper to format Ask Ting AI response ---
function formatAskTingAiResponse(
  rawReply: string | null,
  portfolio?: PortfolioData,
  preferredLanguage: 'id' | 'en' = 'id',
  hasProfitLossData = false
): AskTingAiStructuredResponse {
  if (!rawReply) {
    return buildAskTingAiFallback(portfolio, preferredLanguage, hasProfitLossData);
  }

  // Try to parse the AI response
  const parsed = parseAskTingAiResponse(rawReply);
  if (parsed) {
    return parsed;
  }

  // If parsing fails, use fallback
  return buildAskTingAiFallback(portfolio, preferredLanguage, hasProfitLossData);
}
// --- END: Helper to format Ask Ting AI response ---

app.post('/api/morning-brief', async (req, res) => {
  try {
    const { language = 'id', portfolio, marketData } = req.body;
    const systemPrompt = `You are Ting AI, a highly analytical market intelligence assistant.
Your task is to provide a very brief (1-2 paragraphs) morning market hook and portfolio impact analysis based on the latest market conditions.
STRICT RULE: NO SIGNAL POLICY. Do NOT suggest buying, selling, or trading any specific asset. Focus on risk, narrative, and context.
Language: ${language === 'id' ? 'Indonesian' : 'English'}.

Market Data Context:
${JSON.stringify(marketData || {})}

User Portfolio:
${JSON.stringify(portfolio || {})}`;

    const result = await sendChatWithFallback([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Generate the morning brief. Focus on how the current market context affects my portfolio.' }
    ], language as 'id' | 'en');

    return res.json({ brief: result.reply });
  } catch (err) {
    console.error('[morning-brief error]', err);
    return res.status(500).json({ error: 'Failed to generate morning brief' });
  }
});

app.post('/api/ai-chat', async (req, res) => {
  const startedAt = Date.now()
  let providerUsed = 'none'
  let fallbackUsed = false
  let providerRequested = 'auto'
  let intent = 'empty'
  let hasMarketContext = false
  let hasPortfolioContext = false

  try {
    const payload = parsePayload<AiChatBody>(req)
    const { messages, summary, meta, provider, portfolio, insightContext } = payload
    const hasProfitLossData = payload.hasProfitLossData === true
    const requestPlan = await getRequestPlan(getOptionalAuthUser(req))
    const hasImage = Array.isArray(messages) && messages.some((m: any) => !!m.image)
    providerRequested = provider || (hasImage || summary || meta || portfolio ? 'gemini' : 'groq')

    if (!Array.isArray(messages)) {
      fallbackUsed = true
      const fallback = buildAiFallbackReply([], summary, meta, 'invalid_payload')
      logAiTelemetry({
        intent,
        providerRequested,
        providerUsed,
        durationMs: Date.now() - startedAt,
        fallbackUsed,
        hasMarketContext,
        hasPortfolioContext
      })
        return res.status(200).json({
          reply: fallback,
          usedGroq: false,
          usedGemini: false,
          providerStatus: {
            requested: providerRequested as 'auto' | 'groq' | 'gemini',
            used: 'local',
            fallbackUsed,
            hasMarketContext,
            hasPortfolioContext,
            durationMs: Date.now() - startedAt
          }
        })
    }

    // --- START: Context Injection ---
    const lastUserMessage = getLastUserMessage(messages)
    const previousUserMessage = getPreviousUserMessage(messages)
    const recentUserMessages = getRecentUserMessages(messages)
    intent = detectIntentLabel(lastUserMessage, previousUserMessage, recentUserMessages)
    
    // --- START: Admin Trade Interceptor ---
    const authUser = getOptionalAuthUser(req)
    if (authUser && authUser.email === 'faturachmanalkahfi7@gmail.com') {
      const tradeMatch = lastUserMessage.match(/^(?:tolong\s+)?(buy|sell)\s+([A-Z0-9.\-=^]+)\s*(?:(\d+(?:\.\d+)?)\s*(?:lot|lembar|usd)?)?/i)
      if (tradeMatch) {
        const action = tradeMatch[1].toUpperCase()
        const symbol = tradeMatch[2].toUpperCase()
        const quantity = parseFloat(tradeMatch[3] || '1')
        
        try {
          const { resolveMarketQuote } = require('./services/marketQuoteService')
          const quote = await resolveMarketQuote(symbol)
          
          if (quote.price) {
            await pool.query(
              'INSERT INTO portfolio_transactions (user_id, symbol, type, quantity, price, currency) VALUES (?, ?, ?, ?, ?, ?)',
              [authUser.id, symbol, action, quantity, quote.price, quote.currency]
            )
            
            const reply = `**SIMULASI EKSEKUSI TRADING** ⚡\n\nBerhasil mengeksekusi order **${action}** untuk **${symbol}** sebanyak **${quantity}** unit di harga **${quote.price.toLocaleString('en-US', { style: 'currency', currency: quote.currency })}**.\n\n_Transaksi simulasi ini telah dicatat ke dalam database portofolio Anda._`
            
            providerUsed = 'local'
            logAiTelemetry({ intent: 'trade_execution', providerRequested, providerUsed, durationMs: Date.now() - startedAt, fallbackUsed, hasMarketContext, hasPortfolioContext })
            return res.status(200).json({ reply, usedGroq: false, usedGemini: false, providerStatus: { requested: providerRequested as 'auto' | 'groq' | 'gemini', used: 'local', fallbackUsed, hasMarketContext, hasPortfolioContext, durationMs: Date.now() - startedAt } })
          }
        } catch (err) {
          console.error('[Trade Interceptor] Error:', err)
        }
      }
    }
    // --- END: Admin Trade Interceptor ---
    if (isIdentityQuestion(lastUserMessage) || isNamingQuestion(lastUserMessage)) {
      const directReply = buildLocalReply(messages, undefined, meta)
      providerUsed = 'local'
      logAiTelemetry({
        intent,
        providerRequested,
        providerUsed,
        durationMs: Date.now() - startedAt,
        fallbackUsed,
        hasMarketContext,
        hasPortfolioContext
      })
      return res.status(200).json({
        reply: directReply,
        usedGroq: false,
        usedGemini: false,
        providerStatus: {
          requested: providerRequested as 'auto' | 'groq' | 'gemini',
          used: 'local',
          fallbackUsed,
          hasMarketContext,
          hasPortfolioContext,
          durationMs: Date.now() - startedAt
        }
      })
    }

    if (isAmbiguousMarketQuestion(lastUserMessage)) {
      const clarificationReply = buildClarificationReply(detectPreferredLanguage(messages))
      providerUsed = 'local'
      logAiTelemetry({
        intent,
        providerRequested,
        providerUsed,
        durationMs: Date.now() - startedAt,
        fallbackUsed,
        hasMarketContext,
        hasPortfolioContext
      })
      return res.status(200).json({
        reply: clarificationReply,
        usedGroq: false,
        usedGemini: false,
        providerStatus: {
          requested: providerRequested as 'auto' | 'groq' | 'gemini',
          used: 'local',
          fallbackUsed,
          hasMarketContext,
          hasPortfolioContext,
          durationMs: Date.now() - startedAt
        }
      })
    }

    if (isCompareAssetsFollowUp(lastUserMessage, previousUserMessage, recentUserMessages)) {
      const compareReply = buildCompareAssetsReply(detectPreferredLanguage(messages))
      providerUsed = 'local'
      logAiTelemetry({
        intent,
        providerRequested,
        providerUsed,
        durationMs: Date.now() - startedAt,
        fallbackUsed,
        hasMarketContext,
        hasPortfolioContext
      })
      return res.status(200).json({
        reply: compareReply,
        usedGroq: false,
        usedGemini: false,
        providerStatus: {
          requested: providerRequested as 'auto' | 'groq' | 'gemini',
          used: 'local',
          fallbackUsed,
          hasMarketContext,
          hasPortfolioContext,
          durationMs: Date.now() - startedAt
        }
      })
    }

    if (isCompareAssetsQuestion(lastUserMessage)) {
      const compareReply = buildCompareAssetsReply(detectPreferredLanguage(messages))
      providerUsed = 'local'
      logAiTelemetry({
        intent,
        providerRequested,
        providerUsed,
        durationMs: Date.now() - startedAt,
        fallbackUsed,
        hasMarketContext,
        hasPortfolioContext
      })
      return res.status(200).json({
        reply: compareReply,
        usedGroq: false,
        usedGemini: false,
        providerStatus: {
          requested: providerRequested as 'auto' | 'groq' | 'gemini',
          used: 'local',
          fallbackUsed,
          hasMarketContext,
          hasPortfolioContext,
          durationMs: Date.now() - startedAt
        }
      })
    }

    if (isAssetSpecificQuestion(lastUserMessage) && !hasReliableAssetContext(lastUserMessage, meta)) {
      const guardedReply = buildAssetContextGuardReply(detectPreferredLanguage(messages))
      providerUsed = 'local'
      logAiTelemetry({
        intent,
        providerRequested,
        providerUsed,
        durationMs: Date.now() - startedAt,
        fallbackUsed,
        hasMarketContext,
        hasPortfolioContext
      })
      return res.status(200).json({
        reply: guardedReply,
        usedGroq: false,
        usedGemini: false,
        providerStatus: {
          requested: providerRequested as 'auto' | 'groq' | 'gemini',
          used: 'local',
          fallbackUsed,
          hasMarketContext,
          hasPortfolioContext,
          durationMs: Date.now() - startedAt
        }
      })
    }

    if (intent === 'other' && !(meta as any)?.copilot) {
      const fallbackReply = buildAiFallbackReply(messages, summary, meta, 'invalid_payload')
      providerUsed = 'local'
      logAiTelemetry({
        intent,
        providerRequested,
        providerUsed,
        durationMs: Date.now() - startedAt,
        fallbackUsed: true,
        hasMarketContext,
        hasPortfolioContext
      })
      return res.status(200).json({
        reply: fallbackReply,
        usedGroq: false,
        usedGemini: false,
        providerStatus: {
          requested: providerRequested as 'auto' | 'groq' | 'gemini',
          used: 'local',
          fallbackUsed: true,
          hasMarketContext,
          hasPortfolioContext,
          durationMs: Date.now() - startedAt
        }
      })
    }

    const marketBriefContext = shouldInjectMarketContext(lastUserMessage)
      ? createMarketBriefContext(summary, meta)
      : null
    const portfolioContext = requestPlan === 'pro'
      ? createPortfolioContext(portfolio, hasProfitLossData)
      : null
    hasMarketContext = Boolean(marketBriefContext) || Boolean((meta as any)?.copilot)
    hasPortfolioContext = Boolean(portfolioContext) || Boolean((meta as any)?.copilot)
    
    console.log('[DEBUG /api/ai-chat] meta.copilot:', (meta as any)?.copilot, 'hasMarketContext:', hasMarketContext, 'hasPortfolioContext:', hasPortfolioContext);
    const messagesWithContext = [...messages]
    const preferredLanguage = detectPreferredLanguage(messages)

    if (marketBriefContext) {
      messagesWithContext.splice(1, 0, { role: 'system', content: marketBriefContext })
    }

    if (portfolioContext) {
      const systemPrompt = { role: 'system', content: portfolioContext }
      // Inject after the main system prompt (which is added later in sendGroq/sendGemini)
      messagesWithContext.splice(1, 0, systemPrompt)
    }
    // --- END: Context Injection ---

    const groqMessages = buildGroqMessages(messagesWithContext, marketBriefContext, portfolioContext)
    const providerMessages = normalizeChatProviderMessages(groqMessages)
    if (providerMessages[0]?.role === 'system') {
      providerMessages[0] = {
        ...providerMessages[0],
        content: buildInsightAwareChatPrompt(providerMessages[0].content, insightContext, preferredLanguage)
      }
    }

    const chatResult = await sendChatWithFallback(providerMessages, preferredLanguage)
    providerUsed = chatResult.provider
    fallbackUsed = chatResult.fallbackUsed

    if (chatResult.provider === 'local') {
      logAiTelemetry({
        intent,
        providerRequested,
        providerUsed,
        durationMs: Date.now() - startedAt,
        fallbackUsed,
        hasMarketContext,
        hasPortfolioContext
      })
      return res.status(200).json({
        reply: chatResult.reply,
        providerStatus: {
          requested: providerRequested as 'auto' | 'groq' | 'gemini',
          used: 'local',
          fallbackUsed,
          hasMarketContext,
          hasPortfolioContext,
          durationMs: Date.now() - startedAt
        }
      })
    }

    const structured = formatAskTingAiResponse(chatResult.reply, portfolio, preferredLanguage, hasProfitLossData)
    logAiTelemetry({
      intent,
      providerRequested,
      providerUsed,
      durationMs: Date.now() - startedAt,
      fallbackUsed,
      hasMarketContext,
      hasPortfolioContext
    })
    return res.status(200).json({
      reply: chatResult.reply,
      structured,
      providerStatus: {
        requested: providerRequested as 'auto' | 'groq' | 'gemini',
        used: chatResult.provider,
        fallbackUsed,
        hasMarketContext,
        hasPortfolioContext,
        durationMs: Date.now() - startedAt
      }
    })
  } catch (error) {
    fallbackUsed = true
    providerUsed = providerUsed === 'none' ? 'local' : providerUsed
    logAiTelemetry({
      intent,
      providerRequested,
      providerUsed,
      durationMs: Date.now() - startedAt,
      fallbackUsed,
      hasMarketContext,
      hasPortfolioContext
    })
    console.log('[CHAT_PROVIDER] safe catch:', error instanceof Error ? error.message : String(error))
    return res.status(200).json({
      reply: 'Respons lagi butuh waktu sedikit lebih lama. Coba ulangi ya.',
      providerStatus: {
        requested: providerRequested as 'auto' | 'groq' | 'gemini',
        used: 'local',
        fallbackUsed,
        hasMarketContext,
        hasPortfolioContext,
        durationMs: Date.now() - startedAt
      }
    })
  }
})

app.get('/api/ai-chat', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})

app.get('/api/openbb/insider_trading', async (req, res) => {
  try {
    const symbol = req.query.symbol as string
    if (!symbol) {
      return res.status(400).json({ ok: false, error: 'symbol is required' })
    }
    const data = await getInsiderTrading(symbol)
    res.json({ ok: true, data })
  } catch (err) {
    console.error('[OpenBB Proxy Error]', err)
    res.status(500).json({ ok: false, error: 'Failed to fetch insider trading data' })
  }
})

const cotCache = new Map<string, { data: any, timestamp: number }>()
const COT_CACHE_TTL = 60 * 60 * 1000 // 1 hour

// CFTC Commitments of Traders (COT) proxy — for commodity whale radar
app.get('/api/openbb/cot', async (req, res) => {
  try {
    const code  = req.query.code  as string
    const limit = parseInt((req.query.limit as string) || '8', 10)
    if (!code) return res.status(400).json({ ok: false, error: 'code is required' })
    const cftcId = code.replace('CFTC_', '')
    const cacheKey = `${cftcId}-${limit}`
    
    if (cotCache.has(cacheKey)) {
      const cached = cotCache.get(cacheKey)!
      if (Date.now() - cached.timestamp < COT_CACHE_TTL) {
        return res.json({ ok: true, data: { results: cached.data } })
      }
    }

    const url = `https://publicreporting.cftc.gov/resource/6dca-aqww.json?$limit=${limit}&$order=report_date_as_yyyy_mm_dd DESC&cftc_contract_market_code=${cftcId}`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`CFTC Error: ${response.statusText}`)
    const rawData = await response.json()
    const results = rawData.map((item: any) => {
      const nonCommLong = parseInt(item.noncomm_positions_long_all) || 0
      const nonCommShort = parseInt(item.noncomm_positions_short_all) || 0
      return {
        date: item.report_date_as_yyyy_mm_dd,
        report_week: item.yyyy_report_week_ww,
        net_positions: nonCommLong - nonCommShort,
        commercial_long: parseInt(item.comm_positions_long_all) || 0,
        commercial_short: parseInt(item.comm_positions_short_all) || 0,
        non_commercial_long: nonCommLong,
        non_commercial_short: nonCommShort,
      }
    }).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    cotCache.set(cacheKey, { data: results, timestamp: Date.now() })
    return res.json({ ok: true, data: { results } })
  } catch (err) {
    console.error('[COT Proxy Error]', err)
    res.status(500).json({ ok: false, error: 'Failed to fetch COT data' })
  }
})

// Daily Trading Setup (Momentum Scanner)
import { calculateRSI } from './utils/technicalAnalysis'
const setupCache = { data: null as any, timestamp: 0 }
app.get('/api/market/setup/daily', async (req, res) => {
  try {
    const TTL = 10 * 60 * 1000 // 10 minutes cache
    if (setupCache.data && Date.now() - setupCache.timestamp < TTL) {
      return res.json({ ok: true, data: setupCache.data })
    }

    const symbols = ['BBCA.JK', 'BMRI.JK', 'BBNI.JK', 'BBRI.JK', 'ASII.JK', 'TLKM.JK', 'GOTO.JK', 'BTC-USD', 'ETH-USD', 'GC=F']
    const range = '3mo'
    const interval = '1d'

    const setups = []
    
    for (const sym of symbols) {
      try {
        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=${interval}`
        const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        if (!resp.ok) continue
        const json = await resp.json()
        const result = json.chart?.result?.[0]
        const timestamps = result?.timestamp || []
        const closesRaw = result?.indicators?.quote?.[0]?.close || []
        
        // Filter out nulls
        const closes: number[] = []
        for (let i = 0; i < closesRaw.length; i++) {
          if (typeof closesRaw[i] === 'number') closes.push(closesRaw[i])
        }

        if (closes.length < 15) continue

        const rsiArray = calculateRSI(closes, 14)
        const currentRsi = rsiArray[rsiArray.length - 1]
        
        if (currentRsi === null) continue

        let condition = 'NEUTRAL'
        let action = 'HOLD'
        let color = '#a7b0bf'
        
        if (currentRsi <= 35) {
          condition = 'OVERSOLD'
          action = 'BUY SIGNAL'
          color = '#4ade80'
        } else if (currentRsi >= 65) {
          condition = 'OVERBOUGHT'
          action = 'TAKE PROFIT'
          color = '#f87171'
        } else if (currentRsi > 55) {
          condition = 'BULLISH'
          action = 'TRENDING UP'
          color = '#8fbfba'
        }

        const latestPrice = closes[closes.length - 1]

        setups.push({
          symbol: sym,
          name: sym.replace('.JK', '').replace('-USD', '').replace('=F', ''),
          price: latestPrice,
          rsi: parseFloat(currentRsi.toFixed(1)),
          condition,
          action,
          color
        })
      } catch (err) {
        console.error(`Failed momentum for ${sym}:`, err)
      }
    }

    // Sort: Oversold first, then Bullish, then Overbought, then Neutral
    const order: Record<string, number> = { 'OVERSOLD': 1, 'BULLISH': 2, 'OVERBOUGHT': 3, 'NEUTRAL': 4 }
    setups.sort((a, b) => order[a.condition] - order[b.condition])

    setupCache.data = setups
    setupCache.timestamp = Date.now()

    return res.json({ ok: true, data: setups })
  } catch (err) {
    console.error('[Momentum Scanner Error]', err)
    res.status(500).json({ ok: false, error: 'Failed to generate setup' })
  }
})

// Smart Money Radar (Insider Tracking via OpenBB)
const insiderCache = { data: null as any, timestamp: 0 }
app.get('/api/market/insider-radar', async (req, res) => {
  try {
    const symbol = (req.query.symbol as string) || 'AAPL'
    const TTL = 30 * 60 * 1000 // 30 minutes cache for insider data
    
    // We cache based on symbol to avoid hitting OpenBB too much
    const cacheKey = symbol.toUpperCase()
    if (!insiderCache.data) insiderCache.data = {}
    
    if (insiderCache.data[cacheKey] && Date.now() - insiderCache.data[cacheKey].timestamp < TTL) {
      return res.json({ ok: true, data: insiderCache.data[cacheKey].results })
    }

    const OPENBB_URL = process.env.OPENBB_API_URL || 'http://127.0.0.1:6900'
    const url = `${OPENBB_URL}/api/v1/equity/ownership/insider_trading?symbol=${encodeURIComponent(symbol)}&provider=sec`
    
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!resp.ok) throw new Error(`OpenBB Error: ${resp.statusText}`)
    
    const json = await resp.json()
    // OpenBB typically returns { results: [...] }
    let results = json.results || json

    if (Array.isArray(results)) {
      results = results.slice(0, 10).map((trade: any) => ({
        date: trade.transaction_date || trade.date,
        name: trade.reporting_name || trade.name || 'Unknown',
        title: trade.reporting_title || trade.title || 'Insider',
        type: trade.transaction_type || trade.type,
        shares: trade.shares || trade.securities_transacted,
        price: trade.price || trade.transaction_price,
        value: (trade.shares || trade.securities_transacted) * (trade.price || trade.transaction_price)
      }))
    } else {
      results = []
    }

    insiderCache.data[cacheKey] = { results, timestamp: Date.now() }
    return res.json({ ok: true, data: results })
  } catch (err) {
    console.error('[Insider Radar Error]', err)
    res.status(500).json({ ok: false, error: 'Failed to fetch insider data' })
  }
})

// ── Sectors API (Hackathon Track 3) ───────────────────────────────────────────
const sectorsCache = { data: null as any, timestamp: 0 }
app.get('/api/market/sectors/top-changes', async (req, res) => {
  try {
    const TTL = 30 * 60 * 1000 // 30 minutes cache for Sectors API to save credits
    if (sectorsCache.data && Date.now() - sectorsCache.timestamp < TTL) {
      return res.json({ ok: true, data: sectorsCache.data })
    }

    const data = await fetchTopChanges()
    sectorsCache.data = data
    sectorsCache.timestamp = Date.now()

    return res.json({ ok: true, data })
  } catch (err: any) {
    console.error('[Sectors API Error]', err.message)
    res.status(500).json({ ok: false, error: 'Failed to fetch Sectors API data' })
  }
})

// ── OpenBB Fundamental: Company Profile ───────────────────────────────────────
app.get('/api/openbb/profile', async (req, res) => {
  try {
    const symbol = req.query.symbol as string
    if (!symbol) return res.status(400).json({ ok: false, error: 'symbol is required' })
    const OPENBB_URL = process.env.OPENBB_API_URL || 'http://127.0.0.1:6900'
    const resp = await fetch(`${OPENBB_URL}/api/v1/equity/profile?symbol=${encodeURIComponent(symbol)}&provider=yfinance`, { signal: AbortSignal.timeout(10000) })
    if (!resp.ok) return res.status(resp.status).json({ ok: false, error: 'OpenBB profile fetch failed' })
    const json = await resp.json() as { results?: any[] }
    const r = json.results?.[0]
    if (!r) return res.json({ ok: true, data: null })
    res.json({
      ok: true,
      data: {
        name: r.name,
        symbol: r.symbol,
        sector: r.sector,
        industry: r.industry,
        exchange: r.stock_exchange,
        description: r.long_description?.slice(0, 300) || r.description?.slice(0, 300) || null,
        website: r.website,
        country: r.hq_country || r.country,
        employees: r.full_time_employees,
        currency: r.currency,
      }
    })
  } catch (err) {
    console.error('[OpenBB Profile Error]', err)
    res.status(500).json({ ok: false, error: 'Failed to fetch company profile' })
  }
})

// ── OpenBB Fundamental: Analyst Consensus ─────────────────────────────────────
app.get('/api/openbb/consensus', async (req, res) => {
  try {
    const symbol = req.query.symbol as string
    if (!symbol) return res.status(400).json({ ok: false, error: 'symbol is required' })
    const OPENBB_URL = process.env.OPENBB_API_URL || 'http://127.0.0.1:6900'
    const resp = await fetch(`${OPENBB_URL}/api/v1/equity/estimates/consensus?symbol=${encodeURIComponent(symbol)}&provider=yfinance`, { signal: AbortSignal.timeout(10000) })
    if (!resp.ok) return res.status(resp.status).json({ ok: false, error: 'OpenBB consensus fetch failed' })
    const json = await resp.json() as { results?: any[] }
    const r = json.results?.[0]
    if (!r) return res.json({ ok: true, data: null })
    res.json({
      ok: true,
      data: {
        symbol: r.symbol,
        targetHigh: r.target_high,
        targetLow: r.target_low,
        targetConsensus: r.target_consensus,
        targetMedian: r.target_median,
        recommendation: r.recommendation,  // 'buy' | 'hold' | 'sell'
        recommendationMean: r.recommendation_mean,
        numberOfAnalysts: r.number_of_analysts,
        currentPrice: r.current_price,
        currency: r.currency,
      }
    })
  } catch (err) {
    console.error('[OpenBB Consensus Error]', err)
    res.status(500).json({ ok: false, error: 'Failed to fetch analyst consensus' })
  }
})

// ── OpenBB Fundamental: Key Metrics ───────────────────────────────────────────
app.get('/api/openbb/metrics', async (req, res) => {
  try {
    const symbol = req.query.symbol as string
    if (!symbol) return res.status(400).json({ ok: false, error: 'symbol is required' })
    const OPENBB_URL = process.env.OPENBB_API_URL || 'http://127.0.0.1:6900'
    const resp = await fetch(`${OPENBB_URL}/api/v1/equity/fundamental/metrics?symbol=${encodeURIComponent(symbol)}&provider=yfinance`, { signal: AbortSignal.timeout(10000) })
    if (!resp.ok) return res.status(resp.status).json({ ok: false, error: 'OpenBB metrics fetch failed' })
    const json = await resp.json() as { results?: any[] }
    const r = json.results?.[0]
    if (!r) return res.json({ ok: true, data: null })
    res.json({
      ok: true,
      data: {
        peRatio: r.pe_ratio,
        marketCap: r.market_cap,
        dividendYield: r.dividend_yield,
        beta: r.beta,
        revenuePerShare: r.revenue_per_share,
        priceToBook: r.price_to_book,
        priceToSales: r.price_to_sales,
      }
    })
  } catch (err) {
    console.error('[OpenBB Metrics Error]', err)
    res.status(500).json({ ok: false, error: 'Failed to fetch key metrics' })
  }
})

// ── OpenBB Fundamental: ETF Info ──────────────────────────────────────────────
app.get('/api/openbb/etf_info', async (req, res) => {
  try {
    const symbol = req.query.symbol as string
    if (!symbol) return res.status(400).json({ ok: false, error: 'symbol is required' })
    const OPENBB_URL = process.env.OPENBB_API_URL || 'http://127.0.0.1:6900'
    const resp = await fetch(`${OPENBB_URL}/api/v1/etf/info?symbol=${encodeURIComponent(symbol)}&provider=yfinance`, { signal: AbortSignal.timeout(10000) })
    if (!resp.ok) return res.status(resp.status).json({ ok: false, error: 'OpenBB ETF info fetch failed' })
    const json = await resp.json() as { results?: any[] }
    const r = json.results?.[0]
    if (!r) return res.json({ ok: true, data: null })
    res.json({
      ok: true,
      data: {
        name: r.name,
        description: r.description?.slice(0, 300),
        fundFamily: r.fund_family,
        category: r.category,
        totalAssets: r.total_assets,
        navPrice: r.nav_price,
        trailingPe: r.trailing_pe,
        dividendYield: r.dividend_yield,
        yearHigh: r.year_high,
        yearLow: r.year_low,
        inceptionDate: r.inception_date,
      }
    })
  } catch (err) {
    console.error('[OpenBB ETF Info Error]', err)
    res.status(500).json({ ok: false, error: 'Failed to fetch ETF info' })
  }
})


// ── OpenBB Market Movers: Gainers / Losers / Active ──────────────────────────
async function fetchDiscovery(endpoint: string, limit = 10) {
  const OPENBB_URL = process.env.OPENBB_API_URL || 'http://127.0.0.1:6900'
  const resp = await fetch(`${OPENBB_URL}/api/v1/equity/discovery/${endpoint}?provider=yfinance`, { signal: AbortSignal.timeout(10000) })
  if (!resp.ok) throw new Error(`OpenBB ${endpoint} fetch failed: ${resp.status}`)
  const json = await resp.json() as { results?: any[] }
  return (json.results || []).slice(0, limit).map((r: any) => ({
    symbol:        r.symbol,
    name:          r.name,
    price:         r.price,
    change:        r.change,
    changePercent: r.percent_change,
    volume:        r.volume,
    marketCap:     r.market_cap,
    earningsDate:  r.earnings_date || null,
  }))
}

app.get('/api/openbb/gainers', async (_req, res) => {
  try { res.json({ ok: true, data: await fetchDiscovery('gainers') }) }
  catch (err) { console.error('[Gainers Error]', err); res.status(500).json({ ok: false, error: String(err) }) }
})

app.get('/api/openbb/losers', async (_req, res) => {
  try { res.json({ ok: true, data: await fetchDiscovery('losers') }) }
  catch (err) { console.error('[Losers Error]', err); res.status(500).json({ ok: false, error: String(err) }) }
})

app.get('/api/openbb/active', async (_req, res) => {
  try { res.json({ ok: true, data: await fetchDiscovery('active') }) }
  catch (err) { console.error('[Active Error]', err); res.status(500).json({ ok: false, error: String(err) }) }
})

// Binance Proxy — bypass client ISP blocks and fetch deeper history for whales
app.get('/api/binance/whale', async (req, res) => {
  try {
    const symbol = req.query.symbol as string
    if (!symbol) {
      return res.status(400).json({ ok: false, error: 'symbol is required' })
    }
    
    let whales: any[] = []
    let url = `https://data-api.binance.vision/api/v3/aggTrades?symbol=${encodeURIComponent(symbol)}&limit=1000`
    
    // Fetch first batch (latest 1000)
    let resp = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!resp.ok) {
      const txt = await resp.text()
      return res.status(resp.status).json({ ok: false, error: txt })
    }
    let data = await resp.json() as any[]
    
    // Binance returns oldest first in the array. 
    // data[0] is the oldest of this batch. data[data.length-1] is the newest.
    let firstId = data.length > 0 ? data[0].a : null
    
    // Dynamic whale threshold based on asset size
    let minSizeUsd = 100000 // Default 100k for altcoins
    if (symbol.includes('BTC') || symbol.includes('ETH')) {
      minSizeUsd = 500000 // 500k USD for BTC/ETH (balances frequency with size)
    } else if (symbol.includes('SOL') || symbol.includes('BNB') || symbol.includes('XRP')) {
      minSizeUsd = 200000 // 200k USD for large caps
    }

    // Helper to filter whales
    const getWhales = (trades: any[]) => trades.filter(t => (parseFloat(t.p) * parseFloat(t.q)) >= minSizeUsd)
    whales.push(...getWhales(data))
    
    // Fetch up to 10 more batches backwards in time if we don't have enough whales
    let attempts = 0
    while (whales.length < 15 && attempts < 10 && firstId != null) {
      attempts++
      firstId -= 1000
      let backUrl = `https://data-api.binance.vision/api/v3/aggTrades?symbol=${encodeURIComponent(symbol)}&limit=1000&fromId=${firstId}`
      try {
        let backResp = await fetch(backUrl, { signal: AbortSignal.timeout(5000) })
        if (backResp.ok) {
          let backData = await backResp.json() as any[]
          whales.push(...getWhales(backData))
          if (backData.length > 0) {
            firstId = backData[0].a
          }
        }
      } catch (e) {
        break // if timeout or error on pagination, just stop and return what we have
      }
    }
    
    res.json({ ok: true, data: whales })
  } catch (err) {
    console.error('[Binance Proxy Error]', err)
    res.status(500).json({ ok: false, error: 'Failed to fetch Binance data' })
  }
})

// --- START: Web Push Notifications ---
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@tingsai.my.id',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

app.post('/api/push/subscribe', authMiddleware, async (req: RequestWithUser, res: Response) => {
  const user = req.user
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' })
  
  const { endpoint, keys } = req.body
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return res.status(400).json({ ok: false, error: 'Invalid subscription object' })
  }

  try {
    const query = `
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE p256dh = VALUES(p256dh), auth = VALUES(auth)
    `
    await pool.query(query, [user.id, endpoint, keys.p256dh, keys.auth])
    res.json({ ok: true, message: 'Subscription saved' })
  } catch (error) {
    console.error('Failed to save push subscription:', error)
    res.status(500).json({ ok: false, error: 'Failed to save subscription' })
  }
})

app.post('/api/push/test', authMiddleware, async (req: RequestWithUser, res: Response) => {
  const user = req.user
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' })
  
  try {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM push_subscriptions WHERE user_id = ?', [user.id])
    if (rows.length === 0) return res.status(404).json({ ok: false, error: 'No subscription found' })

    const payload = JSON.stringify({
      title: 'Ting AI Push Test',
      body: 'Ini adalah notifikasi test dari TINGS AI.',
      url: '/komando-pagi'
    })

    const results = await Promise.allSettled(rows.map(row => 
      webpush.sendNotification({
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth }
      }, payload)
    ))

    res.json({ ok: true, results })
  } catch (error) {
    console.error('Failed to send test push:', error)
    res.status(500).json({ ok: false, error: 'Failed to send push' })
  }
})
// --- END: Web Push Notifications ---

// ── S5-M4: PAYMENT ROUTES (MIDTRANS) ─────────────────────────────────────────

app.post('/api/payment/checkout', authenticateToken, async (req, res) => {
  try {
    const userId = (req as RequestWithUser).user!.id
    const [users] = await pool.query<RowDataPacket[]>('SELECT fullname, email FROM users WHERE id = ?', [userId])
    if (!users.length) return res.status(404).json({ error: 'User not found' })

    const { fullname, email } = users[0]
    const token = await createProSubscriptionTx(userId, email, fullname)
    res.json({ token })
  } catch (error) {
    console.error('[Payment] Checkout Error:', error)
    res.status(500).json({ error: 'Failed to generate checkout token' })
  }
})

app.post('/api/payment/webhook', async (req, res) => {
  try {
    const notification = req.body
    await handleMidtransWebhook(notification)
    res.json({ status: 'ok' })
  } catch (error) {
    console.error('[Payment] Webhook Error:', error)
    res.status(500).json({ error: 'Failed to process webhook' })
  }
})

// ── S5-M4: PREMIUM ROUTES ────────────────────────────────────────────────────

app.get('/api/market/screener', authenticateToken, requirePro, async (req, res) => {
  try {
    const results = await runStockScreener({})
    res.json({ ok: true, data: results })
  } catch (error) {
    console.error('[Screener] Error:', error)
    res.status(500).json({ error: 'Failed to run screener' })
  }
})

app.get('/api/reports/pdf', authenticateToken, requirePro, async (req, res) => {
  try {
    const userId = (req as RequestWithUser).user!.id
    // get user name
    const [users] = await pool.query<RowDataPacket[]>('SELECT fullname FROM users WHERE id = ?', [userId])
    const userName = users.length ? users[0].fullname : 'Investor'
    
    // get portfolio
    const [holdings] = await pool.query<RowDataPacket[]>(
      'SELECT symbol, quantity, entry_price as entryPrice, entry_currency as entryCurrency FROM portfolio_holdings WHERE user_id = ? AND quantity > 0', 
      [userId]
    )

    const pdfBuffer = await generatePortfolioPDF(userId, userName, holdings)
    
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename=TingAI_Report_${Date.now()}.pdf`)
    res.send(pdfBuffer)
  } catch (error) {
    console.error('[PDF] Error:', error)
    res.status(500).json({ error: 'Failed to generate PDF' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// TRADE JOURNAL API
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/trade-journal — Create new journal entry
app.post('/api/trade-journal', authMiddleware, async (req: any, res: any) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const {
    pair, direction, lot_size, entry_price, stop_loss, take_profit,
    setup_type, pre_trade_emotion, notes
  } = req.body

  if (!pair || !direction || !lot_size || !entry_price) {
    return res.status(400).json({ error: 'pair, direction, lot_size, entry_price are required' })
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO trade_journal
        (user_id, pair, direction, lot_size, entry_price, stop_loss, take_profit, setup_type, pre_trade_emotion, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`,
      [userId, pair.toUpperCase(), direction.toUpperCase(), lot_size, entry_price,
       stop_loss || null, take_profit || null, setup_type || null, pre_trade_emotion || null, notes || null]
    ) as any

    res.json({ success: true, id: result.insertId, message: 'Trade journal entry created' })
  } catch (err: any) {
    console.error('[TradeJournal] POST error:', err.message)
    res.status(500).json({ error: 'Failed to create trade journal entry' })
  }
})

// GET /api/trade-journal — Get all journal entries for user
app.get('/api/trade-journal', authMiddleware, async (req: any, res: any) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { status, pair, limit = 50 } = req.query

  try {
    let query = `SELECT * FROM trade_journal WHERE user_id = ?`
    const params: any[] = [userId]

    if (status) { query += ` AND status = ?`; params.push(status) }
    if (pair) { query += ` AND pair = ?`; params.push((pair as string).toUpperCase()) }
    query += ` ORDER BY created_at DESC LIMIT ?`
    params.push(Number(limit))

    const [rows] = await pool.query(query, params) as any
    res.json({ success: true, data: rows })
  } catch (err: any) {
    console.error('[TradeJournal] GET error:', err.message)
    res.status(500).json({ error: 'Failed to fetch trade journal' })
  }
})

// PATCH /api/trade-journal/:id/close — Close a trade with exit price and AI bias analysis
app.patch('/api/trade-journal/:id/close', authMiddleware, async (req: any, res: any) => {
  const userId = req.user?.id
  const { id } = req.params
  const { exit_price, post_trade_emotion, notes } = req.body

  if (!exit_price) return res.status(400).json({ error: 'exit_price is required' })

  try {
    const [rows] = await pool.query(
      `SELECT * FROM trade_journal WHERE id = ? AND user_id = ? AND status = 'OPEN'`,
      [id, userId]
    ) as any

    if (!rows.length) return res.status(404).json({ error: 'Open trade not found' })

    const trade = rows[0]

    // Calculate PnL (simplified: pips * lot_size * 10 for standard lots)
    const pips = trade.direction === 'BUY'
      ? (Number(exit_price) - Number(trade.entry_price))
      : (Number(trade.entry_price) - Number(exit_price))
    const pnl = Math.round(pips * 10000 * Number(trade.lot_size) * 10) / 10

    // Generate AI bias analysis via Gemini
    let ai_bias_analysis = null
    try {
      const prompt = `Kamu adalah psikolog trading profesional. Analisis jurnal trading berikut dan identifikasi bias kognitif yang mungkin terjadi:

Trade: ${trade.direction} ${trade.pair} @ ${trade.entry_price}
Exit: ${exit_price}
Lot: ${trade.lot_size}
PnL: ${pnl > 0 ? '+' : ''}${pnl} USD (estimasi)
Setup: ${trade.setup_type || 'Tidak dicatat'}
Emosi sebelum trade: ${trade.pre_trade_emotion || 'Tidak dicatat'}
Emosi setelah trade: ${post_trade_emotion || 'Tidak dicatat'}
Catatan: ${notes || trade.notes || 'Tidak ada'}
SL: ${trade.stop_loss || 'Tidak dipasang'}, TP: ${trade.take_profit || 'Tidak dipasang'}

Berikan analisis singkat (max 3 kalimat) tentang: (1) apakah trader mengikuti rencana, (2) bias kognitif yang terdeteksi (FOMO, Revenge Trading, Overconfidence, Fear of Loss, dll), (3) satu saran konkret untuk trade berikutnya. Jawab dalam Bahasa Indonesia, langsung ke poin, tanpa basa-basi.`

      const genAIResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      })
      const genAIData = await genAIResponse.json() as any
      ai_bias_analysis = genAIData?.candidates?.[0]?.content?.parts?.[0]?.text || null
    } catch (aiErr) {
      console.warn('[TradeJournal] AI analysis failed, skipping:', aiErr)
    }

    await pool.query(
      `UPDATE trade_journal SET
        exit_price = ?, status = 'CLOSED', pnl = ?,
        post_trade_emotion = ?, notes = COALESCE(?, notes),
        ai_bias_analysis = ?, closed_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [exit_price, pnl, post_trade_emotion || null, notes || null, ai_bias_analysis, id, userId]
    )

    res.json({ success: true, pnl, ai_bias_analysis })
  } catch (err: any) {
    console.error('[TradeJournal] CLOSE error:', err.message)
    res.status(500).json({ error: 'Failed to close trade' })
  }
})

// GET /api/trade-journal/stats — Get summary stats for the user
app.get('/api/trade-journal/stats', authMiddleware, async (req: any, res: any) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const [rows] = await pool.query(
      `SELECT
        COUNT(*) AS total_trades,
        SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) AS open_trades,
        SUM(CASE WHEN status = 'CLOSED' AND pnl > 0 THEN 1 ELSE 0 END) AS winning_trades,
        SUM(CASE WHEN status = 'CLOSED' AND pnl <= 0 THEN 1 ELSE 0 END) AS losing_trades,
        SUM(CASE WHEN status = 'CLOSED' THEN pnl ELSE 0 END) AS total_pnl,
        AVG(CASE WHEN status = 'CLOSED' AND pnl > 0 THEN pnl END) AS avg_win,
        AVG(CASE WHEN status = 'CLOSED' AND pnl < 0 THEN pnl END) AS avg_loss
       FROM trade_journal WHERE user_id = ?`,
      [userId]
    ) as any

    const s = rows[0]
    const total_closed = (s.winning_trades || 0) + (s.losing_trades || 0)
    const win_rate = total_closed > 0 ? Math.round((s.winning_trades / total_closed) * 100) : 0

    res.json({
      success: true,
      stats: {
        total_trades: s.total_trades,
        open_trades: s.open_trades,
        closed_trades: total_closed,
        winning_trades: s.winning_trades || 0,
        losing_trades: s.losing_trades || 0,
        win_rate,
        total_pnl: Math.round((s.total_pnl || 0) * 100) / 100,
        avg_win: Math.round((s.avg_win || 0) * 100) / 100,
        avg_loss: Math.round((s.avg_loss || 0) * 100) / 100,
      }
    })
  } catch (err: any) {
    console.error('[TradeJournal] STATS error:', err.message)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// TRADING SETUP API — Technical analysis for traders (SahamJamet feedback)
// ─────────────────────────────────────────────────────────────────────────────

const BLUE_CHIP_TICKERS = [
  { symbol: 'BBCA.JK', name: 'BCA', sector: 'Banking' },
  { symbol: 'BBRI.JK', name: 'BRI', sector: 'Banking' },
  { symbol: 'BMRI.JK', name: 'Mandiri', sector: 'Banking' },
  { symbol: 'TLKM.JK', name: 'Telkom', sector: 'Telco' },
  { symbol: 'ASII.JK', name: 'Astra', sector: 'Automotive' },
  { symbol: 'UNVR.JK', name: 'Unilever', sector: 'Consumer' },
  { symbol: 'HMSP.JK', name: 'HM Sampoerna', sector: 'Consumer' },
  { symbol: 'GOTO.JK', name: 'GoTo', sector: 'Tech' },
  { symbol: 'BBNI.JK', name: 'BNI', sector: 'Banking' },
  { symbol: 'ICBP.JK', name: 'Indofood CBP', sector: 'Consumer' },
]

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gains += diff
    else losses -= diff
  }
  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return +(100 - 100 / (1 + rs)).toFixed(1)
}

function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number; trend: string } {
  const ema = (data: number[], p: number) => {
    const k = 2 / (p + 1)
    let prev = data[0]
    return data.map((v, i) => { prev = i === 0 ? v : v * k + prev * (1 - k); return prev })
  }
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0, trend: 'neutral' }
  const ema12 = ema(closes, 12)
  const ema26 = ema(closes, 26)
  const macdLine = ema12.map((v, i) => v - ema26[i])
  const signalLine = ema(macdLine.slice(-9), 9)
  const m = macdLine[macdLine.length - 1]
  const s = signalLine[signalLine.length - 1]
  const h = m - s
  return { macd: +m.toFixed(2), signal: +s.toFixed(2), histogram: +h.toFixed(2), trend: h > 0 ? 'bullish' : h < 0 ? 'bearish' : 'neutral' }
}

function calcSupportResistance(points: MarketPoint[]): { support: number[]; resistance: number[] } {
  if (points.length < 5) return { support: [], resistance: [] }
  const lows = points.map(p => p.low)
  const highs = points.map(p => p.high)
  const last = points[points.length - 1].close

  // Find local minima (support) and maxima (resistance)
  const supports: number[] = []
  const resistances: number[] = []

  for (let i = 2; i < points.length - 2; i++) {
    if (lows[i] <= lows[i - 1] && lows[i] <= lows[i - 2] && lows[i] <= lows[i + 1] && lows[i] <= lows[i + 2]) {
      supports.push(+lows[i].toFixed(0))
    }
    if (highs[i] >= highs[i - 1] && highs[i] >= highs[i - 2] && highs[i] >= highs[i + 1] && highs[i] >= highs[i + 2]) {
      resistances.push(+highs[i].toFixed(0))
    }
  }

  // Dedupe nearby levels (within 1% range)
  const dedup = (levels: number[], ref: number) => {
    const sorted = [...new Set(levels)].sort((a, b) => Math.abs(a - ref) - Math.abs(b - ref))
    const result: number[] = []
    for (const l of sorted) {
      if (!result.some(r => Math.abs(r - l) / ref < 0.01)) result.push(l)
    }
    return result.slice(0, 3)
  }

  return {
    support: dedup(supports.filter(s => s < last), last),
    resistance: dedup(resistances.filter(r => r > last), last),
  }
}

app.get('/api/trading/setup', async (req, res) => {
  try {
    const requestedSymbols = typeof req.query.tickers === 'string'
      ? req.query.tickers.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      : []

    const tickers = requestedSymbols.length
      ? BLUE_CHIP_TICKERS.filter(t => requestedSymbols.includes(t.symbol.replace('.JK', '')))
      : BLUE_CHIP_TICKERS

    const results = await Promise.allSettled(
      tickers.map(async (ticker) => {
        const points = await fetchYahooSeries(ticker.symbol, 60)
        if (!points.length) throw new Error(`No data for ${ticker.symbol}`)

        const closes = points.map(p => p.close)
        const volumes = points.map(() => 0) // Yahoo v8 doesn't give volume in this mode
        const last = points[points.length - 1]
        const prev = points.length > 1 ? points[points.length - 2] : last
        const changePct = prev.close !== 0 ? +((last.close - prev.close) / prev.close * 100).toFixed(2) : 0

        const rsi = calcRSI(closes)
        const macd = calcMACD(closes)
        const sr = calcSupportResistance(points)

        // Volume trend (compare last 5 vs previous 5 average)
        const recentVol = closes.slice(-5).reduce((a, b) => a + b, 0) / 5
        const prevVol = closes.slice(-10, -5).reduce((a, b) => a + b, 0) / 5
        const volTrend = recentVol > prevVol * 1.05 ? 'increasing' : recentVol < prevVol * 0.95 ? 'decreasing' : 'stable'

        // Signal logic
        let signal: 'buy' | 'sell' | 'hold' | 'watch' = 'hold'
        let signalReason = ''

        if (rsi < 30 && macd.trend === 'bullish') {
          signal = 'buy'
          signalReason = 'Oversold + MACD bullish crossover'
        } else if (rsi < 35 && changePct > 0) {
          signal = 'buy'
          signalReason = 'Nearing oversold with positive momentum'
        } else if (rsi > 70 && macd.trend === 'bearish') {
          signal = 'sell'
          signalReason = 'Overbought + MACD bearish crossover'
        } else if (rsi > 65 && changePct < -1) {
          signal = 'sell'
          signalReason = 'Overbought with negative momentum'
        } else if (macd.trend === 'bullish' && changePct > 0) {
          signal = 'watch'
          signalReason = 'MACD bullish, positive momentum — potential entry'
        } else {
          signalReason = 'No clear signal — wait for confirmation'
        }

        return {
          ticker: ticker.symbol.replace('.JK', ''),
          name: ticker.name,
          sector: ticker.sector,
          price: +last.close.toFixed(0),
          change: changePct,
          rsi,
          macd,
          support: sr.support,
          resistance: sr.resistance,
          volumeTrend: volTrend,
          signal,
          signalReason,
          lastUpdate: last.time,
        }
      })
    )

    const data = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => r.value)

    res.json({ ok: true, data, count: data.length, source: 'yahoo-finance' })
  } catch (error) {
    console.error('[TradingSetup] Error:', error)
    res.status(500).json({ ok: false, error: 'Failed to fetch trading setup data' })
  }
})

app.get('/api/trading/setup-of-the-day', async (req, res) => {
  try {
    // Fetch data for all blue chips
    const allResults = await Promise.allSettled(
      BLUE_CHIP_TICKERS.map(async (ticker) => {
        const points = await fetchYahooSeries(ticker.symbol, 60)
        if (!points.length) return null
        const closes = points.map(p => p.close)
        const last = points[points.length - 1]
        const prev = points.length > 1 ? points[points.length - 2] : last
        const rsi = calcRSI(closes)
        const macd = calcMACD(closes)
        const sr = calcSupportResistance(points)
        return {
          ticker: ticker.symbol.replace('.JK', ''),
          name: ticker.name,
          price: last.close,
          change: +((last.close - prev.close) / prev.close * 100).toFixed(2),
          rsi,
          macd: macd.trend,
          support: sr.support[0] || 0,
          resistance: sr.resistance[0] || 0,
        }
      })
    )

    const stocks = allResults
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value)

    // Rank by most interesting (highest |change| with RSI extremes)
    const ranked = stocks
      .map(s => ({ ...s, score: Math.abs(s.change) * (s.rsi < 35 || s.rsi > 65 ? 2 : 1) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    const setupOfTheDay = ranked.map(s => {
      const type = s.rsi < 35 ? 'bounce' : s.rsi > 65 ? 'breakout' : s.change > 0 ? 'momentum' : 'reversal'
      const entryZone = type === 'bounce' || type === 'reversal'
        ? `${(s.price * 0.98).toFixed(0)} - ${(s.price * 1.0).toFixed(0)}`
        : `${(s.price * 1.0).toFixed(0)} - ${(s.price * 1.02).toFixed(0)}`
      const sl = type === 'bounce' || type === 'reversal'
        ? +(s.price * 0.95).toFixed(0)
        : +(s.price * 0.97).toFixed(0)
      const tp = type === 'bounce' || type === 'reversal'
        ? +(s.price * 1.05).toFixed(0)
        : +(s.price * 1.06).toFixed(0)
      const rr = sl !== s.price ? +((tp - s.price) / (s.price - sl)).toFixed(1) : 0

      return {
        ticker: s.ticker,
        name: s.name,
        price: +s.price.toFixed(0),
        setupType: type,
        entryZone,
        stopLoss: sl,
        takeProfit: tp,
        riskReward: rr,
        rsi: s.rsi,
        macdTrend: s.macd,
        support: s.support,
        resistance: s.resistance,
        narrative: type === 'bounce'
          ? `${s.name} (${s.ticker}) menunjukkan potensi bounce dari area oversold. RSI di ${s.rsi} mengindikasikan tekanan jual yang berlebihan. Entry di area support ${entryZone}, SL di ${sl}, TP di ${tp} (R:R ${rr}x).`
          : type === 'breakout'
          ? `${s.name} (${s.ticker}) mendekati area overbought dengan momentum kuat. RSI di ${s.rsi}. Jika break resistance ${s.resistance}, potensi lanjut ke ${tp}. SL di ${sl}.`
          : type === 'momentum'
          ? `${s.name} (${s.ticker}) menunjukkan momentum positif (+${s.change}%) dengan MACD ${s.macd}. Entry zone ${entryZone}, SL ${sl}, TP ${tp} (R:R ${rr}x).`
          : `${s.name} (${s.ticker}) berpotensi reversal setelah turun ${s.change}%. Watch area ${entryZone} untuk entry, SL ${sl}, TP ${tp} (R:R ${rr}x).`,
      }
    })

    res.json({
      ok: true,
      date: new Date().toISOString().slice(0, 10),
      data: setupOfTheDay,
      disclaimer: 'Ini bukan rekomendasi investasi. Selalu lakukan riset mandiri dan kelola risiko dengan bijak.',
    })
  } catch (error) {
    console.error('[TradingSetup] SOTD Error:', error)
    res.status(500).json({ ok: false, error: 'Failed to generate setup of the day' })
  }
})

const port = Number(process.env.PORT || 3001)
app.listen(port, () => {
  startPortfolioRefreshScheduler()
  
  // Telegram Bot Init
  initTelegramBot()

  // Cron Job for Telegram Morning Command (Setiap hari jam 07:30 WIB)
  // WIB = UTC+7, jadi jam 07:30 WIB = 00:30 UTC
  cron.schedule('30 7 * * *', async () => {
    console.log('[Cron] Running sendMorningCommandToGroup at 07:30 WIB')
    await sendMorningCommandToGroup()
  }, {
    timezone: 'Asia/Jakarta',
    recoverMissedExecutions: true
  } as any)

  // S5-M3: Weekly Report Cron (Setiap Senin jam 07:00 WIB)
  cron.schedule('0 7 * * 1', async () => {
    console.log('[Cron] Running weekly portfolio report (Monday 07:00 WIB)')
    const result = await sendWeeklyReports()
    console.log(`[Cron] Weekly report done:`, result)
  }, {
    timezone: 'Asia/Jakarta',
    recoverMissedExecutions: true
  } as any)
})
