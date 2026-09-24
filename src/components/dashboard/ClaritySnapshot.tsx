import React from 'react'
import { t } from './dashboardI18n'
import type { DashboardCopy, DecisionContext } from './types'

type Props = {
  copy: DashboardCopy
  decisionContext: DecisionContext
}

export default function ClaritySnapshot({ copy, decisionContext }: Props) {
  const confidenceValue = t(
    `confidence_${decisionContext.decisionIntelligence.confidenceLevel}` as
      | 'confidence_low'
      | 'confidence_moderate'
      | 'confidence_high',
    copy.language
  )

  return (
    <section className="py-10" id="clarity-snapshot">
      <div className="mb-8">
        <p className="text-[10px] font-mono text-teal-500/80 uppercase tracking-widest mb-3">
          [ {copy.claritySnapshot} ]
        </p>
        <h3 className="text-xl md:text-2xl font-serif text-slate-200 max-w-2xl leading-relaxed">
          {copy.heroSummary}
        </h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-white/[0.05]">
        <div className="flex flex-col gap-1.5">
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">{copy.marketConditionLabel}</span>
          <strong className="text-sm text-slate-200 font-medium">{decisionContext.marketRegime}</strong>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">{copy.riskLevelLabel}</span>
          <strong className="text-sm text-slate-200 font-medium">{decisionContext.riskLevel}</strong>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">{copy.portfolioFitLabel}</span>
          <strong className="text-sm text-slate-200 font-medium">{decisionContext.userStatus}</strong>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">{copy.confidenceLabel}</span>
          <strong className="text-sm text-slate-200 font-medium">{confidenceValue}</strong>
        </div>
      </div>
    </section>
  )
}
