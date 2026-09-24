import axios from 'axios'

export interface ScreenerResult {
  symbol: string
  name: string
  price: number
  change: number
  marketCap: number
  peRatio: number | null
  dividendYield: number | null
}

// Dummy/mock implementation for MVP. In reality, it would call Yahoo Finance or OpenBB for screener criteria.
export async function runStockScreener(criteria: { minMarketCap?: number, sector?: string }): Promise<ScreenerResult[]> {
  // Hardcoded premium screener response
  return [
    { symbol: 'BBCA.JK', name: 'Bank Central Asia', price: 10000, change: 1.5, marketCap: 1200000000000, peRatio: 22, dividendYield: 2.1 },
    { symbol: 'BMRI.JK', name: 'Bank Mandiri', price: 6500, change: 0.8, marketCap: 600000000000, peRatio: 11, dividendYield: 4.5 },
    { symbol: 'ASII.JK', name: 'Astra International', price: 5000, change: -0.5, marketCap: 200000000000, peRatio: 6.5, dividendYield: 8.5 },
    { symbol: 'TLKM.JK', name: 'Telkom Indonesia', price: 3000, change: 1.2, marketCap: 300000000000, peRatio: 14, dividendYield: 5.2 },
    { symbol: 'NVDA', name: 'NVIDIA Corp', price: 120, change: 3.5, marketCap: 3000000000000, peRatio: 70, dividendYield: 0.1 },
    { symbol: 'AAPL', name: 'Apple Inc', price: 210, change: 0.5, marketCap: 3200000000000, peRatio: 30, dividendYield: 0.5 }
  ]
}
