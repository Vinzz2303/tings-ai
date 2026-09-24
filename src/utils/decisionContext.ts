export type PlanTier = 'free' | 'pro'

export type DecisionContext = {
  marketRegime: string
  riskLevel: string
  overnightChange: string[]
  portfolioFit: string
  concentrationRisk?: string
  mainImplication: string
  planTier: PlanTier
}

export function generateMockDecisionContext(isPro: boolean): DecisionContext {
  return {
    marketRegime: 'Defensive',
    riskLevel: 'Increasing',
    overnightChange: [
      'Gold is showing relative strength compared to equities.',
      'S&P 500 futures are slightly down amid inflation concerns.'
    ],
    portfolioFit: isPro ? 'Your portfolio is currently defensive, which aligns well with the current market regime.' : 'Overview of your portfolio fit.',
    concentrationRisk: isPro ? 'High concentration in financials.' : undefined,
    mainImplication: 'Your portfolio is more sensitive to downside risk today.',
    planTier: isPro ? 'pro' : 'free'
  }
}
