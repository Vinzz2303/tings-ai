import axios from 'axios'

export interface SectorsQuote {
  symbol: string
  company_name: string
  price: number
  close: number
  volume: number
  market_cap: number
  pe_ratio?: number
  pb_ratio?: number
}

// Ensure SECTORS_API_KEY is in server/.env
const SECTORS_API_KEY = process.env.SECTORS_API_KEY || ''
const BASE_URL = 'https://api.sectors.app/v1'

export async function fetchSectorsQuote(symbol: string): Promise<SectorsQuote | null> {
  if (!SECTORS_API_KEY) {
    console.warn('[Sectors Adapter] SECTORS_API_KEY is missing. Skipping Sectors.app fetch.')
    return null
  }

  // Sectors API uses clean symbol (e.g. BBCA, not BBCA.JK)
  const cleanSymbol = symbol.replace('.JK', '').toUpperCase()

  try {
    const response = await axios.get(`${BASE_URL}/company/report/${cleanSymbol}/?sections=overview,valuation`, {
      headers: {
        'Authorization': SECTORS_API_KEY
      },
      timeout: 5000
    })

    if (response.data) {
      const data = response.data
      return {
        symbol: cleanSymbol,
        company_name: data.overview?.company_name || cleanSymbol,
        price: data.overview?.latest_price || data.overview?.close || 0,
        close: data.overview?.close || 0,
        volume: data.overview?.volume || 0,
        market_cap: data.valuation?.market_cap || 0,
        pe_ratio: data.valuation?.pe_ratio,
        pb_ratio: data.valuation?.pb_ratio
      }
    }
    return null
  } catch (error) {
    console.error(`[Sectors Adapter] Failed to fetch ${cleanSymbol}:`, (error as any).message)
    return null
  }
}
