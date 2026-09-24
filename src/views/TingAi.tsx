import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import TingAiCopilot from '../components/ting-ai-v2/TingAiCopilot'
import { fetchIndonesianStocks } from '../lib/stockService'
import type { DetailedStockData } from '../lib/stockService'
import { generateInsight, generateQuickInsight } from '../engine/insightEngine'
import { computeConfidenceFromQuotes } from '../engine/trustLayer'
import type { ConfidenceScore } from '../engine/trustLayer'
import type { FullInsight, InsightInput } from '../engine/insightEngine'
import { useAuthSession } from '../utils/useAuthSession'
import { hasProAccess } from '../utils/entitlements'
import { useLanguagePreference } from '../utils/language'
import { sanitizeMarketPercent } from '../utils/marketFormatting'
import { getTingAiI18n } from '../utils/tingAiI18n'
import { readPortfolioSnapshot, type NormalizedPortfolioSnapshot } from '../utils/portfolioSnapshot'

// ─────────────────────────────────────────────────────────────────────
// Premium Dark Design Tokens
// ─────────────────────────────────────────────────────────────────────
const C = {
  bg:       '#09090b', // zinc-950
  surface:  '#18181b', // zinc-900
  border:   '#27272a', // zinc-800
  text:     '#e4e4e7', // zinc-200
  muted:    '#a1a1aa', // zinc-400
  accent:   '#3f3f46', // zinc-700
  mono:     "'Geist Mono', 'SF Mono', 'JetBrains Mono', monospace",
  sans:     "'Geist', 'Inter', system-ui, sans-serif",
  serif:    "'Instrument Serif', 'Newsreader', 'Playfair Display', serif",
}

export default function TingAi() {
  const { user } = useAuthSession()
  const isPro = hasProAccess(user)
  const { language: lang } = useLanguagePreference()
  const t = getTingAiI18n(lang as 'id' | 'en')

  const [quotes, setQuotes] = useState<DetailedStockData[]>([])
  const [portfolioSnapshot, setPortfolioSnapshot] = useState<NormalizedPortfolioSnapshot>(() => readPortfolioSnapshot())

  const [quickInsight, setQuickInsight] = useState<string | null>(null)
  const [fullInsight, setFullInsight] = useState<FullInsight | null>(null)
  const [confidenceScore, setConfidenceScore] = useState<ConfidenceScore | undefined>(undefined)

  // 1. Load Market Data
  useEffect(() => {
    fetchIndonesianStocks()
      .then(data => { if (data.length > 0) setQuotes(data) })
      .catch(() => {})
  }, [])

  // 2. Sync Portfolio
  useEffect(() => {
    const syncPortfolioSnapshot = () => setPortfolioSnapshot(readPortfolioSnapshot())
    syncPortfolioSnapshot()
    window.addEventListener('tingai-portfolio-snapshot', syncPortfolioSnapshot)
    window.addEventListener('storage', syncPortfolioSnapshot)
    return () => {
      window.removeEventListener('tingai-portfolio-snapshot', syncPortfolioSnapshot)
      window.removeEventListener('storage', syncPortfolioSnapshot)
    }
  }, [])

  // 3. Auto-Generate Context for Copilot
  useEffect(() => {
    if (quotes.length === 0) return

    const cleanQuotes = quotes.map(q => ({
      status: q.status,
      changePercent: sanitizeMarketPercent(q.changePercent, 35) ?? 0
    }))
    
    const validChanges = cleanQuotes.map(q => q.changePercent).filter(v => !isNaN(v))
    const avgAbs = validChanges.length > 0
      ? validChanges.reduce((s, v) => s + Math.abs(v), 0) / validChanges.length
      : 0
    const redRatio = validChanges.length > 0
      ? validChanges.filter(v => v < 0).length / validChanges.length
      : 0.5

    const volatility: 'low' | 'medium' | 'high' =
      avgAbs > 2.5 ? 'high' : avgAbs < 0.8 ? 'low' : 'medium'
    const trend: 'up' | 'sideways' | 'down' =
      redRatio < 0.35 ? 'up' : redRatio > 0.65 ? 'down' : 'sideways'

    const initialTrust = computeConfidenceFromQuotes(cleanQuotes, volatility)
    setConfidenceScore(initialTrust)

    const holdings = portfolioSnapshot.holdings.map(h => ({
      asset: h.symbol,
      weight: h.allocationPercent,
    }))

    const insightCtx: InsightInput = {
      portfolio: holdings,
      market: { volatility, trend },
      language: lang as 'id' | 'en',
      trust: initialTrust,
    }

    setQuickInsight(generateQuickInsight(insightCtx))
    setFullInsight(generateInsight(insightCtx))
  }, [quotes, portfolioSnapshot, lang])

  const portfolioContext = useMemo(() => {
    return portfolioSnapshot.holdings.map(h => ({
      asset: h.symbol,
      weight: h.allocationPercent,
    }))
  }, [portfolioSnapshot.holdings])

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, color: C.text, fontFamily: C.sans, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      
      {/* ── TOP NAV (Ultra Minimalist) ── */}
      <nav style={{
        padding: '24px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        zIndex: 50,
      }}>
        <Link to="/" style={{
          display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
          fontFamily: C.mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em',
          color: C.muted, transition: 'color 0.2s ease',
        }} onMouseEnter={e => e.currentTarget.style.color = C.text} onMouseLeave={e => e.currentTarget.style.color = C.muted}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          {t.back}
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: isPro ? '#f59e0b' : '#14b8a6',
            boxShadow: `0 0 12px ${isPro ? '#f59e0b' : '#14b8a6'}`,
          }} />
          <span style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', color: C.text }}>
            TING AI {isPro ? 'PRO' : ''}
          </span>
        </div>
      </nav>

      {/* ── MAIN WORKSPACE ── */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 16px 32px',
        maxWidth: 1000,
        margin: '0 auto',
        width: '100%',
      }}>
        <TingAiCopilot
          market={{
            volatility: confidenceScore?.reason.volatility ?? 'medium',
            trend: 'sideways' // approximate fallback if needed
          }}
          portfolio={portfolioContext}
          trust={confidenceScore || { confidence: 'MEDIUM', reason: { sourceAlignment: false, volatility: 'medium', dataQuality: 'weak', note: '' } }}
          insight={fullInsight || { reality: '', tradeoff: '', direction: '' }}
          isPro={isPro}
        />
      </main>
    </div>
  )
}
