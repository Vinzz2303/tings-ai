import axios from 'axios'

export type MarketNewsTopic =
  | 'ihsg'
  | 'banking'
  | 'gold'
  | 'crypto'
  | 'us_market'
  | 'macro'
  | 'general'

export type MarketNewsDataStatus = 'live' | 'delayed' | 'cached' | 'unavailable'

export type MarketNewsItem = {
  title: string
  source: string
  url: string
  publishedAt: string
  relatedSymbols: string[]
  topic: MarketNewsTopic
  relevanceReason: string
  dataStatus: Exclude<MarketNewsDataStatus, 'unavailable'>
}

export type MarketNewsResponse = {
  items: MarketNewsItem[]
  dataStatus: MarketNewsDataStatus
  lastUpdated: string | null
  message: string | null
}

type AlphaVantageNewsItem = {
  title?: string
  url?: string
  time_published?: string
  authors?: string[]
  summary?: string
  source?: string
  ticker_sentiment?: Array<{ ticker?: string }>
}

type AlphaVantageNewsResponse = {
  feed?: AlphaVantageNewsItem[]
  Information?: string
  Note?: string
}

type MarketauxNewsItem = {
  title?: string
  description?: string
  url?: string
  source?: string
  published_at?: string
  entities?: Array<{ symbol?: string }>
}

type MarketauxNewsResponse = {
  data?: MarketauxNewsItem[]
}

type RssNewsItem = {
  title: string
  url: string
  publishedAt: string
  source: string
}

const PROVIDER_TIMEOUT_MS = Number(process.env.NEWS_PROVIDER_TIMEOUT_MS || process.env.PROVIDER_TIMEOUT_MS || 3500)
const CACHE_TTL_MS = Number(process.env.NEWS_CACHE_TTL_MS || 15 * 60 * 1000)

const cache = new Map<string, { response: MarketNewsResponse; storedAt: number }>()

const normalizeSymbol = (symbol: string) => symbol.trim().toUpperCase()

const normalizeSymbols = (symbols: string[]) =>
  [...new Set(symbols.map(normalizeSymbol).filter(Boolean))].slice(0, 20)

const INDONESIA_STOCK_SYMBOLS = new Set([
  'BBCA',
  'BMRI',
  'BBRI',
  'BBNI',
  'TLKM',
  'ASII',
  'UNTR',
  'INDF',
  'ICBP',
  'AMMN',
  'BRPT',
  'ADRO',
  'PTBA',
  'ITMG',
])

const expandIndonesiaSymbols = (symbols: string[]) => {
  const normalized = normalizeSymbols(symbols)
  const expanded = new Set<string>(normalized)
  normalized.forEach((symbol) => {
    const bare = symbol.replace(/\.JK$/i, '')
    if (INDONESIA_STOCK_SYMBOLS.has(bare)) {
      expanded.add(bare)
      expanded.add(`${bare}.JK`)
    }
  })
  return [...expanded].slice(0, 24)
}

const hasAny = (text: string, words: string[]) => words.some((word) => text.includes(word))

const inferTopic = (title: string, summary: string, symbols: string[]): MarketNewsTopic => {
  const text = `${title} ${summary} ${symbols.join(' ')}`.toLowerCase()
  if (hasAny(text, ['bbca', 'bmri', 'bbri', 'bni', 'banking', 'bank ', 'banks ', 'bank indonesia', 'bi rate'])) return 'banking'
  if (hasAny(text, ['ihsg', 'idx ', 'jakarta composite', 'indonesia stock', '.jk'])) return 'ihsg'
  if (hasAny(text, ['gold', 'xau', 'gld', 'treasury yield', 'safe haven'])) return 'gold'
  if (hasAny(text, ['bitcoin', 'btc', 'crypto', 'ethereum', 'etf'])) return 'crypto'
  if (hasAny(text, ['nasdaq', 's&p', 'sp500', 's&p 500', 'spy', 'qqq', 'wall street'])) return 'us_market'
  if (hasAny(text, ['fed', 'inflation', 'rates', 'rate cut', 'rate hike', 'dollar', 'usd', 'macro'])) return 'macro'
  return 'general'
}

const portfolioThemes = (symbols: string[]) => {
  const normalized = expandIndonesiaSymbols(symbols)
  return {
    hasPortfolio: normalized.length > 0,
    hasIdx: normalized.some((symbol) => symbol.endsWith('.JK') || ['^JKSE', 'IHSG'].includes(symbol)),
    hasBanking: normalized.some((symbol) => ['BBCA.JK', 'BMRI.JK', 'BBRI.JK', 'BBNI.JK', 'BBCA', 'BMRI', 'BBRI', 'BBNI'].includes(symbol)),
    hasGold: normalized.some((symbol) => ['XAUUSD', 'XAU/USD', 'GC=F', 'GLD', 'GOLD'].includes(symbol)),
    hasCrypto: normalized.some((symbol) => /BTC|ETH|SOL|BNB|XRP|CRYPTO/.test(symbol)),
    hasUsMarket: normalized.some((symbol) => ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL'].includes(symbol) || /^[A-Z]{1,5}$/.test(symbol)),
  }
}

const getRelevanceReason = (
  topic: MarketNewsTopic,
  relatedSymbols: string[],
  requestedSymbols: string[],
  deeperReason: boolean
) => {
  const themes = portfolioThemes(requestedSymbols)
  const symbols = relatedSymbols.length ? relatedSymbols.join('/') : requestedSymbols.slice(0, 3).join('/')
  const suffix = deeperReason
    ? ' Ini bisa memengaruhi watchlist dan risk budget jika sentimen melebar ke posisi dengan bobot besar.'
    : ''

  if (topic === 'banking' && themes.hasBanking) {
    return `Relevan karena kamu memiliki eksposur ke ${symbols || 'BBCA/BMRI'} dan sektor perbankan.${suffix}`
  }
  if ((topic === 'ihsg' || topic === 'banking') && themes.hasIdx) {
    return `Relevan karena portofolio kamu punya eksposur saham Indonesia atau IDX.${suffix}`
  }
  if (topic === 'gold' && themes.hasGold) {
    return `Relevan karena kamu memiliki eksposur ke emas/XAU yang sensitif terhadap USD, yield AS, inflasi, dan safe haven.${suffix}`
  }
  if (topic === 'crypto' && themes.hasCrypto) {
    return `Relevan karena kamu memiliki eksposur kripto, terutama terhadap BTC dan sentimen risiko global.${suffix}`
  }
  if (topic === 'us_market' && themes.hasUsMarket) {
    return `Relevan karena eksposur saham AS biasanya sensitif terhadap Nasdaq, S&P 500, earnings, dan risk appetite.${suffix}`
  }
  if (topic === 'macro') {
    return `Relevan sebagai konteks makro untuk membaca suku bunga, USD, inflasi, dan risk appetite portofolio.${suffix}`
  }
  if (!themes.hasPortfolio) {
    return 'Berita market umum untuk membaca kondisi pasar sebelum portofolio ditambahkan.'
  }
  return `Relevan sebagai konteks pasar umum untuk aset ${requestedSymbols.slice(0, 3).join('/') || 'di portofolio kamu'}.${suffix}`
}

const scoreItem = (item: MarketNewsItem, requestedSymbols: string[]) => {
  const themes = portfolioThemes(requestedSymbols)
  const expandedSymbols = expandIndonesiaSymbols(requestedSymbols)
  let score = 1
  if (item.relatedSymbols.some((symbol) => expandedSymbols.includes(symbol))) score += 4
  if (themes.hasBanking && item.topic === 'banking') score += 4
  if (themes.hasIdx && (item.topic === 'ihsg' || item.topic === 'banking' || item.topic === 'macro')) score += 3
  if (themes.hasGold && item.topic === 'gold') score += 4
  if (themes.hasCrypto && item.topic === 'crypto') score += 4
  if (themes.hasUsMarket && item.topic === 'us_market') score += 3
  if (item.topic === 'macro') score += 1
  return score
}

const stripCdata = (value: string) => value.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '')

const decodeXml = (value: string) =>
  stripCdata(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()

const tagValue = (xml: string, tag: string) => {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match ? decodeXml(match[1]) : ''
}

const parseGoogleNewsRss = (xml: string): RssNewsItem[] => {
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/gi) || []
  return itemMatches
    .map((itemXml) => {
      const title = tagValue(itemXml, 'title')
      const url = tagValue(itemXml, 'link')
      const publishedAt = tagValue(itemXml, 'pubDate')
      const source = tagValue(itemXml, 'source') || title.split(' - ').pop() || 'Google News'
      const cleanTitle = title.includes(' - ') ? title.split(' - ').slice(0, -1).join(' - ') : title
      return {
        title: cleanTitle,
        url,
        publishedAt,
        source,
      }
    })
    .filter((item) => item.title && item.url)
}

const buildGoogleNewsQueries = (requestedSymbols: string[]) => {
  const themes = portfolioThemes(requestedSymbols)
  const expanded = expandIndonesiaSymbols(requestedSymbols)
  const bareSymbols = expanded.map((symbol) => symbol.replace(/\.JK$/i, ''))
  const queries: string[] = []

  if (themes.hasBanking) queries.push(`${bareSymbols.filter((symbol) => ['BBCA', 'BMRI', 'BBRI', 'BBNI'].includes(symbol)).join(' OR ') || 'BBCA OR BMRI'} saham bank IHSG`)
  if (themes.hasIdx) queries.push(`${bareSymbols.filter((symbol) => INDONESIA_STOCK_SYMBOLS.has(symbol)).join(' OR ') || 'IHSG'} Bursa Efek Indonesia`)
  if (themes.hasGold) queries.push('harga emas XAU USD yield inflasi')
  if (themes.hasCrypto) queries.push('Bitcoin BTC ETF regulation crypto market')
  if (themes.hasUsMarket) queries.push('Nasdaq S&P 500 earnings market')
  if (!queries.length) queries.push('IHSG saham Indonesia market')

  return [...new Set(queries)].slice(0, 3)
}

const toIsoDate = (raw?: string) => {
  if (!raw) return new Date().toISOString()
  if (/^\d{8}T\d{6}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(9, 11)}:${raw.slice(11, 13)}:${raw.slice(13, 15)}Z`
  }
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

const mapAlphaVantageItem = (item: AlphaVantageNewsItem, requestedSymbols: string[], deeperReason: boolean): MarketNewsItem | null => {
  if (!item.title || !item.url || !item.source) return null
  const relatedSymbols = normalizeSymbols((item.ticker_sentiment || []).map((ticker) => ticker.ticker || ''))
  const topic = inferTopic(item.title, item.summary || '', relatedSymbols)
  return {
    title: item.title,
    source: item.source,
    url: item.url,
    publishedAt: toIsoDate(item.time_published),
    relatedSymbols,
    topic,
    relevanceReason: getRelevanceReason(topic, relatedSymbols, requestedSymbols, deeperReason),
    dataStatus: 'delayed',
  }
}

const mapMarketauxItem = (item: MarketauxNewsItem, requestedSymbols: string[], deeperReason: boolean): MarketNewsItem | null => {
  if (!item.title || !item.url || !item.source) return null
  const relatedSymbols = normalizeSymbols((item.entities || []).map((entity) => entity.symbol || ''))
  const topic = inferTopic(item.title, item.description || '', relatedSymbols)
  return {
    title: item.title,
    source: item.source,
    url: item.url,
    publishedAt: toIsoDate(item.published_at),
    relatedSymbols,
    topic,
    relevanceReason: getRelevanceReason(topic, relatedSymbols, requestedSymbols, deeperReason),
    dataStatus: 'delayed',
  }
}

const mapRssItem = (item: RssNewsItem, requestedSymbols: string[], deeperReason: boolean): MarketNewsItem | null => {
  const relatedSymbols = expandIndonesiaSymbols(requestedSymbols).filter((symbol) => {
    const bare = symbol.replace(/\.JK$/i, '')
    return item.title.toUpperCase().includes(bare) || item.title.toUpperCase().includes(symbol)
  })
  const topic = inferTopic(item.title, '', relatedSymbols)
  return {
    title: item.title,
    source: item.source,
    url: item.url,
    publishedAt: toIsoDate(item.publishedAt),
    relatedSymbols: relatedSymbols.length ? relatedSymbols : expandIndonesiaSymbols(requestedSymbols).slice(0, 4),
    topic,
    relevanceReason: getRelevanceReason(topic, relatedSymbols, requestedSymbols, deeperReason),
    dataStatus: 'delayed',
  }
}

const selectItems = (items: MarketNewsItem[], requestedSymbols: string[], limit: number) => {
  const seen = new Set<string>()
  return items
    .filter((item) => {
      const key = `${item.title}|${item.url}`.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => {
      const scoreDiff = scoreItem(b, requestedSymbols) - scoreItem(a, requestedSymbols)
      if (scoreDiff !== 0) return scoreDiff
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    })
    .slice(0, limit)
}

const fetchFromOpenBB = async (requestedSymbols: string[], limit: number, deeperReason: boolean): Promise<MarketNewsItem[]> => {
  const symbols = normalizeSymbols(requestedSymbols)
    .filter(s => s !== '^JKSE' && s !== 'IHSG' && !s.endsWith('.JK'))
    .slice(0, 5)

  if (symbols.length === 0) return []

  try {
    const symbolParam = symbols.join(',')
    const url = `http://127.0.0.1:6900/api/v1/news/company?symbol=${encodeURIComponent(symbolParam)}&limit=${limit * 2}&provider=yfinance`
    const response = await axios.get(url, { timeout: PROVIDER_TIMEOUT_MS })
    const results = response.data?.results || []

    const mapped = results.map((item: any) => {
      const topic = inferTopic(item.title || '', item.summary || item.text || '', [item.symbol || ''])
      return {
        title: item.title,
        source: item.source || 'OpenBB Terminal',
        url: item.url,
        publishedAt: toIsoDate(item.date),
        relatedSymbols: [item.symbol || symbols[0]],
        topic,
        relevanceReason: getRelevanceReason(topic, [item.symbol || symbols[0]], requestedSymbols, deeperReason),
        dataStatus: 'live',
      }
    })

    return selectItems(mapped, requestedSymbols, limit)
  } catch (err) {
    console.error('[OpenBB News Error]', err)
    return []
  }
}

const fetchFromGoogleNews = async (requestedSymbols: string[], limit: number, deeperReason: boolean): Promise<MarketNewsItem[]> => {
  try {
    const queries = buildGoogleNewsQueries(requestedSymbols)
    const promises = queries.map(async (q) => {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:7d')}&hl=id&gl=ID&ceid=ID:id`
      const res = await axios.get(url, { timeout: PROVIDER_TIMEOUT_MS })
      const items = parseGoogleNewsRss(res.data)
      return items.map((item) => mapRssItem(item, requestedSymbols, deeperReason)).filter((item): item is MarketNewsItem => item !== null)
    })
    const results = await Promise.allSettled(promises)
    const allItems = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    return selectItems(allItems, requestedSymbols, limit)
  } catch (err) {
    console.error('[Google News Error]', err)
    return []
  }
}

const cachedResponse = (cacheKey: string, message: string): MarketNewsResponse | null => {
  const cached = cache.get(cacheKey)
  if (!cached) return null
  const isFreshEnough = Date.now() - cached.storedAt <= CACHE_TTL_MS
  if (!isFreshEnough) return null
  return {
    ...cached.response,
    items: cached.response.items.map((item) => ({ ...item, dataStatus: 'cached' })),
    dataStatus: 'cached',
    message,
  }
}

export const getMarketNews = async (input: {
  symbols: string[]
  country?: string
  limit?: number
  pro?: boolean
}): Promise<MarketNewsResponse> => {
  const requestedSymbols = normalizeSymbols(input.symbols)
  const limit = Math.max(1, Math.min(Number(input.limit || 6), 12))
  const deeperReason = input.pro === true
  const cacheKey = requestedSymbols.join(',')

  try {
    let items = await fetchFromOpenBB(requestedSymbols, limit, deeperReason)
    
    // Fallback to Google News RSS if OpenBB doesn't have news (e.g. for IHSG/.JK stocks)
    if (items.length === 0) {
      items = await fetchFromGoogleNews(requestedSymbols, limit, deeperReason)
    }
    
    if (items.length > 0) {
      const response: MarketNewsResponse = {
        items,
        dataStatus: 'live',
        lastUpdated: new Date().toISOString(),
        message: null,
      }
      cache.set(cacheKey, { response, storedAt: Date.now() })
      return response
    }

    return cachedResponse(cacheKey, 'Menggunakan data terakhir (cache) dari OpenBB Terminal.') || {
      items: [],
      dataStatus: 'unavailable',
      lastUpdated: null,
      message: 'Tidak ada berita terbaru saat ini.',
    }
  } catch (error) {
    return cachedResponse(cacheKey, 'Koneksi terputus. Menampilkan cache terakhir.') || {
      items: [],
      dataStatus: 'unavailable',
      lastUpdated: null,
      message: 'Layanan berita sedang tidak bisa diakses.',
    }
  }
}
