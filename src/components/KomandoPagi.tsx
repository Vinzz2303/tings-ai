/**
 * KomandoPagi.tsx — Morning Command (v5 with News Intelligence)
 * Compact decision dashboard with integrated news signals.
 * Layer A (Free): 2–3 micro-evidence bullets under hero.
 * Layer B (Pro): Collapsed news analysis with impact + scenario.
 */
import { useMemo, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguagePreference } from '../utils/language'
import { getMorningCommandCopy } from '../utils/morningCommandI18n'
import { computeMorningCommandState, type RiskLevel } from '../utils/morningCommandModel'
import { fetchNewsIntelligence, type NewsIntelligence, type SignalDirection } from '../utils/newsSignalService'
import { useAuthSession } from '../utils/useAuthSession'
import PortfolioActionWatchlist from './PortfolioActionWatchlist'
import RiskBudgetCard from './RiskBudgetCard'
import DecisionJournal from './DecisionJournal'
import EmptyPortfolioState from './EmptyPortfolioState'
import { readPortfolioSnapshot } from '../utils/portfolioSnapshot'
import { buildPortfolioActionWatchlist } from '../utils/portfolioActionWatchlist'
import { evaluateRiskBudget, readRiskBudget } from '../utils/riskBudget'

/* ── Palette ──────────────────────────────────────────────────────── */
const palette: Record<RiskLevel, {
  accent: string; dot: string; glow: string; bg: string
  pillBg: string; pillText: string; pillBorder: string
}> = {
  low: {
    accent: '#2dd4bf', dot: '#14b8a6', glow: 'rgba(20,184,166,0.12)',
    bg: 'rgba(20,184,166,0.04)',
    pillBg: 'rgba(20,184,166,0.10)', pillText: '#5eead4', pillBorder: 'rgba(20,184,166,0.25)',
  },
  medium: {
    accent: '#fbbf24', dot: '#f59e0b', glow: 'rgba(251,191,36,0.12)',
    bg: 'rgba(251,191,36,0.04)',
    pillBg: 'rgba(251,191,36,0.10)', pillText: '#fcd34d', pillBorder: 'rgba(251,191,36,0.25)',
  },
  high: {
    accent: '#f87171', dot: '#ef4444', glow: 'rgba(248,113,113,0.14)',
    bg: 'rgba(248,113,113,0.05)',
    pillBg: 'rgba(248,113,113,0.10)', pillText: '#fca5a5', pillBorder: 'rgba(248,113,113,0.25)',
  },
}

/* ── Signal direction to dot color ────────────────────────────────── */
const directionDot: Record<SignalDirection, string> = {
  risk_off: '#f87171',
  risk_on: '#34d399',
  neutral: '#94a3b8',
}

/* ── Subtle pulsing indicator ─────────────────────────────────────── */
function PulseIndicator({ color, glowColor }: { color: string; glowColor: string }) {
  return (
    <span className="relative block w-2 h-2 flex-shrink-0">
      <span
        className="absolute inset-0 rounded-full animate-ping opacity-40"
        style={{ background: color }}
      />
      <span
        className="relative block w-2 h-2 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${glowColor}` }}
      />
    </span>
  )
}

/* ── Pro gate wrapper ─────────────────────────────────────────────── */
function ProSection({
  children,
  label,
  proLabel,
  previewLabel,
  isPremium,
}: {
  children: React.ReactNode
  label: string
  proLabel: string
  previewLabel: string
  isPremium: boolean
}) {
  const [revealed, setRevealed] = useState(false)
  if (isPremium || revealed) return <>{children}</>
  return (
    <div className="relative rounded-2xl border border-white/[0.06] overflow-hidden">
      <div className="pointer-events-none blur-[3px] opacity-30 select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-[#080a0f]/60 backdrop-blur-sm">
        <div className="text-center space-y-2">
          <span className="inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border border-teal-500/30 text-teal-400/70 mb-1">
            {proLabel}
          </span>
          <p className="text-slate-400 text-xs max-w-[200px] leading-relaxed">{label}</p>
          <button
            onClick={() => setRevealed(true)}
            className="px-4 py-1.5 text-[11px] font-semibold rounded-lg border border-teal-500/30 text-teal-400 hover:bg-teal-500/10 transition-all"
          >
            {previewLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main Component ───────────────────────────────────────────────── */
export default function KomandoPagi({ userPlan }: { userPlan?: string }) {
  const navigate = useNavigate()
  const { language } = useLanguagePreference()
  const { user } = useAuthSession()
  const isPremium = Boolean(userPlan && userPlan !== 'free')
  const copy = useMemo(() => getMorningCommandCopy(language), [language])
  const state = useMemo(() => computeMorningCommandState(language), [language])
  const portfolioSnapshot = useMemo(() => readPortfolioSnapshot(), [])
  const actionWatchlist = useMemo(
    () => buildPortfolioActionWatchlist(portfolioSnapshot, language, isPremium ? 5 : 2),
    [isPremium, language, portfolioSnapshot]
  )
  const riskBudgetEvaluation = useMemo(
    () => evaluateRiskBudget(portfolioSnapshot, readRiskBudget(), language),
    [language, portfolioSnapshot]
  )
  const p = palette[state.riskLevel]

  const name = user?.fullname?.split(' ')[0] ?? ''
  const dateLabel = useMemo(() =>
    new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'id-ID', {
      weekday: 'long', day: 'numeric', month: 'long'
    }).format(new Date()), [language])

  const [showContext, setShowContext] = useState(false)
  const [showNewsAnalysis, setShowNewsAnalysis] = useState(false)
  const [copied, setCopied] = useState(false)

  const buildShareText = () => {
    const riskLabel = copy.riskLevels[state.riskLevel]
    const headline = copy.heroHeadline[state.stateKey]
    let bullets = ''
    if (newsData?.loaded && newsData.signals.length > 0) {
      bullets = newsData.signals.slice(0,3).map(s => `• ${s.bullet}`).join('\n')
    }
    
    if (language === 'id') {
      return [
        `🧠 *Komando Pagi Ting AI* — ${dateLabel}`,
        ``,
        `📊 Status Pasar: *${riskLabel}*`,
        `${headline}`,
        ``,
        bullets ? `📰 Sinyal Berita:\n${bullets}` : '',
        ``,
        `⚡ Analisis mandiri, bukan rekomendasi investasi.`,
        `👉 tingsai.my.id`,
      ].filter(Boolean).join('\n')
    }
    return [
      `🧠 *Ting AI Morning Command* — ${dateLabel}`,
      ``,
      `📊 Market Status: *${riskLabel}*`,
      `${headline}`,
      ``,
      bullets ? `📰 News Signals:\n${bullets}` : '',
      ``,
      `⚡ Independent analysis, not investment advice.`,
      `👉 tingsai.my.id`,
    ].filter(Boolean).join('\n')
  }

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(buildShareText())
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(buildShareText())
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch { /* clipboard not available */ }
  }

  // ── News Intelligence fetch ─────────────────────────────────────
  const [newsData, setNewsData] = useState<NewsIntelligence | null>(null)

  useEffect(() => {
    if (!state.hasPortfolio) return
    fetchNewsIntelligence(language).then(setNewsData)
  }, [language, state.hasPortfolio])

  const hasNews = newsData?.loaded && newsData.signals.length > 0

  // ── Empty state ─────────────────────────────────────────────────
  if (!state.hasPortfolio) {
    return <EmptyPortfolioState userPlan={userPlan} language={language} />
  }

  // ── Quick cards data ────────────────────────────────────────────
  const quickCards = [
    { icon: '◈', label: copy.cardMarketPressure, value: copy.impact[state.stateKey] },
    { icon: '◎', label: copy.cardPortfolioImpact, value: copy.statesSub[state.stateKey] },
    { icon: '◉', label: copy.cardFocusLabel,      value: copy.focus[state.stateKey] },
  ]

  // ── News impact text (uses portfolio concentration) ─────────────
  const newsImpactText = state.topAssetLabel
    ? copy.newsImpactToPortfolio
        .replace('{asset}', state.topAssetLabel)
        .replace('{pct}', state.concentrationPct.toFixed(0))
    : ''

  return (
    <div className="space-y-4">
      {/* ══════════════════════════════════════════════════════════
          COMMAND HERO — Above the fold
         ══════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="relative pb-10 border-b border-white/[0.05]"
      >
        {/* Subtle top indicator line matching the theme color */}
        <div
          className="absolute top-0 inset-x-0 h-[1.5px]"
          style={{ background: `linear-gradient(90deg, ${p.accent}50, transparent)` }}
        />

        <div className="relative z-10 pt-8 space-y-6">
          {/* Date + name */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PulseIndicator color={p.dot} glowColor={p.glow} />
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{dateLabel}</span>
            </div>
            {name && (
              <span className="text-[11px] text-slate-500">
                {copy.greetingMorning.split(',')[0]}, <span className="text-slate-300 font-medium">{name}</span>
              </span>
            )}
          </div>

          {/* Main headline */}
          <h1
            className="text-xl md:text-2xl font-bold tracking-tight text-white"
            style={{ lineHeight: '1.3', maxWidth: '540px' }}
          >
            {copy.heroHeadline[state.stateKey]}
          </h1>

          {/* ── Layer A: News micro-evidence bullets (Free) ──── */}
          {hasNews && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">
                {copy.newsEvidenceLabel}
              </p>
              <ul className="space-y-1">
                {newsData!.signals.slice(0, 3).map((sig, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[12px] text-slate-400"
                    style={{ lineHeight: '1.45' }}
                  >
                    <span
                      className="block w-1.5 h-1.5 rounded-full mt-[5px] flex-shrink-0"
                      style={{ background: directionDot[sig.direction] }}
                    />
                    <span className="line-clamp-1">{sig.bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {newsData !== null && !hasNews && newsData.loaded && null /* silently skip if no news */}

          {/* Pills row */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border"
              style={{
                background: p.pillBg, color: p.pillText, borderColor: p.pillBorder,
                boxShadow: `0 0 12px ${p.glow}, 0 0 24px ${p.glow}`,
                animation: state.riskLevel === 'high' ? 'glow-pulse 2s ease-in-out infinite' : 'none',
              }}
            >
              {copy.riskLevels[state.riskLevel]}
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-white/[0.08]"
              style={{ background: 'rgba(255,255,255,0.03)', color: '#94a3b8' }}
            >
              {copy.portfolioFit[state.stateKey]}
            </span>
          </div>

          {/* Primary + Secondary CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              to="/portfolio"
              id="komando-cta-portfolio"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: p.accent, color: '#000', boxShadow: `0 4px 20px ${p.dot}30, 0 0 40px ${p.dot}10` }}
            >
              {copy.ctaPortfolioImpact}
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <button
              type="button"
              onClick={() => navigate('/ting-ai')}
              id="komando-cta-tingai"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium rounded-xl border border-white/[0.08] text-slate-300 hover:bg-white/[0.04] transition-all"
            >
              {copy.ctaTingAi}
            </button>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handleShareWhatsApp}
                className="inline-flex items-center gap-2 px-3 py-2 text-[11px] font-medium rounded-lg border border-white/[0.08] text-slate-300 hover:bg-[#25D366]/10 hover:text-[#25D366] hover:border-[#25D366]/30 transition-all"
                title="Share to WhatsApp"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.487-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a5.8 5.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                </svg>
                {language === 'en' ? 'Share' : 'Bagikan'}
              </button>
              <button
                onClick={handleCopyText}
                className={`inline-flex items-center gap-2 px-3 py-2 text-[11px] font-medium rounded-lg border transition-all ${
                  copied 
                    ? 'border-teal-500/50 bg-teal-500/10 text-teal-400' 
                    : 'border-white/[0.08] text-slate-300 hover:bg-white/[0.04]'
                }`}
                title="Copy to Clipboard"
              >
                {copied ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                )}
                {copied ? (language === 'en' ? 'Copied!' : 'Tersalin!') : (language === 'en' ? 'Copy' : 'Salin')}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════
          3 COMPACT CARDS — 1 sentence each, no paragraphs
         ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {quickCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.06 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="border-t border-white/[0.05] py-4 space-y-1.5 transition-all duration-300 hover:border-white/[0.12] hover:-translate-y-0.5"
            style={{ minHeight: '68px' }}
          >
            <p className="text-[10px] font-mono text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <span style={{ opacity: 0.5, fontSize: '8px' }}>{card.icon}</span>
              {card.label}
            </p>
            <p className="text-slate-300 text-[13px]" style={{ lineHeight: '1.5' }}>
              {card.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════
          FREE: Collapsible context detail
         ══════════════════════════════════════════════════════════ */}
		      <RiskBudgetCard
		        snapshot={portfolioSnapshot}
		        language={language}
		        isPro={isPremium}
		        compact
		      />

		      <PortfolioActionWatchlist
		        items={actionWatchlist}
		        language={language}
		        isPro={isPremium}
	        compact
	      />

	      <DecisionJournal
	        snapshot={portfolioSnapshot}
	        language={language}
	        isPro={isPremium}
	        riskBudgetEvaluation={riskBudgetEvaluation}
	        watchlistItems={actionWatchlist}
	        compact
	      />

	      <motion.div
	        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
      >
        <button
          onClick={() => setShowContext(v => !v)}
          className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors font-medium"
        >
          <svg
            className={`w-3 h-3 transition-transform duration-200 ${showContext ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {showContext ? copy.hideDetail : copy.showDetail}
        </button>
        <AnimatePresence>
          {showContext && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="pt-3 pb-1">
                <div
                  className="rounded-xl border border-white/[0.05] px-4 py-3.5"
                  style={{ background: 'rgba(255,255,255,0.015)' }}
                >
                  <p className="text-slate-400 text-[13px]" style={{ lineHeight: '1.55' }}>
                    {copy.context[state.stateKey]}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════
          LAYER B (PRO): News analysis — collapsed by default
         ══════════════════════════════════════════════════════════ */}
      {hasNews && (
        <ProSection
          label={copy.newsAnalysisLabel}
          proLabel={copy.proUnlockLabel}
          previewLabel={copy.proPreviewLabel}
          isPremium={isPremium}
        >
          <div className="space-y-0.5">
            <button
              onClick={() => setShowNewsAnalysis(v => !v)}
              className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors font-medium w-full"
            >
              <svg
                className={`w-3 h-3 transition-transform duration-200 ${showNewsAnalysis ? 'rotate-90' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {copy.newsAnalysisLabel}
              {!isPremium && (
                <span className="ml-1 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest border border-teal-500/25 text-teal-400/60 rounded">
                  {copy.proUnlockLabel}
                </span>
              )}
            </button>
            <AnimatePresence>
              {showNewsAnalysis && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 pb-1 space-y-3">
                    {/* Why it matters */}
                    <div
                      className="rounded-xl border border-white/[0.05] px-4 py-3.5 space-y-1.5"
                      style={{ background: 'rgba(255,255,255,0.015)' }}
                    >
                      <p className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">
                        {language === 'en' ? 'Why it matters' : 'Mengapa penting'}
                      </p>
                      <p className="text-slate-400 text-[13px]" style={{ lineHeight: '1.55' }}>
                        {copy.newsWhyItMatters[newsData!.netDirection]}
                      </p>
                    </div>

                    {/* Impact to portfolio */}
                    {newsImpactText && (
                      <div
                        className="rounded-xl border border-white/[0.05] px-4 py-3.5 space-y-1.5"
                        style={{ background: 'rgba(255,255,255,0.015)' }}
                      >
                        <p className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">
                          {language === 'en' ? 'Your portfolio' : 'Portofoliomu'}
                        </p>
                        <p className="text-slate-400 text-[13px]" style={{ lineHeight: '1.55' }}>
                          {newsImpactText}
                        </p>
                      </div>
                    )}

                    {/* Scenario */}
                    <div
                      className="rounded-xl border border-white/[0.05] px-4 py-3.5 space-y-1.5"
                      style={{ background: 'rgba(255,255,255,0.015)' }}
                    >
                      <p className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">
                        {language === 'en' ? 'If this continues' : 'Jika berlanjut'}
                      </p>
                      <p className="text-slate-400 text-[13px]" style={{ lineHeight: '1.55' }}>
                        {copy.newsScenario[newsData!.netDirection]}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ProSection>
      )}

      {/* ══════════════════════════════════════════════════════════
          PRO SECTIONS — locked/blurred for free
         ══════════════════════════════════════════════════════════ */}
      <div className="space-y-3 pt-1">
        {/* Pro: AI Explanation */}
        <ProSection
          label={copy.proSectionAiExplanation}
          proLabel={copy.proUnlockLabel}
          previewLabel={copy.proPreviewLabel}
          isPremium={isPremium}
        >
          <div
            className="rounded-xl border border-white/[0.06] px-5 py-4 space-y-2"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">{copy.proSectionAiExplanation}</span>
              {!isPremium && (
                <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest border border-teal-500/25 text-teal-400/60 rounded">
                  {copy.proUnlockLabel}
                </span>
              )}
            </div>
            <p className="text-slate-400 text-[13px]" style={{ lineHeight: '1.55' }}>
              {copy.context[state.stateKey]}
            </p>
          </div>
        </ProSection>

        {/* Pro: Risk Scenario */}
        <ProSection
          label={copy.proSectionRiskScenario}
          proLabel={copy.proUnlockLabel}
          previewLabel={copy.proPreviewLabel}
          isPremium={isPremium}
        >
          <div
            className="rounded-xl border border-white/[0.06] px-5 py-4 space-y-2"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">{copy.proSectionRiskScenario}</span>
              {!isPremium && (
                <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest border border-teal-500/25 text-teal-400/60 rounded">
                  {copy.proUnlockLabel}
                </span>
              )}
            </div>
            <ul className="space-y-1">
              <li className="flex items-start gap-2 text-slate-400 text-[13px]" style={{ lineHeight: '1.5' }}>
                <span className="text-slate-600 mt-0.5">•</span>
                {state.topAssetLabel
                  ? (language === 'en'
                    ? `If ${state.topAssetLabel} drops 5%, portfolio impact: ~${(state.concentrationPct * 0.05).toFixed(1)}%.`
                    : `Jika ${state.topAssetLabel} turun 5%, dampak: ~${(state.concentrationPct * 0.05).toFixed(1)}%.`)
                  : copy.impact[state.stateKey]
                }
              </li>
              <li className="flex items-start gap-2 text-slate-400 text-[13px]" style={{ lineHeight: '1.5' }}>
                <span className="text-slate-600 mt-0.5">•</span>
                {state.topAssetLabel
                  ? (language === 'en'
                    ? `Concentration: ${state.topAssetLabel} at ${state.concentrationPct.toFixed(0)}%.`
                    : `Konsentrasi: ${state.topAssetLabel} di ${state.concentrationPct.toFixed(0)}%.`)
                  : copy.focus[state.stateKey]
                }
              </li>
            </ul>
          </div>
        </ProSection>
      </div>

      {/* ══════════════════════════════════════════════════════════
          FREE: Action hint (subtle pro teaser)
         ══════════════════════════════════════════════════════════ */}
      {!isPremium && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="pt-1"
        >
          <Link
            to="/upgrade"
            className="flex items-center gap-2 text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
          >
            <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest border border-white/[0.08] text-slate-600 rounded">
              Pro
            </span>
            {copy.proHint} →
          </Link>
        </motion.div>
      )}
    </div>
  )
}
