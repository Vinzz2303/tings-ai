import axios from 'axios'
import type { RowDataPacket } from 'mysql2'
import pool from '../db'
import type {
  BriefSection,
  MarketHeadline,
  InstrumentSummary,
  InvestmentSummaryResult,
  MarketContext,
  MarketDriver,
  MarketWatchItem,
  SemanticSignals
} from '../types'
import { getCollaborativeSemanticSignals } from './semanticSignalsAdapter'
import { getXauSpot } from './xauSpot'

type LatestDateRow = RowDataPacket & {
  latestDate: Date | string | null
}

type PriceRow = RowDataPacket & {
  price_close: number | string
  timestamp: Date | string
}

type TreasuryYieldResponse = {
  data?: Array<{
    date?: string
    value?: string
  }>
  Note?: string
  Information?: string
}

type DailySeriesResponse = {
  'Time Series (Daily)'?: Record<
    string,
    {
      '1. open'?: string
      '2. high'?: string
      '3. low'?: string
      '4. close'?: string
    }
  >
  Note?: string
  Information?: string
}

type GlobalQuoteResponse = {
  'Global Quote'?: {
    '05. price'?: string
    '08. previous close'?: string
    '09. change'?: string
    '10. change percent'?: string
  }
  Note?: string
  Information?: string
}

type CoinGeckoSimplePriceResponse = Record<
  string,
  {
    usd?: number
    usd_24h_change?: number
  }
>

type AlphaVantageNewsArticle = {
  title?: string
  url?: string
  time_published?: string
  source?: string
  summary?: string
  topics?: Array<{ topic?: string; relevance_score?: string }>
  overall_sentiment_score?: number | string
}

type AlphaVantageNewsResponse = {
  feed?: AlphaVantageNewsArticle[]
  Note?: string
  Information?: string
}

type MarketauxNewsArticle = {
  title?: string
  url?: string
  published_at?: string
  source?: string
  description?: string
}

type MarketauxNewsResponse = {
  data?: MarketauxNewsArticle[]
}

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[]
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>
        }>
      }
    }>
    error?: {
      description?: string
    } | null
  }
}

type HeadlineTheme = MarketHeadline['theme']

type HeadlineCandidate = MarketHeadline & {
  score: number
  sortTime: number
}

const headlineSourceRank: Record<string, number> = {
  reuters: 10,
  bloomberg: 10,
  wsj: 9,
  'wall street journal': 9,
  ft: 9,
  'financial times': 9,
  cnbc: 8,
  'yahoo finance': 8,
  'finance.yahoo.com': 8,
  marketwatch: 8,
  barrons: 8,
  'associated press': 8,
  ap: 8,
  benzinga: 6,
  tradingview: 5,
  cointelegraph: 5,
  cryptorank: 4,
  'the coin republic': 4,
  'national today': 2
}

const macroProxyCache: Record<string, { timestamp: number; value: InstrumentSummary | null }> = {
  UUP: { timestamp: 0, value: null },
  US10Y: { timestamp: 0, value: null }
}

const deltaSign = (value: number) => (value >= 0 ? '+' : '-')

const formatPercent = (pct: number) => {
  const abs = Math.abs(pct)
  return `${deltaSign(pct)}${abs.toFixed(2)}%`
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

const formatPrice = (instrument: InstrumentSummary, value: number | undefined) => {
  if (value === undefined || Number.isNaN(value)) return '-'

  if (instrument.instrument === 'XAUUSD' || instrument.instrument === 'ANTAM') {
    return idrFormatter.format(value)
  }

  return usNumberFormatter.format(value)
}

const formatDelta = (instrument: InstrumentSummary, delta: number) => {
  const abs = Math.abs(delta)

  if (instrument.instrument === 'XAUUSD' || instrument.instrument === 'ANTAM') {
    return `${delta >= 0 ? '+' : '-'}${idrFormatter.format(abs)}`
  }

  return `${delta >= 0 ? '+' : '-'}${usNumberFormatter.format(abs)} points`
}

const toDateOnly = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null)

const getStrongestMove = (instruments: InstrumentSummary[]) =>
  [...instruments]
    .filter((instrument) => !instrument.error && instrument.pct !== undefined)
    .sort((a, b) => Math.abs(b.pct ?? 0) - Math.abs(a.pct ?? 0))[0] || null

const getMovementLabel = (instrument: InstrumentSummary) => {
  const pct = instrument.pct ?? 0
  if (pct > 0) return 'moved higher'
  if (pct < 0) return 'moved lower'
  return 'held flat'
}

const getMacroCacheTtlMs = () => Number(process.env.MARKET_CACHE_TTL_MS || 60 * 60 * 1000)

const getCachedMacroProxy = (key: 'UUP' | 'US10Y') => {
  const cache = macroProxyCache[key]
  if (!cache.value) return null
  if (Date.now() - cache.timestamp > getMacroCacheTtlMs()) return null
  return cache.value
}

const setCachedMacroProxy = (key: 'UUP' | 'US10Y', value: InstrumentSummary) => {
  macroProxyCache[key] = {
    timestamp: Date.now(),
    value
  }
}

const formatPublishedAt = (value?: string) => {
  if (!value) return '-'
  const timestamp = getHeadlineTimestamp(value)
  if (!timestamp) return value
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC'
  }) + ' UTC'
}

const getHeadlineTimestamp = (value?: string) => {
  if (!value) return 0
  const normalized = /^\d{8}T\d{6}$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`
    : value.endsWith('Z')
      ? value
      : `${value}Z`
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

const getHeadlineTheme = (title: string, summary: string): HeadlineTheme => {
  const titleLower = title.toLowerCase()
  const bodyLower = summary.toLowerCase()
  const lower = `${titleLower} ${bodyLower}`

  if (
    titleLower.includes('bitcoin') ||
    titleLower.includes('crypto') ||
    titleLower.includes('btc') ||
    titleLower.includes('miner') ||
    titleLower.includes('blockchain') ||
    titleLower.includes('token')
  ) {
    return 'crypto'
  }

  if (
    titleLower.includes('stock') ||
    titleLower.includes('stocks') ||
    titleLower.includes('equities') ||
    titleLower.includes('s&p') ||
    titleLower.includes('spy') ||
    titleLower.includes('nasdaq') ||
    titleLower.includes('dow') ||
    titleLower.includes('etf trust')
  ) {
    return 'equities'
  }

  if (
    titleLower.includes('yield') ||
    titleLower.includes('treasury') ||
    titleLower.includes('fed') ||
    titleLower.includes('central bank')
  ) {
    return 'rates'
  }

  if (
    titleLower.includes('dollar') ||
    titleLower.includes('fx') ||
    titleLower.includes('currency') ||
    titleLower.includes('usd')
  ) {
    return 'dollar'
  }

  if (
    titleLower.includes('oil') ||
    titleLower.includes('gold') ||
    titleLower.includes('commodity') ||
    titleLower.includes('crude')
  ) {
    return 'commodities'
  }

  if (titleLower.includes('inflation') || titleLower.includes('economy') || titleLower.includes('growth') || titleLower.includes('jobs') || titleLower.includes('recession')) {
    return 'macro'
  }

  if (
    titleLower.includes('war') ||
    titleLower.includes('sanction') ||
    titleLower.includes('tariff') ||
    titleLower.includes('missile') ||
    titleLower.includes('middle east')
  ) {
    return 'geopolitics'
  }

  if (lower.includes('yield') || lower.includes('treasury') || lower.includes('fed') || lower.includes('central bank')) {
    return 'rates'
  }

  if (lower.includes('dollar') || lower.includes('fx') || lower.includes('currency') || lower.includes('usd')) {
    return 'dollar'
  }

  if (lower.includes('oil') || lower.includes('gold') || lower.includes('commodity') || lower.includes('crude')) {
    return 'commodities'
  }

  if (lower.includes('stock') || lower.includes('equities') || lower.includes('s&p') || lower.includes('spy') || lower.includes('nasdaq')) {
    return 'equities'
  }

  if (lower.includes('bitcoin') || lower.includes('crypto') || lower.includes('btc') || lower.includes('miner') || lower.includes('token') || lower.includes('blockchain')) {
    return 'crypto'
  }

  if (lower.includes('inflation') || lower.includes('economy') || lower.includes('growth') || lower.includes('jobs') || lower.includes('recession')) {
    return 'macro'
  }

  if (bodyLower.includes('war') || bodyLower.includes('sanction') || bodyLower.includes('tariff') || bodyLower.includes('missile') || bodyLower.includes('middle east')) {
    return 'geopolitics'
  }

  return 'other'
}

const getHeadlineRelevance = (title: string, summary: string, theme: HeadlineTheme) => {
  const lower = `${title} ${summary}`.toLowerCase()
  let score = 0

  if (theme === 'rates' || theme === 'dollar' || theme === 'geopolitics' || theme === 'macro') score += 3
  if (theme === 'equities' || theme === 'commodities' || theme === 'crypto') score += 2

  if (lower.includes('fed') || lower.includes('treasury') || lower.includes('inflation') || lower.includes('jobs')) score += 2
  if (lower.includes('war') || lower.includes('sanction') || lower.includes('tariff') || lower.includes('oil')) score += 2
  if (lower.includes('bitcoin etf') || lower.includes('etf outflow') || lower.includes('etf inflow')) score += 1

  if (score >= 4) return 'high' as const
  if (score >= 2) return 'medium' as const
  return 'low' as const
}

const getHeadlineImplication = (title: string, summary: string, theme: HeadlineTheme) => {
  const lower = `${title} ${summary}`.toLowerCase()

  if (theme === 'rates' || lower.includes('rate') || lower.includes('fed')) {
    return 'This matters because rates and policy expectations can shift pressure on equities, BTC, and the broader risk backdrop.'
  }

  if (theme === 'dollar') {
    return 'This matters because dollar pressure can confirm or weaken the current risk read across crypto, equities, and gold.'
  }

  if (theme === 'geopolitics' || (theme === 'commodities' && lower.includes('oil'))) {
    return 'This matters because geopolitical stress can strengthen defensive assets and reduce confidence in aggressive risk positioning.'
  }

  if (theme === 'equities') {
    return 'This matters because equity-specific headlines can confirm whether the broader risk tape is improving or starting to fade.'
  }

  if (theme === 'commodities') {
    return 'This matters because commodity-linked headlines can reshape inflation expectations, defensive demand, and cross-asset positioning.'
  }

  if (theme === 'crypto') {
    return 'This matters because crypto-specific headlines can accelerate or contradict the cross-asset risk signal.'
  }

  if (theme === 'macro') {
    return 'This matters because macro headlines can quickly change the market backdrop for yields, equities, BTC, and defensive assets.'
  }

  return 'This matters because it may confirm, weaken, or complicate the current cross-asset market read.'
}

const getHeadlineScore = (relevance: MarketHeadline['relevance'], theme: HeadlineTheme, title: string, summary: string) => {
  const lower = `${title} ${summary}`.toLowerCase()
  let score = relevance === 'high' ? 6 : relevance === 'medium' ? 4 : 2

  if (theme === 'macro' || theme === 'rates' || theme === 'dollar' || theme === 'geopolitics') score += 2
  if (theme === 'equities' || theme === 'commodities') score += 1

  if (lower.includes('fed') || lower.includes('inflation') || lower.includes('treasury')) score += 1
  if (lower.includes('war') || lower.includes('sanction') || lower.includes('tariff')) score += 1

  return score
}

const getHeadlineSourceScore = (source: string) => {
  const lower = source.toLowerCase()
  for (const [key, score] of Object.entries(headlineSourceRank)) {
    if (lower.includes(key)) return score
  }
  return 3
}

const selectBalancedHeadlines = (candidates: HeadlineCandidate[]) => {
  if (!candidates.length) return []

  const sorted = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const sourceDelta = getHeadlineSourceScore(b.source) - getHeadlineSourceScore(a.source)
    if (sourceDelta !== 0) return sourceDelta
    return b.sortTime - a.sortTime
  })

  const selected: HeadlineCandidate[] = []
  const seenUrls = new Set<string>()
  const themeCount = new Map<HeadlineTheme, number>()
  const sourceCount = new Map<string, number>()

  const pickPass = (pass: 'diverse' | 'fill') => {
    for (const item of sorted) {
      if (selected.length >= 3) break
      if (seenUrls.has(item.url)) continue

      const themeHits = themeCount.get(item.theme) || 0
      const sourceKey = item.source.toLowerCase()
      const sourceHits = sourceCount.get(sourceKey) || 0

      if (pass === 'diverse') {
        if (themeHits >= 1) continue
        if (sourceHits >= 1) continue
      } else {
        if (themeHits >= 2) continue
        if (sourceHits >= 1) continue
      }

      selected.push(item)
      seenUrls.add(item.url)
      themeCount.set(item.theme, themeHits + 1)
      sourceCount.set(sourceKey, sourceHits + 1)
    }
  }

  pickPass('diverse')
  pickPass('fill')

  return selected.map(({ score: _score, sortTime: _sortTime, ...item }) => item)
}

const summarizeExternalHeadlineState = (headlines: MarketHeadline[]) => {
  if (!headlines.length) {
    return {
      headlinePressure: 'Unavailable',
      externalContext: 'External headline context is not available right now.',
      externalWhyItMatters: 'Without live headlines, users should rely on price action, stress state, and macro signals until the source trail refreshes.'
    }
  }

  const highCount = headlines.filter((item) => item.relevance === 'high').length
  const themes = new Set(headlines.map((item) => item.theme))
  const cryptoHeavy = themes.size === 1 && themes.has('crypto')
  const macroHeavy = (['macro', 'rates', 'dollar'] as HeadlineTheme[]).some((theme) => themes.has(theme))
  const geopoliticsHeavy = themes.has('geopolitics') || (themes.has('commodities') && headlines.some((item) => item.theme === 'commodities'))

  const headlinePressure =
    highCount >= 2
      ? 'Elevated External Pressure'
      : highCount === 1 || headlines.length >= 2
        ? 'Active External Pressure'
        : 'Low External Pressure'

  if (cryptoHeavy) {
    return {
      headlinePressure,
      externalContext:
        'Headline flow is active, but the current coverage is concentrated in crypto-specific stories rather than broad macro confirmation.',
      externalWhyItMatters:
        'That means the news flow can move BTC sentiment quickly, but it is not yet strong enough to redefine the broader cross-asset market read on its own.'
    }
  }

  if (macroHeavy) {
    return {
      headlinePressure,
      externalContext:
        'Headline flow is reinforcing macro sensitivity across policy, rates, or growth expectations. That makes the market brief more vulnerable to fresh confirmation or contradiction from external events.',
      externalWhyItMatters:
        'That matters because macro headlines can change yields, the dollar, and the quality of any risk-on move faster than one isolated chart move can explain.'
    }
  }

  if (geopoliticsHeavy) {
    return {
      headlinePressure,
      externalContext:
        'Headline flow is carrying geopolitical or commodity-linked pressure that can challenge risk appetite even if price action still looks mixed.',
      externalWhyItMatters:
        'That matters because geopolitical stress usually shows up first through defensive demand, energy pressure, or sudden weakness in high-beta assets.'
    }
  }

  return {
    headlinePressure,
    externalContext:
      'External headlines are present and worth monitoring, but they are still acting as a confirmation layer rather than the main driver of the market brief.',
    externalWhyItMatters:
      'That matters because outside events can either validate the current market read or expose that price action is running ahead of the real narrative.'
  }
}

const getExternalContextLite = async (): Promise<{
  externalContext: string
  externalWhyItMatters: string
  headlinePressure: string
  headlines: MarketHeadline[]
}> => {
  const apiKey = process.env.ALPHAVANTAGE_API_KEY
  if (!apiKey) {
    return {
      externalContext: 'External headline context is unavailable because the news source API key is missing.',
      externalWhyItMatters: 'Without a live headline feed, this layer cannot confirm whether external events are reinforcing or challenging the market brief.',
      headlinePressure: 'Unavailable',
      headlines: []
    }
  }

  try {
    const urls = [
      `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=financial_markets,economy_macro,blockchain&limit=8&sort=LATEST&apikey=${encodeURIComponent(apiKey)}`,
      `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=SPY,GLD,BTCUSD&limit=8&sort=LATEST&apikey=${encodeURIComponent(apiKey)}`,
      `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=financial_markets&limit=8&sort=LATEST&apikey=${encodeURIComponent(apiKey)}`,
      `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&limit=8&sort=LATEST&apikey=${encodeURIComponent(apiKey)}`
    ]

    let headlines: MarketHeadline[] = []

    for (const url of urls) {
      const response = await axios.get<AlphaVantageNewsResponse>(url, { timeout: 12000 })
      const feed = response.data?.feed || []

      const candidates = feed
        .filter((item) => item.title && item.url && item.source)
        .slice(0, 10)
        .map((item) => {
          const title = item.title || 'Untitled headline'
          const description = item.summary || ''
          const theme = getHeadlineTheme(title, description)
          const relevance = getHeadlineRelevance(title, description, theme)
          return {
            title,
            source: item.source || 'Unknown source',
            url: item.url || '#',
            publishedAt: formatPublishedAt(item.time_published),
            whyItMatters: getHeadlineImplication(title, description, theme),
            relevance,
            theme,
            score: getHeadlineScore(relevance, theme, title, description),
            sortTime: getHeadlineTimestamp(item.time_published)
          } satisfies HeadlineCandidate
        })

      const selected = selectBalancedHeadlines(candidates)

      if (selected.length) {
        headlines = selected
        break
      }
    }

    if (!headlines.length) {
      const marketauxToken = process.env.MARKETAUX_API_TOKEN
      if (marketauxToken) {
        try {
          const marketauxUrl =
            `https://api.marketaux.com/v1/news/all?api_token=${encodeURIComponent(
              marketauxToken
            )}&language=en&limit=8&sort=published_desc&symbols=SPY,GLD,BTC-USD,QQQ`
          const marketauxResponse = await axios.get<MarketauxNewsResponse>(marketauxUrl, { timeout: 12000 })
          const marketauxHeadlines = (marketauxResponse.data?.data || [])
            .filter((item) => item.title && item.url && item.source)
            .map((item) => {
              const title = item.title || 'Untitled headline'
              const description = item.description || ''
              const theme = getHeadlineTheme(title, description)
              const relevance = getHeadlineRelevance(title, description, theme)
              return {
                title,
                source: item.source || 'Unknown source',
                url: item.url || '#',
                publishedAt: formatPublishedAt(item.published_at),
                whyItMatters: getHeadlineImplication(title, description, theme),
                relevance,
                theme,
                score: getHeadlineScore(relevance, theme, title, description),
                sortTime: getHeadlineTimestamp(item.published_at)
              } satisfies HeadlineCandidate
            })

          const selected = selectBalancedHeadlines(marketauxHeadlines)

          if (selected.length) {
            headlines = selected
          }
        } catch {
          // Keep falling through to unavailable state.
        }
      }
    }

    if (!headlines.length) {
      return {
        externalContext: 'External headline context is not available right now.',
        externalWhyItMatters: 'This means the market brief is currently being driven by price action and macro proxies without fresh external headline confirmation.',
        headlinePressure: 'Unavailable',
        headlines: []
      }
    }

    const externalRead = summarizeExternalHeadlineState(headlines)

    return {
      externalContext: externalRead.externalContext,
      externalWhyItMatters: externalRead.externalWhyItMatters,
      headlinePressure: externalRead.headlinePressure,
      headlines
    }
  } catch {
    return {
      externalContext: 'External headline context could not be refreshed right now.',
      externalWhyItMatters: 'This layer is temporarily blind, so rely on the market brief and stress state until the headline feed recovers.',
      headlinePressure: 'Unavailable',
      headlines: []
    }
  }
}

const getMoveScore = (
  instrument: InstrumentSummary,
  direction: 'risk' | 'defensive'
) => {
  if (instrument.error || instrument.pct === undefined) return 0

  const absPct = Math.abs(instrument.pct)
  const baseScore = absPct >= 2 ? 2 : absPct >= 0.6 ? 1 : 0
  if (baseScore === 0) return 0

  const sign = instrument.pct > 0 ? 1 : instrument.pct < 0 ? -1 : 0
  return direction === 'risk' ? sign * baseScore : sign * baseScore * -1
}

const getSignalLabel = (score: number): MarketDriver['signal'] => {
  if (score > 0) return 'bullish'
  if (score < 0) return 'bearish'
  return 'neutral'
}

const getPriorityLabel = (priorityScore: number): MarketWatchItem['priority'] => {
  if (priorityScore >= 2) return 'high'
  if (priorityScore === 1) return 'medium'
  return 'low'
}

const getDirectionText = (value: number | undefined, positiveLabel: string, negativeLabel: string) => {
  if (value === undefined || Number.isNaN(value) || value === 0) return 'flat'
  return value > 0 ? positiveLabel : negativeLabel
}

const getYahooChartFallback = async (
  symbol: string,
  instrument: string,
  source: string
): Promise<InstrumentSummary> => {
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`
    const response = await axios.get<YahooChartResponse>(url, { timeout: 12000 })
    const result = response.data?.chart?.result?.[0]
    const timestamps = result?.timestamp || []
    const closes = result?.indicators?.quote?.[0]?.close || []

    const points = timestamps
      .map((timestamp, index) => {
        const close = closes[index]
        if (close === null || close === undefined || Number.isNaN(Number(close))) return null
        return {
          timestamp,
          close: Number(close)
        }
      })
      .filter(Boolean) as Array<{ timestamp: number; close: number }>

    const latest = points[points.length - 1]
    const previous = points[points.length - 2]

    if (!latest || !previous) {
      throw new Error(`No ${instrument} Yahoo chart comparison data available`)
    }

    const latestDate = new Date(latest.timestamp * 1000).toISOString().slice(0, 10)
    const previousDate = new Date(previous.timestamp * 1000).toISOString().slice(0, 10)
    const latestPrice = latest.close
    const previousPrice = previous.close
    const delta = latestPrice - previousPrice
    const pct = previousPrice === 0 ? 0 : (delta / previousPrice) * 100

    return {
      instrument,
      latestDate,
      previousDate,
      latestPrice,
      previousPrice,
      delta,
      pct,
      source
    }
  } catch (error) {
    return {
      instrument,
      error: error instanceof Error ? error.message : `${instrument} Yahoo fallback unavailable`
    }
  }
}

const getLatestAndPrevious = async (instrument: string): Promise<InstrumentSummary> => {
  const [latestDateRows] = await pool.query<LatestDateRow[]>(
    'SELECT DATE(MAX(`timestamp`)) AS latestDate FROM market_prices WHERE instrument_name = ?',
    [instrument]
  )

  const latestDateValue = latestDateRows[0]?.latestDate
  if (!latestDateValue) {
    return { instrument, error: 'No data available' }
  }

  const latestDate = new Date(latestDateValue)
  const latestDateStr = toDateOnly(latestDate)
  const previousDate = new Date(latestDate)
  previousDate.setDate(previousDate.getDate() - 1)
  const previousDateStr = toDateOnly(previousDate)

  const [latestRows] = await pool.query<PriceRow[]>(
    'SELECT price_close, `timestamp` FROM market_prices WHERE instrument_name = ? AND DATE(`timestamp`) = ? ORDER BY `timestamp` DESC LIMIT 1',
    [instrument, latestDateStr]
  )

  const [previousRows] = await pool.query<PriceRow[]>(
    'SELECT price_close, `timestamp` FROM market_prices WHERE instrument_name = ? AND DATE(`timestamp`) = ? ORDER BY `timestamp` DESC LIMIT 1',
    [instrument, previousDateStr]
  )

  const latest = latestRows[0]
  const previous = previousRows[0]
  if (!latest || !previous) {
    return {
      instrument,
      latestDate: latestDateStr,
      previousDate: previousDateStr,
      error: 'Missing comparison data'
    }
  }

  const latestPrice = Number(latest.price_close)
  const previousPrice = Number(previous.price_close)
  const delta = latestPrice - previousPrice
  const pct = previousPrice === 0 ? 0 : (delta / previousPrice) * 100

  return {
    instrument,
    latestDate: latestDateStr,
    previousDate: previousDateStr,
    latestPrice,
    previousPrice,
    delta,
    pct
  }
}

const getTodayDateString = () => new Date().toISOString().slice(0, 10)

const getAlphaVantageGlobalQuote = async (
  symbol: string,
  instrument: string
): Promise<InstrumentSummary> => {
  const apiKey = process.env.ALPHAVANTAGE_API_KEY
  if (!apiKey) {
    return {
      instrument,
      error: 'ALPHAVANTAGE_API_KEY missing'
    }
  }

  try {
    const url =
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`

    const response = await axios.get<GlobalQuoteResponse>(url, { timeout: 12000 })
    const quote = response.data?.['Global Quote']
    if (!quote?.['05. price']) {
      throw new Error(response.data?.Note || response.data?.Information || `No ${instrument} quote available`)
    }

    const latestPrice = Number(quote['05. price'] || 0)
    const previousPrice = Number(quote['08. previous close'] || 0)
    const delta = Number(quote['09. change'] || latestPrice - previousPrice)
    const pctText = quote['10. change percent'] || ''
    const pct = pctText ? Number(pctText.replace('%', '').trim()) : previousPrice === 0 ? 0 : (delta / previousPrice) * 100

    return {
      instrument,
      latestDate: getTodayDateString(),
      previousDate: null,
      latestPrice,
      previousPrice,
      delta,
      pct,
      source: 'alphavantage'
    }
  } catch (error) {
    return {
      instrument,
      error: error instanceof Error ? error.message : `${instrument} global quote unavailable`
    }
  }
}

const getBitcoinSpotFallback = async (): Promise<InstrumentSummary> => {
  try {
    const url =
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true'
    const response = await axios.get<CoinGeckoSimplePriceResponse>(url, { timeout: 12000 })
    const btc = response.data?.bitcoin
    if (!btc?.usd) {
      throw new Error('No bitcoin spot data available')
    }

    const latestPrice = Number(btc.usd)
    const pct = Number(btc.usd_24h_change ?? 0)
    const previousPrice = pct === -100 ? latestPrice : latestPrice / (1 + pct / 100)
    const delta = latestPrice - previousPrice

    return {
      instrument: 'BTC',
      latestDate: getTodayDateString(),
      previousDate: null,
      latestPrice,
      previousPrice,
      delta,
      pct,
      source: 'coingecko'
    }
  } catch (error) {
    return {
      instrument: 'BTC',
      error: error instanceof Error ? error.message : 'BTC unavailable'
    }
  }
}

const getIndonesiaIndexSummary = async (): Promise<InstrumentSummary> => {
  const ihsg = await getLatestAndPrevious('IHSG')
  if (!ihsg.error) {
    return {
      ...ihsg,
      source: ihsg.source || 'database'
    }
  }

  const yahooFallback = await getYahooChartFallback('^JKSE', 'IHSG', 'yahoo-finance')
  if (!yahooFallback.error) {
    return yahooFallback
  }

  return {
    instrument: 'IHSG',
    error: ihsg.error || yahooFallback.error || 'IHSG unavailable'
  }
}

const getTreasuryYield10Y = async (): Promise<InstrumentSummary> => {
  const cached = getCachedMacroProxy('US10Y')
  if (cached) return cached

  const apiKey = process.env.ALPHAVANTAGE_API_KEY
  if (!apiKey) {
    return {
      instrument: 'US10Y',
      error: 'ALPHAVANTAGE_API_KEY missing'
    }
  }

  try {
    const url =
      `https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=daily&maturity=10year&apikey=${encodeURIComponent(apiKey)}`

    const response = await axios.get<TreasuryYieldResponse>(url, { timeout: 12000 })
    const rows = response.data?.data || []
    if (!rows.length) {
      throw new Error(response.data?.Note || response.data?.Information || 'No treasury yield data available')
    }

    const latest = rows[0]
    const previous = rows[1]
    if (!latest?.date || !latest?.value || !previous?.date || !previous?.value) {
      throw new Error('Missing treasury yield comparison data')
    }

    const latestPrice = Number(latest.value)
    const previousPrice = Number(previous.value)
    const delta = latestPrice - previousPrice
    const pct = previousPrice === 0 ? 0 : (delta / previousPrice) * 100

    const result: InstrumentSummary = {
      instrument: 'US10Y',
      latestDate: latest.date,
      previousDate: previous.date,
      latestPrice,
      previousPrice,
      delta,
      pct,
      unit: '%',
      source: 'alphavantage'
    }

    setCachedMacroProxy('US10Y', result)
    return result
  } catch (error) {
    const yahooFallback = await getYahooChartFallback('^TNX', 'US10Y', 'yahoo-finance')
    if (!yahooFallback.error) {
      setCachedMacroProxy('US10Y', yahooFallback)
      return yahooFallback
    }

    return {
      instrument: 'US10Y',
      error: error instanceof Error ? error.message : yahooFallback.error || 'US10Y unavailable'
    }
  }
}

const getDollarProxyUup = async (): Promise<InstrumentSummary> => {
  const cached = getCachedMacroProxy('UUP')
  if (cached) return cached

  const apiKey = process.env.ALPHAVANTAGE_API_KEY
  if (!apiKey) {
    return {
      instrument: 'UUP',
      error: 'ALPHAVANTAGE_API_KEY missing'
    }
  }

  try {
    const url =
      `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=UUP&outputsize=compact&apikey=${encodeURIComponent(apiKey)}`

    const response = await axios.get<DailySeriesResponse>(url, { timeout: 12000 })
    const series = response.data?.['Time Series (Daily)']
    if (!series) {
      throw new Error(response.data?.Note || response.data?.Information || 'No UUP daily data available')
    }

    const dates = Object.keys(series).sort().reverse()
    const latestDate = dates[0]
    const previousDate = dates[1]
    if (!latestDate || !previousDate) {
      throw new Error('Missing UUP comparison data')
    }

    const latestPrice = Number(series[latestDate]?.['4. close'] || 0)
    const previousPrice = Number(series[previousDate]?.['4. close'] || 0)
    const delta = latestPrice - previousPrice
    const pct = previousPrice === 0 ? 0 : (delta / previousPrice) * 100

    const result: InstrumentSummary = {
      instrument: 'UUP',
      latestDate,
      previousDate,
      latestPrice,
      previousPrice,
      delta,
      pct,
      source: 'alphavantage'
    }

    setCachedMacroProxy('UUP', result)
    return result
  } catch (error) {
    const fallback = await getAlphaVantageGlobalQuote('UUP', 'UUP')
    if (!fallback.error) {
      setCachedMacroProxy('UUP', fallback)
      return fallback
    }

    const yahooFallback = await getYahooChartFallback('UUP', 'UUP', 'yahoo-finance')
    if (!yahooFallback.error) {
      setCachedMacroProxy('UUP', yahooFallback)
      return yahooFallback
    }

    return {
      instrument: 'UUP',
      error:
        error instanceof Error
          ? error.message
          : fallback.error || yahooFallback.error || 'UUP unavailable'
    }
  }
}

const buildBriefing = (
  gold: InstrumentSummary,
  sp500: InstrumentSummary,
  ihsg: InstrumentSummary,
  btc: InstrumentSummary,
  dollarProxy: InstrumentSummary,
  treasury10Y: InstrumentSummary,
  semanticSignals: SemanticSignals,
  externalHeadlineState: {
    externalContext: string
    externalWhyItMatters: string
    headlinePressure: string
    headlines: MarketHeadline[]
  }
): { briefing: BriefSection[]; context: MarketContext } => {
  const liveInstruments = [gold, sp500, btc].filter((instrument) => !instrument.error)
  const strongestMove = getStrongestMove(liveInstruments)

  const goldScore = getMoveScore(gold, 'defensive')
  const sp500Score = getMoveScore(sp500, 'risk')
  const btcScore = getMoveScore(btc, 'risk')
  const regimeScore = goldScore + sp500Score + btcScore
  const alignedPositive = [goldScore, sp500Score, btcScore].filter((score) => score > 0).length
  const alignedNegative = [goldScore, sp500Score, btcScore].filter((score) => score < 0).length
  const alignment = Math.max(alignedPositive, alignedNegative)
  const signalDispersion = Math.max(goldScore, sp500Score, btcScore) - Math.min(goldScore, sp500Score, btcScore)
  const dollarUp = !dollarProxy.error && (dollarProxy.delta ?? 0) > 0
  const yieldUp = !treasury10Y.error && (treasury10Y.delta ?? 0) > 0
  const dollarDown = !dollarProxy.error && (dollarProxy.delta ?? 0) < 0
  const yieldDown = !treasury10Y.error && (treasury10Y.delta ?? 0) < 0
  const goldFirm = !gold.error && (gold.delta ?? 0) >= 0
  const equitiesWeak = !sp500.error && (sp500.delta ?? 0) < 0
  const btcWeak = !btc.error && (btc.delta ?? 0) < 0
  const ihsgAvailable = !ihsg.error
  const ihsgDirectionText = ihsgAvailable
    ? `IHSG ${getMovementLabel(ihsg)} by ${formatPercent(ihsg.pct ?? 0)}${ihsg.latestDate ? ` on ${ihsg.latestDate}` : ''}.`
    : 'IHSG data is unavailable right now.'
  const tighteningSignals = Number(dollarUp) + Number(yieldUp)
  const defensiveSignals = Number(goldFirm) + Number(equitiesWeak) + Number(btcWeak)
  const easingSignals = Number(dollarDown) + Number(yieldDown)

  let riskTone = 'Mixed tone'
  let regime = 'Cross-asset consolidation'
  let conviction = 'Medium conviction'
  let stressState = 'Balanced stress posture'
  let macroContext =
    'Cross-asset signals are mixed, so users should read both defensive and growth-sensitive assets before acting.'
  let geopoliticContext =
    'Cross-asset stress is currently balanced. There is no strong sign yet that geopolitical or macro stress is taking control of the tape.'
  let watchLevel = 'Normal watch'

  if (regimeScore >= 4) {
    riskTone = 'Risk-on'
    regime = 'Broad risk-on expansion'
    stressState = 'Low stress posture'
    macroContext =
      'Both equity and crypto participation are constructive while the defensive gold signal is not taking control. That points to a broader appetite for risk.'
    geopoliticContext =
      'Cross-asset behavior does not suggest that macro or geopolitical stress is dominating the tape right now. The key question is durability, not panic.'
    watchLevel = 'Constructive watch'
    conviction = alignment >= 2 ? 'High conviction' : 'Medium conviction'
  } else if (regimeScore >= 2) {
    riskTone = 'Risk-on leaning'
    regime = 'Selective risk-on recovery'
    stressState = 'Contained stress posture'
    macroContext =
      'Risk assets are improving, but the move still needs broader confirmation to look like a durable regime shift rather than a tactical bounce.'
    geopoliticContext =
      'Geopolitical stress is not clearly dominating, but a reversal in gold or a loss of follow-through in equities or BTC would weaken the setup.'
    watchLevel = 'Normal watch'
    conviction = 'Medium conviction'
  } else if (regimeScore <= -4) {
    riskTone = 'Risk-off'
    regime = 'Defensive rotation'
    stressState = 'Elevated stress posture'
    macroContext =
      'Defensive demand is stronger while risk assets are losing traction. That typically points to a more fragile tape and tighter tolerance for new risk.'
    geopoliticContext =
      'Cross-asset behavior suggests elevated sensitivity to macro or geopolitical stress. Users should be more selective until defensive pressure fades.'
    watchLevel = 'Elevated watch'
    conviction = alignment >= 2 ? 'High conviction' : 'Medium conviction'
  } else if (regimeScore <= -2) {
    riskTone = 'Risk-off leaning'
    regime = 'Cautious defensive tilt'
    stressState = 'Cautious stress posture'
    macroContext =
      'Defensive assets have the stronger hand, but the tape is not yet a full defensive washout. Users should assume caution until risk assets re-stabilize.'
    geopoliticContext =
      'The market is showing more sensitivity to uncertainty than to growth optimism. That raises the importance of confirmation before adding exposure.'
    watchLevel = 'Elevated watch'
    conviction = 'Medium conviction'
  } else if (signalDispersion >= 3) {
    riskTone = 'Mixed tone'
    regime = 'High-dispersion cross-asset tape'
    stressState = 'Headline-sensitive posture'
    macroContext =
      'The market is not offering a single clean narrative. Defensive and risk-sensitive assets are sending competing signals, which usually means lower clarity.'
    geopoliticContext =
      'With no clean alignment, macro and geopolitical headlines can quickly reshape the tape. Users should avoid overreading one isolated move.'
    watchLevel = 'Elevated watch'
    conviction = 'Low conviction'
  } else {
    conviction = liveInstruments.length >= 3 ? 'Medium conviction' : 'Low conviction'
  }

  if ((riskTone === 'Risk-on' || riskTone === 'Risk-on leaning') && (dollarUp || yieldUp)) {
    regime = riskTone === 'Risk-on' ? 'Tightening-aware risk-on' : 'Fragile risk-on recovery'
    stressState = 'Contained but active macro pressure'
    macroContext =
      'Risk assets are improving, but a firmer dollar or higher long-end yields make the move less clean. That means the rally still faces macro pressure.'
    geopoliticContext =
      'Macro tightening pressure is still visible through the dollar or yields. The market is constructive, but not fully relaxed.'
    watchLevel = 'Normal watch'
    conviction = conviction === 'High conviction' ? 'Medium conviction' : conviction
  }

  if ((riskTone === 'Risk-off' || riskTone === 'Risk-off leaning') && dollarDown && yieldDown) {
    regime = 'Possible macro reset'
    stressState = 'Stress easing posture'
    macroContext =
      'Risk assets look softer, but both the dollar proxy and long-end yields are easing. That can reduce the intensity of the defensive read if follow-through appears.'
    geopoliticContext =
      'The tape is cautious, but macro pressure is not uniformly tightening. Users should watch for stabilization before assuming a deeper defensive leg.'
    conviction = 'Medium conviction'
  }

  const stressDrivers: string[] = []
  if (goldFirm) stressDrivers.push('Gold is holding or firming as the defensive anchor.')
  if (equitiesWeak) stressDrivers.push('US equities are not confirming a cleaner risk-on read.')
  if (btcWeak) stressDrivers.push('Bitcoin is leaning weaker, which keeps the high-beta signal fragile.')
  if (dollarUp) stressDrivers.push('The dollar proxy is firming and keeping macro pressure alive.')
  if (yieldUp) stressDrivers.push('Long-end yields are rising and tightening the backdrop for risk assets.')
  if (dollarDown) stressDrivers.push('The dollar proxy is easing and reducing one source of macro pressure.')
  if (yieldDown) stressDrivers.push('Long-end yields are easing and reducing one source of macro pressure.')

  if (tighteningSignals >= 1 && defensiveSignals >= 2) {
    stressState = 'Elevated cross-asset stress'
    geopoliticContext =
      'Defensive behavior is broad enough to suggest that macro or geopolitical stress is influencing positioning. Users should treat rallies as less trustworthy until pressure eases.'
    watchLevel = 'Elevated watch'
  } else if (tighteningSignals >= 1 && defensiveSignals >= 1) {
    stressState = 'Macro pressure building'
    geopoliticContext =
      'The tape is not in full defensive mode, but tighter dollar or yield conditions are adding pressure. That usually means the market remains sensitive to policy or geopolitical headlines.'
  } else if (easingSignals >= 1 && defensiveSignals <= 1 && regimeScore >= 0) {
    stressState = 'Stress easing'
    geopoliticContext =
      'Cross-asset stress is easing rather than intensifying. That does not remove headline risk, but it lowers the chance that macro or geopolitical pressure is driving the tape right now.'
  } else if (signalDispersion >= 3) {
    stressState = 'Headline-sensitive posture'
    geopoliticContext =
      'Signals remain split enough that a single macro or geopolitical headline can still reshape positioning quickly. Users should avoid treating one isolated move as a full regime shift.'
  }

  if (semanticSignals.marketStress === 'elevated' && !stressState.toLowerCase().includes('elevated')) {
    stressState = 'Elevated but controlled stress'
    watchLevel = 'Elevated watch'
  }

  if (semanticSignals.macroPressure === 'tightening') {
    macroContext = `${macroContext} Macro pressure is still restrictive in the background.`
  } else if (semanticSignals.macroPressure === 'easing') {
    macroContext = `${macroContext} Macro pressure is easing, but confirmation still matters.`
  }

  if (semanticSignals.volatilityTrend === 'rising') {
    geopoliticContext = `${geopoliticContext} Volatility pressure is still rising, so fragile moves need extra confirmation.`
  } else if (semanticSignals.volatilityTrend === 'falling') {
    geopoliticContext = `${geopoliticContext} Volatility pressure is easing, which helps reduce immediate stress.`
  }

  if (semanticSignals.breadthTone === 'weakening') {
    riskTone = riskTone === 'Risk-on' ? 'Mixed tone' : riskTone
    regime = regime === 'Broad risk-on expansion' ? 'Selective risk leadership only' : regime
    watchLevel = 'Elevated watch'
    macroContext = `${macroContext} Market breadth is still weak, so broad confirmation is missing.`
  } else if (semanticSignals.breadthTone === 'constructive' && conviction === 'Low conviction') {
    conviction = 'Medium conviction'
  }

  if (semanticSignals.marketTone === 'defensive' && !riskTone.toLowerCase().includes('risk-off')) {
    riskTone = 'Risk-off leaning'
    if (!regime.toLowerCase().includes('defensive')) regime = 'Cautious defensive tilt'
  } else if (
    semanticSignals.marketTone === 'constructive' &&
    (riskTone === 'Mixed tone' || riskTone === 'Risk-on leaning')
  ) {
    conviction = conviction === 'Low conviction' ? 'Medium conviction' : conviction
  }

  if (semanticSignals.screenerTone === 'selective_strength') {
    macroContext = `${macroContext} Strength is still selective rather than broad-based.`
  } else if (semanticSignals.screenerTone === 'broad_strength') {
    macroContext = `${macroContext} Leadership is broadening, which helps the market read look more durable.`
  } else if (semanticSignals.screenerTone === 'weakening') {
    geopoliticContext = `${geopoliticContext} Screener conditions still show more pressure than leadership.`
  }

  const drivers: MarketDriver[] = [
    {
      label: 'Gold',
      signal: getSignalLabel(goldScore),
      detail: gold.error
        ? 'Gold spot data is unavailable right now.'
        : `Gold ${getMovementLabel(gold)} by ${formatPercent(gold.pct ?? 0)}${gold.latestDate ? ` on ${gold.latestDate}` : ''}, which makes it the defensive anchor.`
    },
    {
      label: 'US Equities',
      signal: getSignalLabel(sp500Score),
      detail: sp500.error
        ? 'The US equity proxy is unavailable right now.'
        : `SPY proxy ${getMovementLabel(sp500)} by ${formatPercent(sp500.pct ?? 0)}${sp500.latestDate ? ` on ${sp500.latestDate}` : ''}, shaping the core risk read.`
    },
    {
      label: 'Bitcoin',
      signal: getSignalLabel(btcScore),
      detail: btc.error
        ? 'BTC data is unavailable right now.'
        : `BTC ${getMovementLabel(btc)} by ${formatPercent(btc.pct ?? 0)}${btc.latestDate ? ` on ${btc.latestDate}` : ''}, giving a high-beta signal for risk appetite.`
    },
    {
      label: 'Indonesia Equities',
      signal: ihsg.error
        ? 'neutral'
        : (ihsg.delta ?? 0) > 0
          ? 'bullish'
          : (ihsg.delta ?? 0) < 0
            ? 'bearish'
            : 'neutral',
      detail: ihsg.error
        ? 'IHSG data is unavailable right now.'
        : `IHSG ${getMovementLabel(ihsg)} by ${formatPercent(ihsg.pct ?? 0)}${ihsg.latestDate ? ` on ${ihsg.latestDate}` : ''}, giving a direct read on Indonesia equity sentiment.`
    }
  ]

  const macroSignals: MarketDriver[] = [
    {
      label: 'Dollar Proxy (UUP)',
      signal: dollarProxy.error
        ? 'neutral'
        : (dollarProxy.delta ?? 0) > 0
          ? 'bearish'
          : (dollarProxy.delta ?? 0) < 0
            ? 'bullish'
            : 'neutral',
      detail: dollarProxy.error
        ? 'Dollar proxy data is unavailable right now.'
        : `UUP ${getMovementLabel(dollarProxy)} by ${formatPercent(dollarProxy.pct ?? 0)}${dollarProxy.latestDate ? ` on ${dollarProxy.latestDate}` : ''}. ${
            (dollarProxy.delta ?? 0) > 0
              ? 'A firmer dollar usually tightens the backdrop for global risk assets.'
              : (dollarProxy.delta ?? 0) < 0
                ? 'A softer dollar usually gives risk assets a cleaner macro backdrop.'
                : 'A flat dollar proxy keeps macro pressure neutral for now.'
          }`
    },
    {
      label: 'US 10Y Yield',
      signal: treasury10Y.error
        ? 'neutral'
        : (treasury10Y.delta ?? 0) > 0
          ? 'bearish'
          : (treasury10Y.delta ?? 0) < 0
            ? 'bullish'
            : 'neutral',
      detail: treasury10Y.error
        ? 'US 10Y yield data is unavailable right now.'
        : `The 10-year Treasury yield ${getMovementLabel(treasury10Y)} by ${formatPercent(treasury10Y.pct ?? 0)}${treasury10Y.latestDate ? ` on ${treasury10Y.latestDate}` : ''}. Higher yields usually raise pressure on duration-sensitive and high-beta assets.`
    }
  ]

  const watchItems: MarketWatchItem[] = [
    {
      label: 'Gold follow-through',
      detail:
        regimeScore <= -2
          ? 'If gold keeps firming while equities or BTC stay weak, the defensive regime remains credible.'
          : 'Watch whether gold stays calm or starts attracting a fresh defensive bid.',
      priority: getPriorityLabel(goldScore < 0 ? 0 : Math.abs(goldScore))
    },
    {
      label: 'Equity confirmation',
      detail:
        regimeScore >= 2
          ? 'The key test is whether the US equity proxy can keep extending without immediately fading.'
          : 'Watch whether the US equity proxy stabilizes or rolls over again.',
      priority: getPriorityLabel(Math.abs(sp500Score))
    },
    {
      label: 'BTC sensitivity',
      detail:
        regimeScore >= 2
          ? 'BTC should hold momentum if the tape is truly constructive. A fast fade would weaken the risk-on read.'
          : 'BTC remains the fastest stress signal in the set. A sharp break would deepen the cautious read.',
      priority: getPriorityLabel(Math.abs(btcScore))
    },
    {
      label: 'IHSG regional confirmation',
      detail: ihsg.error
        ? 'Direct Indonesia equity confirmation is still unavailable, so use the broader market brief with extra caution for local equities.'
        : regimeScore >= 2
          ? 'If IHSG also stays firm, the Indonesia read is getting cleaner confirmation rather than relying only on offshore proxies.'
          : 'Watch whether IHSG stabilizes or weakens further. That is the cleanest regional check for Indonesia-facing positioning.',
      priority: ihsg.error ? 'low' : getPriorityLabel(Math.abs((ihsg.delta ?? 0) > 0 ? 1 : ihsg.delta ?? 0 < 0 ? 2 : 0))
    },
    {
      label: 'Dollar and yield pressure',
      detail:
        dollarUp || yieldUp
          ? 'If the dollar proxy or the US 10Y keep pushing higher, macro pressure remains a headwind for the risk complex.'
          : dollarDown && yieldDown
            ? 'If the dollar proxy and the US 10Y stay soft together, risk assets get a cleaner backdrop for follow-through.'
            : dollarDown
              ? 'The dollar proxy is already easing. The next check is whether yields also soften enough to support risk assets.'
              : yieldDown
                ? 'Yields are easing. The next check is whether the dollar also softens enough to reduce macro pressure.'
                : 'Macro pressure is not yet giving a clean all-clear. Watch the next move in both the dollar proxy and the US 10Y.',
      priority: getPriorityLabel(Number(dollarUp || yieldUp) + Number(yieldUp))
    }
  ]

  const overnightContext = `Latest cross-asset checkpoint uses Gold ${gold.latestDate || '-'}, SPY proxy ${
    sp500.latestDate || '-'
  }, IHSG ${ihsg.latestDate || '-'}, BTC ${btc.latestDate || '-'}, UUP ${dollarProxy.latestDate || '-'}, and US10Y ${treasury10Y.latestDate || '-'}. Current desk read: ${riskTone}, regime ${regime}, ${conviction.toLowerCase()}.`

  const whatChanged = strongestMove
    ? `${strongestMove.instrument} ${getMovementLabel(strongestMove)} most clearly at the latest checkpoint, with a move of ${formatPercent(
        strongestMove.pct ?? 0
      )}${strongestMove.latestDate ? ` on ${strongestMove.latestDate}` : ''}.`
    : 'There is not enough live cross-asset data yet to identify the lead change.'

  const whyItMatters =
    regime === 'Broad risk-on expansion'
      ? 'Risk assets are aligned enough to support a constructive read, which matters because follow-through would improve the backdrop for growth-sensitive exposure.'
      : regime === 'Selective risk-on recovery'
        ? 'This looks better than a defensive tape, but not yet strong enough to treat as full confirmation. Users should still demand follow-through.'
        : regime === 'Defensive rotation'
          ? 'Defensive leadership matters because it usually tightens the tolerance for aggressive positioning, especially in high-beta assets.'
          : regime === 'Cautious defensive tilt'
            ? 'The tape is leaning defensive without becoming fully one-directional, so users should stay selective and avoid overcommitting to one narrative.'
            : 'Because signals are still mixed, the market does not yet offer one clean narrative. That raises the value of cross-asset confirmation.'

  const whatToWatchBase =
    regime === 'Broad risk-on expansion' || regime === 'Selective risk-on recovery'
      ? 'Watch whether BTC and the US equity proxy can keep momentum without a fresh defensive push in gold. That is the cleanest confirmation test.'
      : regime === 'Defensive rotation' || regime === 'Cautious defensive tilt'
        ? 'Watch whether gold stays firm while equities and BTC fail to regain traction. If that persists, the defensive read remains intact.'
        : 'Watch which asset breaks the tie first: gold as the defensive anchor, SPY as the equity proxy, or BTC as the high-beta signal.'

  const whatToWatch = ihsgAvailable
    ? `${whatToWatchBase} ${ihsgDirectionText} That gives a direct Indonesia equity check instead of relying only on global proxies.`
    : whatToWatchBase

  return {
    briefing: [
      { title: 'What Changed', body: whatChanged },
      { title: 'Why It Matters', body: whyItMatters },
      { title: 'What To Watch', body: whatToWatch }
    ],
    context: {
      riskTone,
      regime,
      conviction,
      stressState,
      macroContext,
      geopoliticContext,
      externalContext: externalHeadlineState.externalContext,
      externalWhyItMatters: externalHeadlineState.externalWhyItMatters,
      headlinePressure: externalHeadlineState.headlinePressure,
      watchLevel,
      overnightContext,
      drivers,
      macroSignals,
      stressDrivers,
      headlines: externalHeadlineState.headlines,
      watchItems,
      semanticSignals
    }
  }
}

const buildEngineSummary = (
  briefing: BriefSection[],
  context: MarketContext,
  instruments: {
    gold: InstrumentSummary
    sp500: InstrumentSummary
    ihsg: InstrumentSummary
    btc: InstrumentSummary
    dollarProxy: InstrumentSummary
    treasury10Y: InstrumentSummary
  }
) => {
  const availableInstruments = [
    instruments.gold,
    instruments.sp500,
    instruments.ihsg,
    instruments.btc,
    instruments.dollarProxy,
    instruments.treasury10Y
  ].filter((instrument) => !instrument.error)

  const latestDates = Array.from(
    new Set(availableInstruments.map((instrument) => instrument.latestDate).filter(Boolean))
  ) as string[]

  const dataFreshnessLine = latestDates.length
    ? `Latest checkpoint dates: ${latestDates.join(', ')}.`
    : 'Latest checkpoint dates are still incomplete.'

  const macroSignalSummary = context.macroSignals
    .map((item) => {
      if (item.label === 'Dollar Proxy (UUP)') {
        return instruments.dollarProxy.error
          ? 'Dollar pressure is not confirmed yet because UUP data is unavailable.'
          : `Dollar pressure is ${getDirectionText(instruments.dollarProxy.delta, 'firming', 'easing')}.`
      }

      if (item.label === 'US 10Y Yield') {
        return instruments.treasury10Y.error
          ? 'Rates pressure is not confirmed yet because US 10Y data is unavailable.'
          : `Rates pressure is ${getDirectionText(instruments.treasury10Y.delta, 'rising', 'easing')}.`
      }

      return ''
    })
    .filter(Boolean)
    .join(' ')

  const externalSummary =
    context.headlinePressure !== 'Unavailable'
      ? `${context.headlinePressure}. ${context.externalWhyItMatters}`
      : ''

  const regionalSummary = instruments.ihsg.error
    ? 'Indonesia equity confirmation is still unavailable, so the regional read leans more on the broader cross-asset brief.'
    : `Indonesia equities are ${getDirectionText(instruments.ihsg.delta, 'firming', 'softening')}, with IHSG ${formatPercent(instruments.ihsg.pct ?? 0)}${instruments.ihsg.latestDate ? ` on ${instruments.ihsg.latestDate}` : ''}.`

  return [
    `Market brief: ${context.riskTone}, ${context.regime.toLowerCase()}, ${context.conviction.toLowerCase()}.`,
    briefing.map((item) => `${item.title}: ${item.body}`).join(' '),
    `${context.macroContext} ${macroSignalSummary}`.trim(),
    regionalSummary,
    externalSummary,
    `Watch level: ${context.watchLevel}. ${context.watchItems[0]?.detail || ''}`.trim(),
    dataFreshnessLine
  ]
    .filter(Boolean)
    .join('\n\n')
}

export const getInvestmentSummary = async (): Promise<InvestmentSummaryResult> => {
  let gold: InstrumentSummary
  let antamLiveError: string | null = null

  try {
    gold = await getXauSpot()
  } catch (error) {
    antamLiveError = error instanceof Error ? error.message : 'XAUUSD live fetch failed'
    gold = await getLatestAndPrevious('XAUUSD')

    if (gold.error) {
      gold = {
        instrument: 'XAUUSD',
        error: antamLiveError
      }
    }
  }

  const sp500 = await getLatestAndPrevious('SP500')
  const ihsg = await getIndonesiaIndexSummary()
  let btc = await getLatestAndPrevious('BTC')
  if (btc.error) {
    const fallbackBtc = await getBitcoinSpotFallback()
    if (!fallbackBtc.error) {
      btc = fallbackBtc
    }
  }
  const [dollarProxy, treasury10Y, externalHeadlineState] = await Promise.all([
    getDollarProxyUup(),
    getTreasuryYield10Y(),
    getExternalContextLite()
  ])

  const semanticSignals = await getCollaborativeSemanticSignals({
    fallback: {
      breadthTone:
        (sp500.delta ?? 0) < 0 && (btc.delta ?? 0) < 0
          ? 'weakening'
          : (sp500.delta ?? 0) > 0 && (btc.delta ?? 0) > 0
            ? 'constructive'
            : 'limited',
      marketTone:
        (gold.delta ?? 0) >= 0 && ((sp500.delta ?? 0) < 0 || (btc.delta ?? 0) < 0)
          ? 'defensive'
          : (sp500.delta ?? 0) > 0 && (btc.delta ?? 0) >= 0
            ? 'constructive'
            : 'mixed',
      screenerTone:
        (sp500.delta ?? 0) < 0 && (btc.delta ?? 0) < 0
          ? 'weakening'
          : (sp500.delta ?? 0) > 0 || (btc.delta ?? 0) > 0
            ? 'selective_strength'
            : 'mixed',
      volatilityTrend:
        Math.abs(sp500.delta ?? 0) > 1.5 || Math.abs(btc.delta ?? 0) > 1.5 ? 'rising' : 'stable',
      macroPressure:
        (dollarProxy.delta ?? 0) > 0 || (treasury10Y.delta ?? 0) > 0
          ? 'tightening'
          : (dollarProxy.delta ?? 0) < 0 && (treasury10Y.delta ?? 0) < 0
            ? 'easing'
            : 'neutral',
      marketStress:
        (gold.delta ?? 0) >= 0 && ((sp500.delta ?? 0) < 0 || (btc.delta ?? 0) < 0)
          ? 'elevated'
          : 'normal'
    }
  })

  const { briefing, context } = buildBriefing(
    gold,
    sp500,
    ihsg,
    btc,
    dollarProxy,
    treasury10Y,
    semanticSignals,
    externalHeadlineState
  )
  const engineSummary = buildEngineSummary(briefing, context, {
    gold,
    sp500,
    ihsg,
    btc,
    dollarProxy,
    treasury10Y
  })

  return {
    summary: engineSummary,
    meta: {
      usedGroq: false,
      antamLiveError,
      instruments: {
        ANTAM: gold,
        SP500: sp500,
        IHSG: ihsg,
        BTC: btc
      },
      briefing,
      context
    }
  }
}
// Trust Pipeline - Reasoning Layer:
// This service consumes normalized semantic signals from adapters and folds them
// into Ting AI's market context. It must not depend on raw OpenBB payload shapes.
