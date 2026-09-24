import axios from 'axios'

type FxAdapterMeta = {
  source: 'live' | 'cache' | 'last_known' | 'unavailable'
  ts: number
  note?: string | null
}

type FxRateResult = {
  rate: number | null
  meta: FxAdapterMeta
}

const cache = new Map<string, { rate: number; ts: number }>()
const lastKnown = new Map<string, { rate: number; ts: number }>()

const getCacheTtlMs = () => {
  const raw = Number(process.env.FX_CACHE_TTL_MS || 5 * 60 * 1000)
  return Number.isFinite(raw) && raw > 0 ? raw : 5 * 60 * 1000
}

const getTimeoutMs = () => {
  const raw = Number(process.env.FX_TIMEOUT_MS || 2500)
  return Number.isFinite(raw) && raw > 0 ? raw : 2500
}

const getFallbackRate = (from: string, to: string) => {
  if (from === to) return 1
  if (from === 'USD' && to === 'IDR') return 16500
  if (from === 'IDR' && to === 'USD') return 1 / 16500
  return null
}

const keyFor = (from: string, to: string) => `${from}_${to}`

export async function getFxRate(fromCurrency: string, toCurrency: string): Promise<FxRateResult> {
  const from = fromCurrency.toUpperCase()
  const to = toCurrency.toUpperCase()

  if (from === to) {
    return {
      rate: 1,
      meta: { source: 'cache', ts: Date.now(), note: 'Aligned currency pair' }
    }
  }

  const key = keyFor(from, to)
  const now = Date.now()
  const cached = cache.get(key)
  if (cached && now - cached.ts < getCacheTtlMs()) {
    return { rate: cached.rate, meta: { source: 'cache', ts: cached.ts } }
  }

  // Primary: frankfurter.app (free, no key, reliable)
  // Fallback: env-configured URL (e.g. exchangerate-api)
  const primaryUrl = 'https://api.frankfurter.app/latest'
  const fallbackUrl = process.env.FX_API_URL || ''
  const apiKey = process.env.FX_API_KEY
  const timeout = getTimeoutMs()

  // Try primary Frankfurt API first
  const tryFetch = async (apiUrl: string, useKey: boolean): Promise<number | null> => {
    const params: Record<string, string> = { base: from, symbols: to }
    if (useKey && apiKey) params.access_key = apiKey
    const response = await axios.get(apiUrl, { timeout, params })
    const rate = Number(response.data?.rates?.[to] || 0)
    return rate > 0 ? rate : null
  }

  try {
    let rate: number | null = null

    // 1. Try primary (frankfurter.app)
    try {
      rate = await tryFetch(primaryUrl, false)
    } catch {
      // 2. Try fallback URL if configured
      if (fallbackUrl) {
        rate = await tryFetch(fallbackUrl, true)
      }
    }

    if (rate !== null) {
      cache.set(key, { rate, ts: now })
      lastKnown.set(key, { rate, ts: now })
      return { rate, meta: { source: 'live', ts: now } }
    }

    throw new Error('Invalid FX payload — rate not found')
  } catch (error) {
    const known = lastKnown.get(key)
    if (known) {
      return {
        rate: known.rate,
        meta: { source: 'last_known', ts: known.ts, note: error instanceof Error ? error.message : 'FX fallback' }
      }
    }

    const fallback = getFallbackRate(from, to)
    if (fallback !== null) {
      lastKnown.set(key, { rate: fallback, ts: now })
      return {
        rate: fallback,
        meta: { source: 'last_known', ts: now, note: 'Static fallback rate used' }
      }
    }

    return {
      rate: null,
      meta: { source: 'unavailable', ts: now, note: error instanceof Error ? error.message : 'FX unavailable' }
    }
  }
}
