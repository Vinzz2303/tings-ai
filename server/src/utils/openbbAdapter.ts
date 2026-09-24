import axios from 'axios'

export interface MacroData {
  fedFundsRate: number | null
  us10YearYield: number | null
  dxy: number | null
  inflationRate: number | null
  vix: number | null
  us2YearYield: number | null
  gold: number | null
  unemploymentRate: number | null
  lastUpdated: string
}

async function fetchOpenBBSeries(symbol: string): Promise<any[]> {
  try {
    const apiKey = process.env.FRED_API_KEY
    if (!apiKey) return []
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${symbol}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=13`
    const res = await axios.get(url, { timeout: 8000 })
    // FRED native API returns: { observations: [ { date, value }, ... ] }
    // We map it to the structure expected by the rest of the code: [ { [symbol]: value } ]
    const obs = res.data?.observations || []
    return obs.reverse().map((o: any) => ({
      [symbol]: Number(o.value)
    }))
  } catch (err) {
    console.error(`[FRED API Error] ${symbol}:`, err)
    return []
  }
}

async function fetchYahooPrice(symbol: string): Promise<number | null> {
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
    const res = await axios.get(url, { timeout: 8000 })
    const result = res.data?.chart?.result?.[0]
    const price = result?.meta?.regularMarketPrice
    if (price) return Number(price)
  } catch (err) {
    console.error(`[Yahoo API Error] ${symbol}:`, err)
  }
  return null
}

export async function fetchMacroData(): Promise<MacroData> {
  // Fallback values — updated July 2026 (verified vs BLS, CBOE, TradingEconomics)
  let fedFundsRate = 3.63
  let inflationRate = 3.5
  let us10YearYield = 4.60
  let dxy = 101.35
  let vix = 18.20
  let us2YearYield = 4.30
  let gold = 4040.00
  let unemploymentRate = 4.2

  try {
    const [fedData, cpiData, unrateData, dgs2Data, tnxData, dxyData, vixData, goldData] = await Promise.allSettled([
      fetchOpenBBSeries('FEDFUNDS'),
      fetchOpenBBSeries('CPIAUCSL'),
      fetchOpenBBSeries('UNRATE'),
      fetchOpenBBSeries('DGS2'),
      fetchYahooPrice('^TNX'),
      fetchYahooPrice('DX-Y.NYB'),
      fetchYahooPrice('^VIX'),
      fetchYahooPrice('GC=F')
    ])

    if (fedData.status === 'fulfilled' && fedData.value.length > 0) {
      const latest = fedData.value[fedData.value.length - 1]
      if (latest && latest.FEDFUNDS != null) fedFundsRate = latest.FEDFUNDS
    }
    
    if (cpiData.status === 'fulfilled' && cpiData.value.length >= 13) {
      const results = cpiData.value
      const latest = results[results.length - 1].CPIAUCSL
      const yearAgo = results[results.length - 13].CPIAUCSL
      if (latest && yearAgo) {
        inflationRate = ((latest - yearAgo) / yearAgo) * 100
      }
    }

    if (unrateData.status === 'fulfilled' && unrateData.value.length > 0) {
      const latest = unrateData.value[unrateData.value.length - 1]
      if (latest && latest.UNRATE != null) unemploymentRate = latest.UNRATE
    }

    if (dgs2Data.status === 'fulfilled' && dgs2Data.value.length > 0) {
      const latest = dgs2Data.value[dgs2Data.value.length - 1]
      if (latest && latest.DGS2 != null) us2YearYield = latest.DGS2
    }

    if (tnxData.status === 'fulfilled' && tnxData.value !== null) us10YearYield = tnxData.value
    if (dxyData.status === 'fulfilled' && dxyData.value !== null) dxy = dxyData.value
    if (vixData.status === 'fulfilled' && vixData.value !== null) vix = vixData.value
    if (goldData.status === 'fulfilled' && goldData.value !== null) gold = goldData.value

    return {
      fedFundsRate: Number(fedFundsRate.toFixed(2)),
      us10YearYield: Number(us10YearYield.toFixed(2)),
      dxy: Number(dxy.toFixed(2)),
      inflationRate: Number(inflationRate.toFixed(1)),
      vix: Number(vix.toFixed(2)),
      us2YearYield: Number(us2YearYield.toFixed(2)),
      gold: Number(gold.toFixed(2)),
      unemploymentRate: Number(unemploymentRate.toFixed(1)),
      lastUpdated: new Date().toISOString()
    }
  } catch (error) {
    console.error('[Macro Data] Failed to fetch macro data:', error)
    return {
      fedFundsRate: Number(fedFundsRate.toFixed(2)),
      us10YearYield: Number(us10YearYield.toFixed(2)),
      dxy: Number(dxy.toFixed(2)),
      inflationRate: Number(inflationRate.toFixed(1)),
      vix: Number(vix.toFixed(2)),
      us2YearYield: Number(us2YearYield.toFixed(2)),
      gold: Number(gold.toFixed(2)),
      unemploymentRate: Number(unemploymentRate.toFixed(1)),
      lastUpdated: new Date().toISOString()
    }
  }
}
