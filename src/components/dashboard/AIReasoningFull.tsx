'use client'

import React, { useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { t } from './dashboardI18n'
import type { DashboardCopy, DecisionContext } from './types'

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

type Props = {
  copy: DashboardCopy
  decisionContext: DecisionContext
}

export default function AIReasoningFull({ copy, decisionContext }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  const situationText =
    decisionContext.marketRegimeKey === 'defensive'
      ? t('aiFull_situation_defensive', copy.language)
      : decisionContext.marketRegimeKey === 'risk_on'
        ? t('aiFull_situation_risk_on', copy.language)
        : t('aiFull_situation_neutral', copy.language)

  const myConditionText =
    decisionContext.fitLevel === 'good_fit'
      ? t('aiFull_condition_good', copy.language, { userStatus: decisionContext.userStatus })
      : decisionContext.fitLevel === 'moderate_fit'
        ? t('aiFull_condition_moderate', copy.language, { userStatus: decisionContext.userStatus })
        : t('aiFull_condition_weak', copy.language, { userStatus: decisionContext.userStatus })

  const watchText =
    decisionContext.concentrationRisk ||
    (decisionContext.fitLevel === 'good_fit'
      ? t('aiFull_watch_good', copy.language)
      : decisionContext.fitLevel === 'moderate_fit'
        ? t('aiFull_watch_moderate', copy.language)
        : t('aiFull_watch_weak', copy.language))

  const cards = [
    { label: t('situationLabel', copy.language), title: 'MARKET POSTURE', text: situationText, id: '01' },
    { label: t('myConditionLabel', copy.language), title: 'PORTFOLIO STRESS', text: myConditionText, id: '02' },
    { label: t('implicationLabel', copy.language), title: 'AI DIRECTIVE', text: decisionContext.reasoningImplication, id: '03' },
    { label: copy.whatToWatch, title: 'SURVEILLANCE', text: watchText, id: '04' }
  ]

  useGSAP(() => {
    const cardEls = gsap.utils.toArray<HTMLElement>('.stack-card')
    
    // Refresh ScrollTrigger to ensure correct heights
    ScrollTrigger.refresh()

    cardEls.forEach((card, i) => {
      if (i === cardEls.length - 1) return
      ScrollTrigger.create({
        trigger: card,
        start: 'top top',
        endTrigger: cardEls[cardEls.length - 1],
        end: 'top top',
        pin: true,
        pinSpacing: false
      })
      gsap.to(card, {
        scale: 0.92,
        opacity: 0.1,
        ease: 'none',
        scrollTrigger: {
          trigger: cardEls[i + 1],
          start: 'top bottom',
          end: 'top top',
          scrub: true
        }
      })
    })

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill())
    }
  }, { scope: containerRef })

  return (
    <section ref={containerRef} className="w-full max-w-7xl mx-auto py-32 relative" id="ai-reasoning-full">
      <div className="flex items-center gap-4 mb-24">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tighter uppercase text-[#EAEAEA]" style={{ fontFamily: '"Cabinet Grotesk", "Archivo Black", "Inter", sans-serif' }}>
          {copy.aiReasoning}
        </h2>
        <div className="flex-1 h-px bg-[#E61919]"></div>
        <span className="font-mono text-[10px] text-[#EAEAEA]/50 uppercase tracking-widest hidden md:block">
          UNIT // REASONING-02
        </span>
      </div>

      <div className="relative">
        {cards.map((card, i) => (
          <div
            key={card.id}
            className="stack-card sticky top-0 min-h-[100dvh] flex items-center justify-center bg-[#050505] pt-12 md:pt-0"
          >
            {/* Background Texture for each card */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
                style={{
                  backgroundImage: 'radial-gradient(#EAEAEA 1px, transparent 1px)',
                  backgroundSize: '20px 20px'
                }}
            />

            <div className="w-full border border-[#EAEAEA]/20 bg-[#0A0A0A] p-8 md:p-16 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 font-mono text-[10px] text-[#EAEAEA]/30">
                SEQ. {card.id}
              </div>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-[#E61919]/20 group-hover:bg-[#E61919] transition-colors duration-500"></div>

              <div className="max-w-4xl">
                <span className="font-mono text-[10px] text-[#EAEAEA]/50 uppercase tracking-widest mb-4 block">
                  {card.label}
                </span>
                
                <h3 className="text-4xl md:text-6xl font-bold tracking-tighter uppercase text-[#EAEAEA] mb-8 leading-[0.9]" style={{ fontFamily: '"Cabinet Grotesk", "Archivo Black", "Inter", sans-serif' }}>
                  {card.title}
                </h3>
                
                <p className="font-mono text-lg md:text-2xl text-[#EAEAEA]/80 leading-relaxed max-w-3xl">
                  {card.text}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
