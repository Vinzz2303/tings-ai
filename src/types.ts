import type { ReactNode } from 'react'

export type SectionProps = {
  sectionId: string
}

export type AiRole = 'system' | 'user' | 'assistant'

export type AiMessage = {
  role: AiRole
  content: string
  structured?: AskTingAiStructuredResponse
  image?: string
}

export type AiChatSession = {
  id: string
  title: string
  provider: 'groq' | 'gemini'
  messages: AiMessage[]
  updatedAt: string
}

export type InstrumentSummary = {
  instrument: string
  latestDate?: string
  previousDate?: string
  latestPrice?: number
  previousPrice?: number
  delta?: number
  pct?: number
  unit?: string
  error?: string
}

export type BriefSection = {
  title: 'What Changed' | 'Why It Matters' | 'What To Watch'
  body: string
}

export type MarketDriver = {
  label: string
  signal: 'bullish' | 'bearish' | 'mixed' | 'neutral'
  detail: string
}

export type MarketWatchItem = {
  label: string
  detail: string
  priority: 'high' | 'medium' | 'low'
}

export type MarketHeadline = {
  title: string
  source: string
  url: string
  publishedAt: string
  whyItMatters: string
  theme: 'macro' | 'rates' | 'dollar' | 'equities' | 'commodities' | 'crypto' | 'geopolitics' | 'other'
  relevance: 'high' | 'medium' | 'low'
}

export type SemanticVolatilityTrend = 'rising' | 'stable' | 'falling'
export type SemanticMacroPressure = 'tightening' | 'easing' | 'neutral'
export type SemanticMarketStress = 'elevated' | 'normal'
export type SemanticBreadthTone = 'weakening' | 'limited' | 'constructive' | 'mixed'
export type SemanticMarketTone = 'defensive' | 'constructive' | 'mixed'
export type SemanticScreenerTone = 'weakening' | 'selective_strength' | 'broad_strength' | 'mixed'
export type SemanticProviderStatus = 'live' | 'fallback' | 'unavailable'

export type SemanticSignals = {
  breadthTone: SemanticBreadthTone
  marketTone: SemanticMarketTone
  screenerTone: SemanticScreenerTone
  volatilityTrend: SemanticVolatilityTrend
  macroPressure: SemanticMacroPressure
  marketStress: SemanticMarketStress
  meta?: {
    source: 'multi_provider' | 'openbb' | 'fallback'
    ts: number
    latencyMs?: number
    note?: string | null
    providers?: {
      polygon: SemanticProviderStatus
      fmp: SemanticProviderStatus
      fred: SemanticProviderStatus
    }
  }
}

export type MarketContext = {
  riskTone: string
  regime: string
  conviction: string
  stressState: string
  macroContext: string
  geopoliticContext: string
  externalContext: string
  externalWhyItMatters: string
  headlinePressure: string
  watchLevel: string
  overnightContext: string
  drivers: MarketDriver[]
  macroSignals: MarketDriver[]
  stressDrivers: string[]
  headlines: MarketHeadline[]
  watchItems: MarketWatchItem[]
  semanticSignals?: SemanticSignals
}

export type InvestmentMeta = {
  usedGroq?: boolean
  antamLiveError?: string | null
  instruments?: {
    ANTAM?: InstrumentSummary
    SP500?: InstrumentSummary
    IHSG?: InstrumentSummary
    BTC?: InstrumentSummary
  }
  briefing?: BriefSection[]
  context?: MarketContext
}

export type InvestmentSummaryResponse = {
  summary?: string
  meta?: InvestmentMeta | null
  accessLevel?: 'free' | 'pro'
  isPreview?: boolean
  previewNote?: string | null
}

export type AiProviderStatus = {
  requested: 'auto' | 'groq' | 'gemini'
  used: 'local' | 'groq' | 'gemini' | 'error'
  fallbackUsed: boolean
  hasMarketContext?: boolean
  hasPortfolioContext?: boolean
  durationMs?: number
}

export type AiChatResponse = {
  reply?: string
  usedGroq?: boolean
  usedGemini?: boolean
  providerStatus?: AiProviderStatus
}

export type AskTingAiStructuredResponse = {
  direct_answer: string
  why_it_matters: string[]
  risk_note: string
  suggested_next_step: 'monitor' | 'wait' | 'rebalance' | 'reduce_exposure'
}

export type TingRawInsight = {
  insightUtama: string
  alasan: string[]
  risiko: string[]
  arahan: string
}

export type TingRefinedInsight = TingRawInsight & {
  providerStatus?: {
    used: 'gemini' | 'groq' | 'local'
    fallbackDepth: number
    durationMs: number
    failures?: Array<{
      provider: 'gemini' | 'groq'
      reason: string
      durationMs: number
    }>
  }
}

export type TingRefineResponse = {
  insight?: TingRefinedInsight
}

export type CandlestickPoint = {
  time: string | number
  open: number
  high: number
  low: number
  close: number
}

export type MarketSeriesResponse = {
  data?: CandlestickPoint[]
  note?: string
  source?: string
  fallback?: string
}

export type AntamCardData = {
  price: number | null
  change: number
  updatedAt: string
}

export type GoldCardData = {
  price: number | null
  change: number
  updatedAt: string
}

export type LoginResponse = {
  token?: string
  user?: {
    id?: number
    fullname?: string
    email?: string
    plan?: string
    isPro?: boolean
    is_pro?: boolean
    proUntil?: string | null
    pro_until?: string | null
    planExpiresAt?: string | null
    subscriptionStatus?: string | null
    subscription_status?: string | null
    emailVerified?: boolean
  }
}

export type AuthUserProfile = {
  id?: number
  fullname: string
  email: string
  plan?: string
  isPro?: boolean
  is_pro?: boolean
  proUntil?: string | null
  pro_until?: string | null
  planExpiresAt?: string | null
  subscriptionStatus?: string | null
  subscription_status?: string | null
  emailVerified?: boolean
}

export type AuthSessionResponse = {
  authenticated?: boolean
  user?: AuthUserProfile | null
}

export type AccountProfileResponse = {
  user?: AuthUserProfile | null
}

export type ProUpgradeRequestStatus = 'draft' | 'pending' | 'approved' | 'rejected'

export type ProUpgradeRequest = {
  id: number
  userId: number
  fullName: string
  email: string
  senderName: string
  transferDate: string
  proofFileName: string | null
  proofUrl?: string | null
  notes: string | null
  status: ProUpgradeRequestStatus
  adminNote?: string | null
  approvedAt?: string | null
  expiresAt?: string | null
  createdAt: string
  updatedAt: string
}

export type ProUpgradeStatusResponse = {
  request?: ProUpgradeRequest | null
}

export type ProUpgradeSubmitResponse = {
  id?: number
  status?: ProUpgradeRequestStatus
  message?: string
  error?: string
}

export type AdminStatsResponse = {
  totalUsers?: number
  pendingProRequests?: number
  approvedProRequests?: number
  rejectedProRequests?: number
  recentUsers?: Array<{
    id: number
    fullname: string
    email: string
    createdAt: string | Date | null
  }>
  recentRequests?: ProUpgradeRequest[]
  error?: string
}

export type ProtectedRouteProps = {
  children: ReactNode
}

export type AssetMasterItem = {
  id: number
  symbol: string
  name: string
  assetType: 'stock' | 'index' | 'crypto' | 'commodity'
  region: string
  provider?: string | null
  providerSymbol?: string | null
  quoteCurrency: string
}

export type AssetListResponse = {
  assets?: AssetMasterItem[]
}

export type PortfolioHoldingItem = {
  id: number
  assetId: number
  symbol: string
  name: string
  assetType: 'stock' | 'index' | 'crypto' | 'commodity'
  region: string
  quantity: number
  entryPrice: number
  investedAmount: number
  investedAmountDisplay?: number | null
  latestPrice?: number | null
  currentValue?: number | null
  pnl?: number | null
  pnlPct?: number | null
  dayChange?: number | null
  dayChangePct?: number | null
  trend?: 'up' | 'down' | 'flat'
  entryCurrency?: string
  quoteCurrency: string
  displayCurrency?: string
  fxStatus?: 'live' | 'fallback' | 'unavailable'
  fetchedAt?: string | null
  notes?: string | null
  openedAt?: string | null
}

export type PortfolioHoldingsResponse = {
  holdings?: PortfolioHoldingItem[]
}

export type PortfolioSummaryTotals = {
  totalInvested: number
  totalCurrentValue: number
  totalPnl: number
  totalPnlPct?: number | null
  totalHoldings: number
  displayCurrency?: string
}

export type PortfolioSummaryResponse = {
  summary?: PortfolioSummaryTotals
  holdings?: PortfolioHoldingItem[]
  accessLevel?: 'free' | 'pro'
  isPreview?: boolean
}
