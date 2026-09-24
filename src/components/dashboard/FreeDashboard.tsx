import React from 'react'
import type { InstrumentSummary } from '../../types'
import TodayStatusHero from './TodayStatusHero'
import ClaritySnapshot from './ClaritySnapshot'
import ContextLayer from './ContextLayer'
import type { DashboardCopy, DecisionContext } from './types'

type Props = {
  copy: DashboardCopy
  decisionContext: DecisionContext
  loading: boolean
  error: string
  insights: string[]
  summary: string
  instruments?: {
    ANTAM?: InstrumentSummary
    SP500?: InstrumentSummary
    IHSG?: InstrumentSummary
    BTC?: InstrumentSummary
  }
  headlines?: import('../../types').MarketHeadline[]
}

export default function FreeDashboard({ copy, decisionContext, loading, error, insights, summary, instruments, headlines }: Props) {
  return (
    <>
      <TodayStatusHero copy={copy} decisionContext={decisionContext} />
      <ClaritySnapshot copy={copy} decisionContext={decisionContext} />
      <ContextLayer copy={copy} summary={summary} instruments={instruments} />
    </>
  )
}
