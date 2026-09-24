'use client'

import React, { useRef } from 'react'
import { t } from './dashboardI18n'
import type { DashboardCopy, DecisionContext } from './types'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

type Props = {
  copy: DashboardCopy
  decisionContext: DecisionContext
}

export default function TodayStatusHero({ copy, decisionContext }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    gsap.from('.telemetry-reveal', {
      y: 20,
      opacity: 0,
      stagger: 0.1,
      duration: 0.8,
      ease: 'power3.out'
    })
  }, { scope: containerRef })

  const isPro = decisionContext.planTier === 'pro'

  return (
    <section ref={containerRef} className="w-full max-w-7xl mx-auto pt-24 pb-20 border-b border-[#E61919]/20 relative">
      {/* Decorative Grid Background */}
      <div className="absolute inset-0 pointer-events-none opacity-20" 
           style={{
             backgroundImage: 'linear-gradient(to right, rgba(234, 234, 234, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(234, 234, 234, 0.1) 1px, transparent 1px)',
             backgroundSize: '40px 40px'
           }}
      />

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
        {/* Left Column: Macro Typography */}
        <div className="md:col-span-8 flex flex-col gap-6">
          <div className="telemetry-reveal flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-[#EAEAEA]/50">
            <span className="text-[#E61919] font-bold">[ TACTICAL OVERVIEW ]</span>
            <span>///</span>
            <span>SYS.READY</span>
            <span className="flex-1 h-px bg-[#EAEAEA]/10"></span>
          </div>
          
          {/* Force 2-line macro typography per gpt-taste & brutalist rules */}
          <h1 className="telemetry-reveal text-5xl md:text-7xl font-black tracking-tighter leading-[0.9] text-[#EAEAEA] uppercase break-words" style={{ fontFamily: '"Cabinet Grotesk", "Archivo Black", "Inter", sans-serif' }}>
            {copy.heroTitle || 'MARKET'}
            <br />
            <span className="text-[#EAEAEA]/40">{t('claritySnapshot', copy.language)}</span>
          </h1>

          <p className="telemetry-reveal font-mono text-sm max-w-2xl text-[#EAEAEA]/70 leading-relaxed mt-4">
            {t('heroSummary', copy.language)}
          </p>
        </div>

        {/* Right Column: Key Telemetry */}
        <div className="md:col-span-4 flex flex-col md:border-l md:border-[#EAEAEA]/20 md:pl-6 h-full justify-end telemetry-reveal mt-8 md:mt-0">
          <div className="space-y-4 font-mono text-xs uppercase tracking-wider">
            <div className="flex justify-between items-center border-b border-[#EAEAEA]/10 pb-2">
              <span className="text-[#EAEAEA]/50">{copy.marketLabel}</span>
              <span className="text-[#EAEAEA] font-semibold">{decisionContext.marketRegime}</span>
            </div>
            <div className="flex justify-between items-center border-b border-[#EAEAEA]/10 pb-2">
              <span className="text-[#EAEAEA]/50">{copy.riskLabel}</span>
              <span className={`font-semibold ${decisionContext.riskLevel.toLowerCase() === 'high' ? 'text-[#E61919]' : 'text-[#EAEAEA]'}`}>
                {decisionContext.riskLevel}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-[#EAEAEA]/10 pb-2">
              <span className="text-[#EAEAEA]/50">ACCESS</span>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 ${isPro ? 'bg-[#EAEAEA]' : 'bg-[#E61919]'} animate-pulse`}></span>
                <span className="text-[#EAEAEA] font-semibold">{isPro ? 'PRO.ACTIVE' : 'FREE.LIMITED'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Implication Bar */}
      <div className="telemetry-reveal mt-12 bg-[#050505] border border-[#EAEAEA]/20 p-4 font-mono flex flex-col md:flex-row gap-4 items-start md:items-center hover:bg-[#EAEAEA]/5 transition-colors duration-300">
        <span className="text-[#EAEAEA]/50 uppercase tracking-widest text-[10px] flex-shrink-0">
          {t('mainImplicationLabel', copy.language)} &gt;&gt;
        </span>
        <span className="text-[#EAEAEA] text-sm font-semibold">
          {decisionContext.mainImplication}
        </span>
      </div>
    </section>
  )
}
