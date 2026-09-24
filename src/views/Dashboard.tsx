import React, { useEffect, useState } from 'react'
import { API_URL } from '../utils/api'
import { fetchWithSession } from '../utils/authFetch'
import { useLanguagePreference } from '../utils/language'
import type { InvestmentSummaryResponse } from '../types'
import { getDashboardCopy } from '../components/dashboard/dashboardI18n'
import { deriveDecisionContext } from '../components/dashboard/decisionContext'
import type { DecisionContextInput } from '../components/dashboard/types'
import FreeDashboard from '../components/dashboard/FreeDashboard'
import ProDashboard from '../components/dashboard/ProDashboard'
import { getCurrentPortfolioSnapshot } from '../utils/portfolioStorage'

export default function Dashboard() {
  const { language } = useLanguagePreference()
  const copy = getDashboardCopy(language)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summaryData, setSummaryData] = useState<InvestmentSummaryResponse | null>(null)
  const [portfolio, setPortfolio] = useState<any>(null)

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    const portfolioPromise = getCurrentPortfolioSnapshot().catch(() => null)

    const loadData = async () => {
      try {
        const res = await fetchWithSession(`${API_URL}/api/investment-summary`, {
          signal: controller.signal
        })
        if (!res.ok) throw new Error('Failed to fetch investment summary')
        const data = (await res.json()) as InvestmentSummaryResponse
        const port = await portfolioPromise
        
        if (active) {
          setSummaryData(data)
          setPortfolio(port)
          setLoading(false)
        }
      } catch (err: any) {
        if (active) {
          console.error(err)
          setError(err.message || 'Failed to load dashboard')
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      active = false
      controller.abort()
    }
  }, [])

  // Construct DecisionContextInput
  const planTier = summaryData?.accessLevel === 'pro' ? 'pro' : 'free'
  
  const input: DecisionContextInput = {
    summary: summaryData?.summary || '',
    market: Object.entries(summaryData?.meta?.instruments || {}).map(([symbol, inst]) => ({
      symbol,
      delta: inst.pct, // Use percentage change if available
      error: inst.error
    })),
    marketContext: summaryData?.meta?.context as any, // Typecast if necessary
    portfolio: {
      exposure: portfolio?.exposure,
      concentration: portfolio?.concentration,
      regionBias: portfolio?.regionBias,
      assetMix: portfolio?.assetMix
    },
    planTier,
    language
  }

  const decisionContext = deriveDecisionContext(input)

  if (planTier === 'pro') {
    return (
      <main className="min-h-screen bg-[#050505] text-[#EAEAEA] font-sans selection:bg-[#E61919]/30 pb-24 pt-20 overflow-x-hidden w-full max-w-full">
        <div className="w-full flex flex-col space-y-32 animate-in fade-in duration-700 px-6">
          <ProDashboard 
            copy={copy}
            decisionContext={decisionContext}
            loading={loading}
            error={error}
            insights={summaryData?.meta?.briefing?.map(b => b.body) || []}
            summary={summaryData?.summary || ''}
            instruments={summaryData?.meta?.instruments}
            headlines={summaryData?.meta?.context?.headlines}
          />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#050505] text-[#EAEAEA] font-sans selection:bg-[#E61919]/30 pb-24 pt-20 overflow-x-hidden w-full max-w-full">
      <div className="w-full flex flex-col space-y-32 animate-in fade-in duration-700 px-6">
        <FreeDashboard 
          copy={copy}
          decisionContext={decisionContext}
          loading={loading}
          error={error}
          insights={summaryData?.meta?.briefing?.map(b => b.body) || []}
          summary={summaryData?.summary || ''}
          instruments={summaryData?.meta?.instruments}
          headlines={summaryData?.meta?.context?.headlines}
        />
      </div>
    </main>
  )
}
