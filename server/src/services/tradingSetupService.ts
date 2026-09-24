import axios from 'axios';

// Interfaces for Trading Insights
export interface TradingSetup {
  symbol: string;
  momentum: {
    rsi: number;
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    condition: 'OVERSOLD' | 'OVERBOUGHT' | 'NORMAL';
  };
  levels: {
    pivot: number;
    support1: number;
    support2: number;
    resistance1: number;
    resistance2: number;
  };
  recommendation: {
    action: 'BUY' | 'SELL' | 'WAIT';
    entryArea: string;
    stopLoss: number;
    takeProfit: number;
    aiNarrative: string;
  };
  lastPrice: number;
}

const FRONTEND_TO_YAHOO_MAP: Record<string, string> = {
  'IHSG': '^JKSE',
  'BTC': 'BTC-USD',
  'XAUUSD': 'GC=F',
  'SP500': '^GSPC',
  'USDIDR': 'USDIDR=X',
  'EURUSD': 'EURUSD=X',
};

const normalizeSymbol = (raw: string) => {
  const s = raw.trim().toUpperCase();
  if (FRONTEND_TO_YAHOO_MAP[s]) return FRONTEND_TO_YAHOO_MAP[s];
  if (s.endsWith('.JK')) return s;
  if (/^[A-Z]{4}$/.test(s)) return `${s}.JK`;
  return s;
};

// Calculate RSI
const calculateRSI = (prices: number[], periods = 14) => {
  if (prices.length < periods + 1) return 50;
  let gains = 0, losses = 0;
  
  for (let i = 1; i <= periods; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  
  let avgGain = gains / periods;
  let avgLoss = losses / periods;
  
  for (let i = periods + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * 13 + gain) / 14;
    avgLoss = (avgLoss * 13 + loss) / 14;
  }
  
  const rs = avgGain / (avgLoss === 0 ? 1 : avgLoss);
  return 100 - (100 / (1 + rs));
};

export const generateTradingSetup = async (rawSymbol: string): Promise<TradingSetup> => {
  const symbol = normalizeSymbol(rawSymbol);
  
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=30d&interval=1d`;
    const response = await axios.get(url, { timeout: 10000 });
    const result = response.data?.chart?.result?.[0];
    
    const indicators = result?.indicators?.quote?.[0] || {};
    const closes: number[] = (indicators.close || []).filter((c: any) => c !== null);
    const highs: number[] = (indicators.high || []).filter((h: any) => h !== null);
    const lows: number[] = (indicators.low || []).filter((l: any) => l !== null);
    
    if (closes.length < 15) throw new Error("Not enough data");

    const lastPrice = closes[closes.length - 1];
    const prevHigh = highs[highs.length - 2] || highs[highs.length - 1];
    const prevLow = lows[lows.length - 2] || lows[lows.length - 1];
    const prevClose = closes[closes.length - 2] || closes[closes.length - 1];

    // Momentum RSI
    const rsi = calculateRSI(closes);
    let condition: 'OVERSOLD' | 'OVERBOUGHT' | 'NORMAL' = 'NORMAL';
    if (rsi < 30) condition = 'OVERSOLD';
    else if (rsi > 70) condition = 'OVERBOUGHT';

    let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, closes.length);
    if (lastPrice > sma20) trend = 'BULLISH';
    else if (lastPrice < sma20) trend = 'BEARISH';

    // Support and Resistance (Standard Pivot Points)
    const pivot = (prevHigh + prevLow + prevClose) / 3;
    const r1 = (2 * pivot) - prevLow;
    const s1 = (2 * pivot) - prevHigh;
    const r2 = pivot + (prevHigh - prevLow);
    const s2 = pivot - (prevHigh - prevLow);

    // Setup Generation
    let action: 'BUY' | 'SELL' | 'WAIT' = 'WAIT';
    let entryArea = `${s1.toFixed(0)} - ${pivot.toFixed(0)}`;
    let stopLoss = s2;
    let takeProfit = r1;
    let aiNarrative = '';

    if (condition === 'OVERSOLD' || (trend === 'BULLISH' && lastPrice > s1 && lastPrice < pivot)) {
      action = 'BUY';
      aiNarrative = `Aset sedang berada di area Support 1 (${s1.toFixed(0)}). Indikator menunjukkan peluang pantulan (rebound) yang kuat. Lakukan akumulasi beli bertahap dengan Target Profit di ${r1.toFixed(0)}.`;
    } else if (condition === 'OVERBOUGHT' || (trend === 'BEARISH' && lastPrice < r1 && lastPrice > pivot)) {
      action = 'SELL';
      entryArea = `${pivot.toFixed(0)} - ${r1.toFixed(0)}`;
      stopLoss = r2;
      takeProfit = s1;
      aiNarrative = `Aset sedang berada di fase Overbought dan mendekati area Resisten (${r1.toFixed(0)}). Risiko koreksi tinggi. Pertimbangkan untuk merealisasikan profit (Sell on Strength).`;
    } else {
      aiNarrative = `Pergerakan aset sedang berkonsolidasi di dekat level Pivot (${pivot.toFixed(0)}). Belum ada momentum dominan. Disarankan untuk wait and see hingga menembus S1 atau R1.`;
    }

    return {
      symbol: rawSymbol,
      lastPrice,
      momentum: { rsi: Number(rsi.toFixed(2)), trend, condition },
      levels: { pivot, support1: s1, support2: s2, resistance1: r1, resistance2: r2 },
      recommendation: { action, entryArea, stopLoss, takeProfit, aiNarrative }
    };
  } catch (err: any) {
    throw new Error(`Failed to generate trading setup for ${rawSymbol}: ${err.message}`);
  }
};
