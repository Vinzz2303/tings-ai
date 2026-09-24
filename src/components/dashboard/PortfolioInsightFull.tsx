'use client'

import React from 'react'
import { t } from './dashboardI18n'
import type { DashboardCopy, DecisionContext, FitLevel } from './types'

type Props = {
  copy: DashboardCopy
  decisionContext: DecisionContext
}

const fitContent: Record<
  FitLevel,
  {
    explanationKey: 'portfolioWhy_good' | 'portfolioWhy_moderate' | 'portfolioWhy_weak'
    primaryReasoningKey:
      | 'portfolioPosture_good'
      | 'portfolioPosture_moderate'
      | 'portfolioPosture_weak'
  }
> = {
  good_fit: {
    explanationKey: 'portfolioWhy_good',
    primaryReasoningKey: 'portfolioPosture_good'
  },
  moderate_fit: {
    explanationKey: 'portfolioWhy_moderate',
    primaryReasoningKey: 'portfolioPosture_moderate'
  },
  weak_fit: {
    explanationKey: 'portfolioWhy_weak',
    primaryReasoningKey: 'portfolioPosture_weak'
  }
}

const defaultFitContent = fitContent.moderate_fit

export default function PortfolioInsightFull({ copy, decisionContext }: Props) {
  const resolvedFitContent = fitContent[decisionContext.fitLevel] ?? defaultFitContent

  const secondaryReasoning =
    decisionContext.concentrationRisk?.trim() ||
    (decisionContext.userState === 'overexposed'
      ? t('exposureNote_overexposed', copy.language)
      : decisionContext.userState === 'watchful'
        ? t('exposureNote_watchful', copy.language)
        : t('exposureNote_aligned', copy.language))

  return (
    <section className="w-full max-w-7xl mx-auto py-24" id="portfolio-insight-full">
      <div className="flex items-center gap-4 mb-8">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tighter uppercase text-[#EAEAEA]" style={{ fontFamily: '"Cabinet Grotesk", "Archivo Black", "Inter", sans-serif' }}>
          {copy.portfolioFit}
        </h2>
        <div className="flex-1 h-px bg-[#E61919]"></div>
        <span className="font-mono text-[10px] text-[#EAEAEA]/50 uppercase tracking-widest hidden md:block">
          UNIT // INSIGHT-01
        </span>
      </div>

      <p className="font-mono text-sm text-[#EAEAEA]/70 max-w-3xl leading-relaxed mb-12">
        {decisionContext.portfolioFit}
      </p>

      {/* GAPLESS BENTO GRID (Industrial Brutalist styling) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-[1px] bg-[#EAEAEA]/20 border border-[#EAEAEA]/20 grid-flow-dense">
        
        {/* Cell 1: Action Stance (Large Focus) */}
        <div className="md:col-span-4 md:row-span-2 bg-[#0A0A0A] p-6 group overflow-hidden relative cursor-default">
          <div className="absolute top-4 right-4 font-mono text-[9px] text-[#E61919] tracking-widest uppercase">PRIORITY.01</div>
          <div className="h-full flex flex-col justify-end transition-transform duration-700 ease-out group-hover:scale-105">
            <span className="font-mono text-[10px] text-[#EAEAEA]/50 uppercase tracking-widest mb-2 block">{copy.actionStance}</span>
            <span className="text-2xl md:text-3xl font-bold tracking-tight text-[#EAEAEA] uppercase leading-tight">
              {t(`stance_${decisionContext.actionableInsight.actionStance}` as const, copy.language)}
            </span>
          </div>
        </div>

        {/* Cell 2: Fit Level */}
        <div className="md:col-span-4 bg-[#0A0A0A] p-6 group overflow-hidden cursor-default">
          <div className="h-full flex flex-col justify-end transition-transform duration-700 ease-out group-hover:scale-105">
            <span className="font-mono text-[10px] text-[#EAEAEA]/50 uppercase tracking-widest mb-1 block">{t('fitLevelLabel', copy.language)}</span>
            <span className="text-lg font-bold text-[#EAEAEA]">{t(`fitLevel_${decisionContext.fitLevel}` as const, copy.language)}</span>
          </div>
        </div>

        {/* Cell 3: User Status */}
        <div className="md:col-span-4 bg-[#0A0A0A] p-6 group overflow-hidden cursor-default">
          <div className="h-full flex flex-col justify-end transition-transform duration-700 ease-out group-hover:scale-105">
            <span className="font-mono text-[10px] text-[#EAEAEA]/50 uppercase tracking-widest mb-1 block">{t('userStatusLabel', copy.language)}</span>
            <span className="text-lg font-bold text-[#EAEAEA]">{decisionContext.userStatus}</span>
          </div>
        </div>

        {/* Cell 4: Why It Fits */}
        <div className="md:col-span-8 bg-[#0A0A0A] p-6 group overflow-hidden cursor-default">
          <div className="h-full flex flex-col justify-start transition-transform duration-700 ease-out group-hover:scale-105">
            <span className="font-mono text-[10px] text-[#EAEAEA]/50 uppercase tracking-widest mb-2 block">{t('whyItFitsLabel', copy.language)}</span>
            <p className="font-mono text-sm text-[#EAEAEA]/90 leading-relaxed">
              {t(resolvedFitContent.explanationKey, copy.language)}
            </p>
          </div>
        </div>

        {/* Cell 5: Action Summary */}
        <div className="md:col-span-12 bg-[#EAEAEA]/5 p-6 group overflow-hidden cursor-default relative">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#E61919]"></div>
          <div className="h-full flex flex-col justify-start transition-transform duration-700 ease-out group-hover:scale-[1.02]">
            <span className="font-mono text-[10px] text-[#EAEAEA]/50 uppercase tracking-widest mb-2 block pl-4">{copy.actionSummary}</span>
            <p className="text-lg md:text-xl font-medium text-[#EAEAEA] leading-snug pl-4">
              {decisionContext.actionableInsight.actionSummary}
            </p>
          </div>
        </div>

        {/* Cell 6: Portfolio Posture */}
        <div className="md:col-span-6 bg-[#0A0A0A] p-6 group overflow-hidden cursor-default">
          <div className="h-full flex flex-col justify-start transition-transform duration-700 ease-out group-hover:scale-105">
            <span className="font-mono text-[10px] text-[#EAEAEA]/50 uppercase tracking-widest mb-2 block">{t('portfolioPostureLabel', copy.language)}</span>
            <p className="font-mono text-sm text-[#EAEAEA]/80">
              {t(resolvedFitContent.primaryReasoningKey, copy.language)}
            </p>
          </div>
        </div>

        {/* Cell 7: Exposure Note */}
        <div className="md:col-span-6 bg-[#0A0A0A] p-6 group overflow-hidden cursor-default">
          <div className="h-full flex flex-col justify-start transition-transform duration-700 ease-out group-hover:scale-105">
            <span className="font-mono text-[10px] text-[#EAEAEA]/50 uppercase tracking-widest mb-2 block">{t('exposureNoteLabel', copy.language)}</span>
            <p className="font-mono text-sm text-[#EAEAEA]/80">
              {secondaryReasoning}
            </p>
          </div>
        </div>

        {/* Cell 8: Action Focus Bullets */}
        <div className="md:col-span-12 bg-[#0A0A0A] p-6 group overflow-hidden cursor-default">
          <div className="h-full flex flex-col justify-start transition-transform duration-700 ease-out group-hover:scale-[1.02]">
            <span className="font-mono text-[10px] text-[#EAEAEA]/50 uppercase tracking-widest mb-4 block">{copy.actionFocus}</span>
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-sm text-[#EAEAEA]">
              {decisionContext.actionableInsight.actionBullets.map((item, index) => (
                <li key={index} className="flex gap-3 items-start">
                  <span className="text-[#E61919] mt-0.5">&gt;&gt;</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>
    </section>
  )
}
