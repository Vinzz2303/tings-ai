/**
 * OnboardingModal.tsx — Welcome Flow v2
 * Ditampilkan SEKALI setelah user login pertama kali ke /komando-pagi.
 * 3 langkah: Portfolio → Morning Command → Decision Journal
 * Bilingual (ID/EN). Tidak muncul lagi setelah dismissed.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguagePreference } from '../utils/language'
import { useAuthSession } from '../utils/useAuthSession'

const ONBOARDING_KEY = 'tingsai_onboarding_done'

const copy = {
  id: {
    skip: 'Lewati',
    next: 'Lanjut',
    done: 'Mulai Eksplorasi →',
    stepOf: (current: number, total: number) => `${current} dari ${total}`,
    steps: [
      {
        emoji: '💼',
        color: '#14b8a6',
        colorBg: 'rgba(20,184,166,0.08)',
        colorBorder: 'rgba(20,184,166,0.2)',
        title: 'Tambahkan aset portofolio Anda',
        desc: 'Ting AI butuh konteks portofolio Anda untuk bekerja. Tambahkan aset (saham, kripto, emas) di Portfolio Workspace agar semua fitur AI bisa membaca kondisi Anda secara akurat.',
        cta: 'Buka Portfolio',
        ctaPath: '/portfolio',
      },
      {
        emoji: '🧠',
        color: '#fbbf24',
        colorBg: 'rgba(251,191,36,0.08)',
        colorBorder: 'rgba(251,191,36,0.2)',
        title: 'Baca Komando Pagi setiap hari',
        desc: 'Setiap pagi, Ting AI menyajikan briefing singkat: status risiko pasar, kondisi portofolio Anda, dan sinyal berita — semua dalam satu layar, tanpa perlu scroll.',
        cta: 'Lihat Briefing',
        ctaPath: '/komando-pagi',
      },
      {
        emoji: '📓',
        color: '#a78bfa',
        colorBg: 'rgba(167,139,250,0.08)',
        colorBorder: 'rgba(167,139,250,0.2)',
        title: 'Catat keputusan sebelum bertransaksi',
        desc: 'Sebelum klik Buy atau Sell di aplikasi broker, tulis alasannya di Decision Journal. AI akan otomatis memberi peringatan jika aset tersebut melanggar batas risiko yang Anda tetapkan.',
        cta: 'Buka Jurnal',
        ctaPath: '/decision-journal',
      },
    ],
  },
  en: {
    skip: 'Skip',
    next: 'Next',
    done: 'Start Exploring →',
    stepOf: (current: number, total: number) => `${current} of ${total}`,
    steps: [
      {
        emoji: '💼',
        color: '#14b8a6',
        colorBg: 'rgba(20,184,166,0.08)',
        colorBorder: 'rgba(20,184,166,0.2)',
        title: 'Add your portfolio assets',
        desc: 'Ting AI needs your portfolio context to work properly. Add your assets (stocks, crypto, gold) in the Portfolio Workspace so the AI can accurately assess your position.',
        cta: 'Open Portfolio',
        ctaPath: '/portfolio',
      },
      {
        emoji: '🧠',
        color: '#fbbf24',
        colorBg: 'rgba(251,191,36,0.08)',
        colorBorder: 'rgba(251,191,36,0.2)',
        title: 'Read the Morning Command every day',
        desc: 'Each morning, Ting AI delivers a quick brief: market risk status, your portfolio condition, and news signals — all in one screen, no scrolling needed.',
        cta: 'See Briefing',
        ctaPath: '/komando-pagi',
      },
      {
        emoji: '📓',
        color: '#a78bfa',
        colorBg: 'rgba(167,139,250,0.08)',
        colorBorder: 'rgba(167,139,250,0.2)',
        title: 'Log decisions before you trade',
        desc: 'Before hitting Buy or Sell in your broker app, write down your reasoning in the Decision Journal. The AI will automatically warn you if the asset violates your risk budget.',
        cta: 'Open Journal',
        ctaPath: '/decision-journal',
      },
    ],
  },
}

export default function OnboardingModal() {
  const { language } = useLanguagePreference()
  const { user } = useAuthSession()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState(0)
  const lang = copy[language]
  const currentStep = lang.steps[step]
  const totalSteps = lang.steps.length

  useEffect(() => {
    const seen = localStorage.getItem(ONBOARDING_KEY)
    if (!seen) {
      // Small delay so the page loads first before modal appears
      const timer = setTimeout(() => setIsOpen(true), 900)
      return () => clearTimeout(timer)
    }
  }, [])

  const dismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setIsOpen(false)
  }

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(s => s + 1)
    } else {
      dismiss()
    }
  }

  const handleCtaClick = () => {
    dismiss()
    navigate(currentStep.ctaPath)
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        key="onboarding-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
        style={{ background: 'rgba(7,9,14,0.85)', backdropFilter: 'blur(6px)' }}
        onClick={(e) => { if (e.target === e.currentTarget) dismiss() }}
      >
        <motion.div
          key="onboarding-panel"
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm rounded-2xl border border-white/[0.08] overflow-hidden"
          style={{ background: '#0d1117' }}
        >
          {/* Progress bar */}
          <div className="h-[2px] bg-white/[0.04] w-full">
            <motion.div
              className="h-full"
              style={{ background: currentStep.color }}
              initial={{ width: `${(step / totalSteps) * 100}%` }}
              animate={{ width: `${((step + 1) / totalSteps) * 100}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>

          {/* Step counter */}
          <div className="flex items-center justify-between px-5 pt-4">
            <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">
              {lang.stepOf(step + 1, totalSteps)}
            </span>
            <button
              type="button"
              onClick={dismiss}
              className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
            >
              {lang.skip}
            </button>
          </div>

          {/* Step content — animated swap */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="px-5 py-5 space-y-4"
            >
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl border"
                style={{ background: currentStep.colorBg, borderColor: currentStep.colorBorder }}
              >
                {currentStep.emoji}
              </div>

              {/* Greeting on step 0 */}
              {step === 0 && user?.fullname && (
                <p className="text-[11px] text-slate-500">
                  {language === 'id' ? `Hei, ${user.fullname.split(' ')[0]}! 👋` : `Hey, ${user.fullname.split(' ')[0]}! 👋`}
                </p>
              )}

              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white leading-snug">
                  {currentStep.title}
                </h3>
                <p className="text-slate-400 text-[13px]" style={{ lineHeight: '1.6' }}>
                  {currentStep.desc}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-1.5 pb-2">
            {lang.steps.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStep(i)}
                className="transition-all duration-200"
                style={{
                  width: i === step ? 20 : 6,
                  height: 4,
                  borderRadius: 9999,
                  background: i === step ? currentStep.color : 'rgba(255,255,255,0.1)',
                }}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex items-center gap-2 px-5 pb-5 pt-2">
            <button
              type="button"
              onClick={handleCtaClick}
              className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold border transition-all hover:opacity-90"
              style={{
                background: currentStep.colorBg,
                borderColor: currentStep.colorBorder,
                color: currentStep.color,
              }}
            >
              {currentStep.cta}
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 py-2.5 rounded-xl text-[12px] font-bold text-white transition-all hover:opacity-90"
              style={{ background: currentStep.color }}
            >
              {step === totalSteps - 1 ? lang.done : lang.next}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
