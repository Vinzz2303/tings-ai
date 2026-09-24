import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DecisionJournal from '../components/DecisionJournal'
import { useAuthSession } from '../utils/useAuthSession'
import { useLanguagePreference } from '../utils/language'
import { readPortfolioSnapshot } from '../utils/portfolioSnapshot'
import { evaluateRiskBudget, readRiskBudget } from '../utils/riskBudget'
import { buildPortfolioActionWatchlist } from '../utils/portfolioActionWatchlist'

export default function DecisionJournalPage() {
  const navigate = useNavigate()
  const { user } = useAuthSession()
  const { language } = useLanguagePreference()

  const userPlan = useMemo(() => {
    try { return localStorage.getItem('lifeOS_user_plan') || 'free' }
    catch { return 'free' }
  }, [])
  const isPremium = Boolean(userPlan && userPlan !== 'free')

  const snapshot = useMemo(() => readPortfolioSnapshot(), [])
  const riskBudgetEvaluation = useMemo(
    () => evaluateRiskBudget(snapshot, readRiskBudget(), language),
    [language, snapshot]
  )
  const actionWatchlist = useMemo(
    () => buildPortfolioActionWatchlist(snapshot, language, isPremium ? 5 : 2),
    [isPremium, language, snapshot]
  )

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(20,184,166,0.06) 0%, transparent 60%), #080a0f',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="max-w-3xl mx-auto px-4 pt-24 pb-10 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 animate-in fade-in duration-500">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white transition-all"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">Decision Journal</h1>
            <div className="group relative flex items-center justify-center">
              <div className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-[10px] font-bold cursor-help hover:bg-indigo-500/20 transition-colors">
                ?
              </div>
              <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-64 bg-slate-800 text-xs text-slate-300 p-3 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none border border-slate-700 z-50">
                <strong className="text-white block mb-1">Kurangi Emosi, Tambah Logika</strong>
                Catat alasan investasi sebelum klik tombol Buy/Sell di sekuritas Anda. AI kami akan memberi tahu jika aset yang Anda pilih mengganggu keseimbangan risiko (Risk Budget) portofolio Anda.
              </div>
            </div>
          </div>
        </div>

        <DecisionJournal
          snapshot={snapshot}
          language={language}
          isPro={isPremium}
          riskBudgetEvaluation={riskBudgetEvaluation}
          watchlistItems={actionWatchlist}
        />
      </div>
    </div>
  )
}
