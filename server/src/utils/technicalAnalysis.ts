/**
 * technicalAnalysis.ts
 * Utility for calculating Technical Analysis indicators.
 */

/**
 * Calculates the Relative Strength Index (RSI) for a given array of closing prices.
 * Returns an array of RSI values corresponding to the input prices.
 * The first `period` elements will be null.
 */
export function calculateRSI(closes: number[], period: number = 14): (number | null)[] {
  if (closes.length < period + 1) {
    return new Array(closes.length).fill(null)
  }

  let gains = 0
  let losses = 0
  const rsi: (number | null)[] = new Array(closes.length).fill(null)

  // Initial calculation
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff >= 0) {
      gains += diff
    } else {
      losses -= diff
    }
  }

  let avgGain = gains / period
  let avgLoss = losses / period
  
  if (avgLoss === 0) {
    rsi[period] = 100
  } else {
    let rs = avgGain / avgLoss
    rsi[period] = 100 - (100 / (1 + rs))
  }

  // Smoothed Moving Average calculation for the rest
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    const gain = diff >= 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0

    avgGain = ((avgGain * (period - 1)) + gain) / period
    avgLoss = ((avgLoss * (period - 1)) + loss) / period

    if (avgLoss === 0) {
      rsi[i] = 100
    } else {
      const rs = avgGain / avgLoss
      rsi[i] = 100 - (100 / (1 + rs))
    }
  }

  return rsi
}

/**
 * Calculates the Simple Moving Average (SMA).
 */
export function calculateSMA(closes: number[], period: number = 20): (number | null)[] {
  if (closes.length < period) {
    return new Array(closes.length).fill(null)
  }

  const sma: (number | null)[] = new Array(closes.length).fill(null)
  let sum = 0

  for (let i = 0; i < period; i++) {
    sum += closes[i]
  }

  sma[period - 1] = sum / period

  for (let i = period; i < closes.length; i++) {
    sum += closes[i] - closes[i - period]
    sma[i] = sum / period
  }

  return sma
}
