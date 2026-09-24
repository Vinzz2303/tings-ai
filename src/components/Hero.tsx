import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useLanguagePreference } from '../utils/language'

const statusMessages = [
  "BUILDING_TING_AI...",
  "OPEN_SOURCE_CONTRIBUTOR",
  "FULL_STACK_DEVELOPER",
  "AI_SYSTEMS_ARCHITECT",
  "SHIPPING_TO_PRODUCTION",
]

export default function Hero({ sectionId }: { sectionId: string }) {
  const { language } = useLanguagePreference()
  const navigate = useNavigate()
  const [msgIdx, setMsgIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % statusMessages.length), 3200)
    return () => clearInterval(t)
  }, [])

  const isEn = language === 'en'

  return (
    <section
      id={sectionId}
      className="relative min-h-screen flex flex-col justify-center pt-24 pb-12 overflow-hidden"
    >
      {/* Subtle top line accent */}
      <div className="absolute top-0 inset-x-0 h-px bg-white/[0.06]" />

      <div className="container-saas relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-12 md:gap-20 items-center">

          {/* ── Left: Copy ───────────────────────────────────── */}
          <div className="max-w-2xl order-last md:order-first flex flex-col items-center md:items-start text-center md:text-left">

            {/* Status pill */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-10 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.03]"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <AnimatePresence mode="wait">
                <motion.span
                  key={statusMessages[msgIdx]}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="text-[10px] font-mono tracking-[0.18em] text-white/40 uppercase"
                >
                  {statusMessages[msgIdx]}
                </motion.span>
              </AnimatePresence>
            </motion.div>

            {/* Headline — typography-first, no gradient text */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="text-5xl md:text-6xl lg:text-[4.5rem] font-black tracking-[-0.02em] leading-[1.05] text-white mb-6"
            >
              {isEn ? (
                <>
                  I build<br />
                  <span className="text-[var(--accent)]">intelligence</span>
                  <br />into products.
                </>
              ) : (
                <>
                  Membangun<br />
                  <span className="text-[var(--accent)]">kecerdasan</span>
                  <br />ke dalam produk.
                </>
              )}
            </motion.h1>

            {/* Subtext */}
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="text-base md:text-lg text-white/40 max-w-md leading-relaxed mb-10"
            >
              {isEn
                ? 'AI Specialist & Full-Stack Architect. Building intelligence layers and production-ready AI systems. Creator of Ting AI.'
                : 'AI Specialist & Full-Stack Architect. Membangun sistem AI dan LLM berskala produksi. Pencipta Ting AI.'}
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.36 }}
              className="flex flex-wrap gap-3 mb-14"
            >
              <button
                type="button"
                onClick={() => window.open('https://tingsai.my.id', '_blank')}
                className="px-6 py-2.5 bg-white text-[#07090d] font-bold rounded-lg text-sm hover:bg-white/90 transition-colors w-full md:w-auto"
              >
                {isEn ? 'Explore Ting AI' : 'Jelajahi Ting AI'} →
              </button>
              <a
                href="#projects"
                className="px-6 py-2.5 rounded-lg border border-white/[0.1] text-white/60 hover:text-white hover:border-white/20 transition-all text-sm font-medium w-full md:w-auto"
              >
                {isEn ? 'View Work' : 'Lihat Karya'}
              </a>
              <a
                href="https://github.com/Vinzz2303"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 rounded-lg border border-white/[0.08] text-white/35 hover:text-white/60 hover:border-white/15 transition-all flex items-center gap-1.5 text-sm"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub
              </a>
            </motion.div>

            {/* Stats strip — concrete results, not storytelling */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="flex flex-wrap items-center gap-6 border-t border-white/[0.06] pt-8"
            >
              {[
                { value: "500+", label: isEn ? "Users on Ting AI" : "Pengguna Ting AI" },
                { value: "99.9%", label: isEn ? "Platform Uptime" : "Uptime Platform" },
                { value: "<200ms", label: isEn ? "API Response" : "Respons API" },
                { value: "3 Yrs", label: isEn ? "Production Shipped" : "Produk Live" },
              ].map((s, i) => (
                <div key={i}>
                  <div className="text-xl font-black text-white tabular-nums">{s.value}</div>
                  <div className="text-[10px] font-mono text-white/25 uppercase tracking-widest mt-0.5">{s.label}</div>
                </div>
              ))}
            </motion.div>

          </div>

          {/* ── Right: Profile Photo (editorial frame) ──────── */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="block shrink-0 order-first md:order-last flex justify-center md:justify-end w-full md:w-auto"
          >
            <div className="relative w-[220px] md:w-[260px]">
              {/* Offset shadow frame */}
              <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/[0.03]" />

              {/* Photo frame */}
              <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#111318]">
                <img
                  src="/fatur-hero-new.png"
                  alt="Faturachman Alkahfi"
                  className="w-full aspect-[3/4] object-cover object-top"
                  loading="eager"
                />
                {/* Subtle bottom gradient overlay */}
                <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-[#07090d]/80 to-transparent" />

                {/* Name card overlay */}
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="text-sm font-bold text-white/90 leading-tight">Faturachman Alkahfi</div>
                  <div className="text-[11px] text-white/40 font-mono mt-0.5 uppercase tracking-wider">AI Builder · Jakarta</div>
                </div>
              </div>

              {/* Floating status badge */}
              <div className="absolute -top-3 -right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111318] border border-white/[0.08] shadow-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-mono text-white/50 uppercase tracking-wider">Open to work</span>
              </div>
            </div>
          </motion.div>

        </div>
      </div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10"
      >
        <span className="text-[9px] font-mono text-white/15 uppercase tracking-widest">Scroll</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-px h-7 bg-gradient-to-b from-white/15 to-transparent"
        />
      </motion.div>
    </section>
  )
}
