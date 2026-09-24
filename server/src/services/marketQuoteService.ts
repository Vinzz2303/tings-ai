import axios from 'axios'

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        currency?: string
        regularMarketPrice?: number
        chartPreviousClose?: number
        previousClose?: number
        regularMarketTime?: number
        exchangeTimezoneName?: string
      }
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

export type MarketQuoteDataStatus = 'delayed' | 'cached' | 'unavailable'

export type ResolvedMarketQuote = {
  symbol: string
  displaySymbol: string
  name: string
  price: number | null
  currency: string
  changePercent: number | null
  source: 'yahoo' | 'none'
  dataStatus: MarketQuoteDataStatus
  lastUpdated: string | null
}

const IDX_NAMES: Record<string, string> = {
  'BBCA.JK': 'Bank Central Asia',
  'BMRI.JK': 'Bank Mandiri',
  'TLKM.JK': 'Telkom Indonesia',
  'UNVR.JK': 'Unilever Indonesia',
}

const FRONTEND_TO_YAHOO_MAP: Record<string, string> = {
  'IHSG': '^JKSE',
  'BTC': 'BTC-USD',
  'XAUUSD': 'GC=F',
  'SP500': '^GSPC',
  'USDIDR': 'USDIDR=X',
  'EURUSD': 'EURUSD=X',
  'GBPUSD': 'GBPUSD=X',
  'USDJPY': 'USDJPY=X'
}

const YAHOO_TO_FRONTEND_MAP: Record<string, string> = Object.entries(FRONTEND_TO_YAHOO_MAP).reduce((acc, [key, val]) => {
  acc[val] = key;
  return acc;
}, {} as Record<string, string>);

const quoteCache = new Map<string, { quote: ResolvedMarketQuote; cachedAt: number }>()

const normalizeMarketSymbol = (raw: string) => {
  const symbol = raw.trim().toUpperCase()
  if (!symbol) return ''
  
  // Use exact map if available
  if (FRONTEND_TO_YAHOO_MAP[symbol]) {
    return FRONTEND_TO_YAHOO_MAP[symbol]
  }

  if (symbol.endsWith('.JK')) return symbol
  if (/^[A-Z]{4}$/.test(symbol)) return `${symbol}.JK`
  return symbol
}

const getDisplaySymbol = (symbol: string) => {
  if (YAHOO_TO_FRONTEND_MAP[symbol]) return YAHOO_TO_FRONTEND_MAP[symbol]
  return symbol.replace(/\.JK$/i, '')
}

const getQuoteName = (symbol: string) => {
  if (YAHOO_TO_FRONTEND_MAP[symbol]) return YAHOO_TO_FRONTEND_MAP[symbol]
  return IDX_NAMES[symbol] || getDisplaySymbol(symbol)
}

const getCurrency = (symbol: string, providerCurrency?: string | null) => {
  if (/\.JK$/i.test(symbol)) return 'IDR'
  if (providerCurrency === 'IDR' || providerCurrency === 'USD') return providerCurrency
  return providerCurrency || 'USD'
}

const isIdxMarketHours = (now = new Date()) => {
  const jakarta = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }))
  const day = jakarta.getDay()
  if (day === 0 || day === 6) return false
  const minutes = jakarta.getHours() * 60 + jakarta.getMinutes()
  return minutes >= 9 * 60 && minutes <= 16 * 60 + 15
}

const getCacheTtlMs = () => (isIdxMarketHours() ? 5 : 15) * 60 * 1000

const unavailableQuote = (symbol: string, requestedSymbol?: string): ResolvedMarketQuote => ({
  symbol: requestedSymbol || symbol,
  displaySymbol: getDisplaySymbol(symbol),
  name: getQuoteName(symbol),
  price: null,
  currency: getCurrency(symbol),
  changePercent: null,
  source: 'none',
  dataStatus: 'unavailable',
  lastUpdated: null,
})

const findLatestClose = (timestamps: number[], closes: Array<number | null> = []) => {
  for (let index = closes.length - 1; index >= 0; index -= 1) {
    const close = closes[index]
    const timestamp = timestamps[index]
    if (close !== null && close !== undefined && Number.isFinite(close) && timestamp) {
      return { close: Number(close), timestamp }
    }
  }

  return null
}

const fetchYahooChart = async (symbol: string, interval: '1m' | '1d') => {
  const range = interval === '1m' ? '1d' : '5d'
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`
  const response = await axios.get<YahooChartResponse>(url, {
    timeout: 12000,
    headers: {
      'User-Agent': 'Mozilla/5.0 TingAI/2.2.9',
      Accept: 'application/json',
    },
  })
  const result = response.data?.chart?.result?.[0]
  const timestamps = result?.timestamp || []
  const closes = result?.indicators?.quote?.[0]?.close || []
  const latest = findLatestClose(timestamps, closes)
  const meta = result?.meta
  const metaPrice = Number(meta?.regularMarketPrice)
  const price = latest?.close || (Number.isFinite(metaPrice) && metaPrice > 0 ? metaPrice : null)

  if (!price || price <= 0) {
    throw new Error(response.data?.chart?.error?.description || `No Yahoo quote available for ${symbol}`)
  }

  const previousClose = Number(meta?.chartPreviousClose ?? meta?.previousClose ?? 0)
  const changePercent = previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : null
  const lastUpdated = new Date((latest?.timestamp || meta?.regularMarketTime || Date.now() / 1000) * 1000).toISOString()

  return {
    symbol: YAHOO_TO_FRONTEND_MAP[symbol] || symbol,
    displaySymbol: getDisplaySymbol(symbol),
    name: getQuoteName(symbol),
    price,
    currency: getCurrency(symbol, meta?.currency),
    changePercent,
    source: 'yahoo' as const,
    dataStatus: 'delayed' as const,
    lastUpdated,
  }
}

const fetchProviderQuote = async (symbol: string) => {
  try {
    return await fetchYahooChart(symbol, '1m')
  } catch {
    return fetchYahooChart(symbol, '1d')
  }
}

export const resolveMarketQuote = async (rawSymbol: string): Promise<ResolvedMarketQuote> => {
  const symbol = normalizeMarketSymbol(rawSymbol)
  if (!symbol) return unavailableQuote('', rawSymbol)

  const cached = quoteCache.get(symbol)
  const ttlMs = getCacheTtlMs()
  if (cached && Date.now() - cached.cachedAt < ttlMs) {
    return { ...cached.quote, dataStatus: 'cached' }
  }

  try {
    const quote = await fetchProviderQuote(symbol)
    quoteCache.set(symbol, { quote, cachedAt: Date.now() })
    return quote
  } catch {
    if (cached) {
      return { ...cached.quote, dataStatus: 'cached' }
    }
    return unavailableQuote(symbol, rawSymbol)
  }
}

export const resolveMarketQuotes = async (symbols: string[]) =>
  Promise.all(symbols.map((symbol) => resolveMarketQuote(symbol)))

export const getMarketQuoteCacheTtlMinutes = () => (isIdxMarketHours() ? 5 : 15)
