'use client'
import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLanguagePreference } from '../utils/language'
import { useAuthSession } from '../utils/useAuthSession'
import { Helmet } from 'react-helmet-async'
gsap.registerPlugin(ScrollTrigger)

// ─── Design tokens ───────────────────────────────────────────────────────────
const T = {
  bg:      '#0b0d12',
  bg2:     '#080a0d',
  surface: '#0f1420',
  border:  'rgba(143,191,186,0.12)',
  borderDim: 'rgba(255,255,255,0.07)',
  teal:    '#8fbfba',
  gold:    '#d6b26b',
  text:    '#eef2f7',
  muted:   '#a7b0bf',
  dim:     'rgba(167,176,191,0.5)',
  mono:    "'JetBrains Mono','IBM Plex Mono',monospace",
  display: "'Archivo Black','Plus Jakarta Sans',sans-serif",
}

// ─── Feature data ────────────────────────────────────────────────────────────
const FEATURES = [
  {
    id: 'komando',
    tag: 'KOMANDO PAGI',
    headline: 'Briefing makro harian.\nSebelum pasar buka.',
    body: 'AI kami mencerna ratusan titik data makro semalaman — Fed Rate, DXY, COT positions, yield curve — dan menyampaikannya sebagai satu instruksi taktis di pagi hari. Bukan rangkuman berita. Bukan rekomendasi saham. Konteks untuk berpikir.',
    tag2: 'LIVE DAILY · 07.00 WIB',
    preview: {
      label: 'MARKET CONDITIONS — AUG 04, 2026',
      status: 'LOW RISK',
      statusColor: T.teal,
      headline: 'Today: conditions are calm, review without pressure.',
      sub: 'Conditions are still relatively stable',
      bar: 28,
      items: [
        { key: 'FED RATE', val: '3.50–3.75%', note: 'Hold — 5th consecutive' },
        { key: 'SEP CUT PROB', val: '72%', note: 'Markets pricing 25bp cut' },
        { key: 'FEAR & GREED', val: '48 · NEUTRAL', note: 'No panic signal' },
        { key: 'DXY', val: '99.80', note: '−0.14% · Soft Dollar' },
      ],
    },
  },
  {
    id: 'whale',
    tag: 'WHALE RADAR',
    headline: 'Baca posisi institusi.\nSebelum mereka bergerak.',
    body: 'Commodity Whale Radar membaca laporan CFTC (Commitments of Traders) mingguan. Anda bisa melihat apakah Hedge Fund sedang net-long atau memotong posisi pada emas, minyak, atau indeks — informasi yang selama ini hanya tersedia di terminal senilai ratusan juta rupiah per tahun.',
    tag2: 'SUMBER: CFTC · UPDATE TIAP JUMAT',
    preview: {
      label: 'COMMODITY WHALE RADAR — GC (Gold)',
      status: 'LIVE DATA',
      statusColor: '#4ade80',
      headline: 'Hedge Funds Net Long (Bullish) pada Gold (XAU)',
      sub: 'Net posisi spekulatif: +174.1K kontrak',
      bar: 82,
      items: [
        { key: 'HEDGE FUND LONG', val: '213.6K', note: 'Positions' },
        { key: 'HEDGE FUND SHORT', val: '39.4K', note: 'Positions' },
        { key: 'NET POSITION', val: '+174.1K', note: 'Net Long → Bullish' },
        { key: 'TOP 4 LONG', val: '15.6%', note: 'Open Interest' },
      ],
    },
  },
  {
    id: 'probability',
    tag: 'AI PROBABILITY',
    headline: 'Bukan prediksi.\nDistribusi probabilitas.',
    body: 'Sistem kami tidak menyebutkan "target harga" — karena tidak ada yang tahu pasti. Yang kami lakukan adalah menghitung distribusi skenario bullish vs bearish berdasarkan momentum historikal kuantitatif 1–2 minggu, lalu menampilkan angka probabilitasnya dengan jelas.',
    tag2: 'BASED ON HISTORICAL QUANTITATIVE ANALYSIS',
    preview: {
      label: 'AI PROBABILITY SCENARIOS — GC',
      status: 'MOMENTUM 68/100',
      statusColor: T.gold,
      headline: 'Bullish 53% vs Bearish 47%',
      sub: 'Based on 1-2W momentum & historikal data',
      bar: 53,
      items: [
        { key: 'BULLISH SCENARIO', val: '53%', note: 'Target 4,292 if support holds' },
        { key: 'BEARISH SCENARIO', val: '47%', note: 'Target 3,891 if breaks' },
        { key: 'MOMENTUM SCORE', val: '68/100', note: 'Very Hot' },
        { key: 'RANGE FLOOR', val: '3,985.60', note: 'vs Max 4,155.10' },
      ],
    },
  },
]

// ─── Terminal card (stable, no scroll-based transforms) ───────────────────────
function TerminalPreview({ data }: { data: typeof FEATURES[0]['preview'] }) {
  return (
    <div className="tl-card">
      <div className="tl-card__header">
        <span className="tl-card__label">{data.label}</span>
        <span className="tl-card__status" style={{ color: data.statusColor, borderColor: `${data.statusColor}44` }}>
          {data.status}
        </span>
      </div>
      <div className="tl-card__body">
        <div className="tl-card__headline">{data.headline}</div>
        <div className="tl-card__sub">{data.sub}</div>
        <div className="tl-card__bar">
          <div className="tl-card__bar-fill" style={{ width: `${data.bar}%`, background: `linear-gradient(90deg,${data.statusColor},${data.statusColor}55)` }} />
        </div>
        <div className="tl-card__grid">
          {data.items.map((item, i) => (
            <div key={i} className="tl-card__cell">
              <div className="tl-card__cell-key">{item.key}</div>
              <div className="tl-card__cell-val">{item.val}</div>
              <div className="tl-card__cell-note">{item.note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Feature showcase with GSAP (desktop only sticky, mobile stacked) ─────────
function FeatureShowcase() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (isMobile || !wrapRef.current) return
    const ctx = gsap.context(() => {
      FEATURES.forEach((_, i) => {
        ScrollTrigger.create({
          trigger: `#tl-feat-${i}`,
          start: 'top 55%',
          end: 'bottom 45%',
          onEnter: () => setActiveIdx(i),
          onEnterBack: () => setActiveIdx(i),
        })
      })
    }, wrapRef)
    return () => ctx.revert()
  }, [isMobile])

  return (
    <section className="tl-features" ref={wrapRef}>
      <div className="container-tl">
        <div className="tl-features__header">
          <div className="tl-eyebrow">[ FITUR UTAMA ]</div>
          <h2 className="tl-h2">
            Data yang selama ini<br />
            <span style={{ color: T.teal }}>hanya milik institusi.</span>
          </h2>
        </div>

        {isMobile ? (
          /* ── Mobile: stacked cards ── */
          <div className="tl-features__mobile">
            {FEATURES.map((f, i) => (
              <div key={f.id} className="tl-features__mobile-item">
                <div className="tl-eyebrow" style={{ marginBottom: 12 }}>[ {f.tag} ]</div>
                <h3 className="tl-h3" style={{ whiteSpace: 'pre-line', marginBottom: 16 }}>{f.headline}</h3>
                <p className="tl-body" style={{ marginBottom: 16 }}>{f.body}</p>
                <TerminalPreview data={f.preview} />
                <div style={{ fontFamily: T.mono, fontSize: 9, color: T.gold, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 16 }}>{f.tag2}</div>
              </div>
            ))}
          </div>
        ) : (
          /* ── Desktop: sticky left + scroll right ── */
          <div className="tl-features__desktop">
            <div className="tl-features__sticky">
              <TerminalPreview data={FEATURES[activeIdx].preview} />
              <div className="tl-features__dots">
                {FEATURES.map((_, i) => (
                  <div key={i} className="tl-features__dot" style={{ background: i === activeIdx ? T.teal : 'rgba(255,255,255,0.2)' }} />
                ))}
              </div>
            </div>
            <div className="tl-features__scroll">
              {FEATURES.map((f, i) => (
                <div key={f.id} id={`tl-feat-${i}`} className="tl-features__panel">
                  <div className="tl-eyebrow" style={{ color: i === activeIdx ? T.teal : T.dim }}> [ {f.tag} ]</div>
                  <h3 className="tl-h3" style={{ color: i === activeIdx ? T.text : T.muted, whiteSpace: 'pre-line' }}>{f.headline}</h3>
                  <p className="tl-body" style={{ color: i === activeIdx ? T.muted : 'rgba(167,176,191,0.35)', maxWidth: 420 }}>{f.body}</p>
                  <div style={{ fontFamily: T.mono, fontSize: 9, color: i === activeIdx ? T.gold : 'rgba(214,178,107,0.3)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{f.tag2}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Stats bar ─────────────────────────────────────────────────────────────────
function StatBar({ totalUsers }: { totalUsers: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })
  const STATS = [
    { label: 'INVESTOR TERDAFTAR', value: totalUsers > 0 ? totalUsers.toLocaleString('id-ID') : '1,200+' },
    { label: 'FITUR AKTIF', value: '12' },
    { label: 'DATA SOURCES', value: '8+' },
    { label: 'GROSS MARGIN TARGET', value: '85%' },
  ]
  return (
    <div ref={ref} className="tl-stats">
      {STATS.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: i * 0.1, duration: 0.5 }}
          className="tl-stats__item"
        >
          <div className="tl-stats__value">{s.value}</div>
          <div className="tl-stats__label">{s.label}</div>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Manifesto ticker ──────────────────────────────────────────────────────────
function ManifestoTicker() {
  const phrases = ['ANTI-GAMIFIKASI', 'ZERO CONFLICT OF INTEREST', 'WEALTH PRESERVATION', 'BUKAN SINYAL · TAPI KONTEKS', 'INSTITUTIONAL-GRADE DATA', 'ANTI-FOMO']
  const doubled = [...phrases, ...phrases]
  return (
    <div className="tl-ticker">
      <motion.div
        className="tl-ticker__track"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 35, repeat: Infinity, ease: 'linear' }}
      >
        {doubled.map((p, i) => (
          <span key={i} className="tl-ticker__item">
            {p}
            <span className="tl-ticker__dot" />
          </span>
        ))}
      </motion.div>
    </div>
  )
}

// ─── Comparison table ──────────────────────────────────────────────────────────
function ComparisonTable() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.1 })
  const rows = [
    { feature: 'Komando Pagi (AI Briefing)', ting: true, competitor: false, bloomberg: true },
    { feature: 'COT Whale Radar', ting: true, competitor: false, bloomberg: true },
    { feature: 'Probabilitas AI (Bullish/Bearish %)', ting: true, competitor: false, bloomberg: false },
    { feature: 'FOMC Calendar + Rate Probability', ting: true, competitor: false, bloomberg: true },
    { feature: 'Nol Conflict of Interest', ting: true, competitor: false, bloomberg: true },
    { feature: 'Decision Journal', ting: true, competitor: false, bloomberg: false },
    { feature: 'Harga / Bulan', ting: 'Rp 99K', competitor: 'Rp 150K+', bloomberg: 'Rp 40 Jt' },
  ]
  return (
    <section className="tl-compare">
      <div className="container-tl">
        <div className="tl-eyebrow">[ PERBANDINGAN ]</div>
        <h2 className="tl-h2" style={{ marginBottom: '3rem' }}>Posisi kami di pasar.</h2>
        <div ref={ref} className="tl-compare__table">
          <div className="tl-compare__head">
            {['FITUR', 'TING AI', 'APP BROKER', 'BLOOMBERG'].map((h, i) => (
              <div key={h} className="tl-compare__head-cell" style={{ color: i === 1 ? T.teal : T.dim }}>
                {h}
              </div>
            ))}
          </div>
          {rows.map((row, i) => (
            <motion.div
              key={row.feature}
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              className="tl-compare__row"
            >
              <div className="tl-compare__feature">{row.feature}</div>
              {([row.ting, row.competitor, row.bloomberg] as (boolean | string)[]).map((val, j) => (
                <div key={j} className="tl-compare__cell" style={{ background: j === 0 ? 'rgba(143,191,186,0.04)' : 'transparent' }}>
                  {typeof val === 'boolean'
                    ? val
                      ? <span style={{ color: T.teal, fontWeight: 700 }}>✓</span>
                      : <span style={{ color: 'rgba(255,255,255,0.18)' }}>—</span>
                    : <span style={{ color: j === 0 ? T.gold : T.muted }}>{val}</span>
                  }
                </div>
              ))}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA section ───────────────────────────────────────────────────────────────
function FinalCTA({ authenticated, language }: { authenticated: boolean; language: string }) {
  return (
    <section className="tl-cta">
      <div className="tl-cta__inner">
        <div className="tl-eyebrow">[ MULAI SEKARANG ]</div>
        <h2 className="tl-h2" style={{ marginBottom: '1.5rem' }}>
          Investasi bukan<br />
          <span style={{ color: T.teal }}>pertaruhan.</span>
        </h2>
        <p className="tl-body" style={{ maxWidth: 480, margin: '0 auto 3rem', textAlign: 'center' }}>
          Ting AI bukan aplikasi beli-jual saham. Kami adalah sistem intelijen yang membantu Anda berpikir lebih jernih sebelum bertindak.
        </p>
        <div className="tl-cta__btns">
          <Link to="/ting-ai" className="tl-btn tl-btn--primary">
            {language === 'id' ? 'Cek Portofolio' : 'Check Portfolio'} →
          </Link>
          <Link to={authenticated ? '/explore-intelligence' : '/login'} className="tl-btn tl-btn--outline">
            {language === 'id' ? 'Masuk Dashboard' : 'Dashboard'}
          </Link>
        </div>
        <div className="tl-cta__disclaimer">
          SEPENUHNYA BEBAS DARI REKOMENDASI BELI/JUAL · BUKAN KONSULTASI INVESTASI
        </div>
      </div>
    </section>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function TingAiLanding() {
  const { language } = useLanguagePreference()
  const { authenticated } = useAuthSession()
  const [stats, setStats] = useState({ totalUsers: 0, activePortfolioUsers: 0 })

  useEffect(() => {
    document.body.style.backgroundColor = T.bg
    return () => { document.body.style.backgroundColor = '' }
  }, [])

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(d => { if (d.ok) setStats({ totalUsers: d.totalUsers, activePortfolioUsers: d.activePortfolioUsers }) })
      .catch(() => {})
  }, [])

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Ting AI",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "99000",
      "priceCurrency": "IDR"
    },
    "description": "Sistem intelijen makro dan analitik portofolio berbasis AI untuk investor ritel Indonesia. Dilengkapi dengan Market Radar, AI Probability, dan Komando Pagi.",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "ratingCount": "500"
    }
  }

  return (
    <div className="tl-root">
      <Helmet>
        <title>Ting AI | Macro, Market & Wealth Intelligence Indonesia</title>
        <meta name="description" content="Ting AI adalah asisten analitik makro, saham, dan kripto. Dapatkan insight setara institusi melalui Komando Pagi, Whale Radar COT, dan AI Probabilitas." />
        <script type="application/ld+json">
          {JSON.stringify(schemaData)}
        </script>
      </Helmet>
      {/* ── Global styles ── */}
      <style>{`
        /* ─── Reset & Root ─── */
        .tl-root {
          background: ${T.bg};
          color: ${T.text};
          min-height: 100dvh;
          overflow-x: hidden;
          font-family: ${T.mono};
        }
        .container-tl {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 1.5rem;
        }
        /* ─── Typography ─── */
        .tl-eyebrow {
          font-family: ${T.mono};
          font-size: 9px;
          color: ${T.teal};
          letter-spacing: 0.22em;
          text-transform: uppercase;
          margin-bottom: 16px;
        }
        .tl-h1 {
          font-family: ${T.display};
          font-weight: 900;
          letter-spacing: -0.04em;
          line-height: 1.0;
          color: ${T.text};
          margin: 0 0 1.5rem;
          font-size: clamp(2.2rem, 6vw, 4rem);
        }
        .tl-h2 {
          font-family: ${T.display};
          font-weight: 900;
          letter-spacing: -0.03em;
          line-height: 1.05;
          color: ${T.text};
          margin: 0 0 1rem;
          font-size: clamp(1.8rem, 4vw, 3rem);
        }
        .tl-h3 {
          font-family: ${T.display};
          font-weight: 900;
          letter-spacing: -0.025em;
          line-height: 1.15;
          color: ${T.text};
          margin: 0 0 1rem;
          font-size: clamp(1.4rem, 3vw, 2rem);
          transition: color 0.3s ease;
        }
        .tl-body {
          font-family: ${T.mono};
          font-size: 13px;
          color: ${T.muted};
          line-height: 1.8;
          margin: 0 0 1rem;
          transition: color 0.3s ease;
        }
        /* ─── Navbar ─── */
        .tl-nav {
          position: sticky;
          top: 0;
          z-index: 50;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          background: rgba(11,13,18,0.9);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }
        .tl-nav__inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 1.5rem;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .tl-nav__brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .tl-nav__wordmark {
          font-family: ${T.display};
          font-weight: 900;
          font-size: 15px;
          letter-spacing: -0.02em;
          color: ${T.text};
        }
        .tl-nav__sub {
          font-family: ${T.mono};
          font-size: 8px;
          color: ${T.dim};
          letter-spacing: 0.12em;
          text-transform: uppercase;
          display: none;
        }
        @media (min-width: 640px) {
          .tl-nav__sub { display: block; }
        }
        .tl-nav__link {
          font-family: ${T.mono};
          font-size: 11px;
          color: ${T.teal};
          text-decoration: none;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        /* ─── Hero ─── */
        .tl-hero {
          padding: clamp(48px, 8vh, 100px) 1.5rem clamp(40px, 6vh, 80px);
          max-width: 1200px;
          margin: 0 auto;
        }
        .tl-hero__grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 48px;
          align-items: center;
        }
        @media (min-width: 900px) {
          .tl-hero__grid {
            grid-template-columns: 1fr 1fr;
            gap: 64px;
          }
        }
        .tl-hero__right {
          display: none;
        }
        @media (min-width: 900px) {
          .tl-hero__right {
            display: block;
          }
        }
        .tl-hero__badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: ${T.mono};
          font-size: 9px;
          color: ${T.teal};
          letter-spacing: 0.22em;
          text-transform: uppercase;
          border: 1px solid rgba(143,191,186,0.2);
          padding: 6px 14px;
          margin-bottom: 28px;
        }
        .tl-hero__pulse {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: ${T.teal};
          animation: tlPulse 2s infinite;
          flex-shrink: 0;
        }
        .tl-hero__btns {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 2rem;
        }
        .tl-hero__stat {
          margin-top: 2rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .tl-hero__stat-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4ade80;
          animation: tlPulse 2s infinite;
          flex-shrink: 0;
        }
        .tl-hero__disclaimer {
          margin-top: 1.25rem;
          font-family: ${T.mono};
          font-size: 8px;
          color: rgba(167,176,191,0.35);
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        /* ─── Buttons ─── */
        .tl-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: ${T.mono};
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          text-decoration: none;
          padding: 13px 28px;
          transition: opacity 0.2s, border-color 0.2s;
          cursor: pointer;
          white-space: nowrap;
        }
        .tl-btn--primary {
          background: ${T.teal};
          color: #0b0d12;
          border: 1px solid ${T.teal};
        }
        .tl-btn--primary:hover { opacity: 0.88; }
        .tl-btn--outline {
          background: transparent;
          color: ${T.text};
          border: 1px solid rgba(255,255,255,0.15);
        }
        .tl-btn--outline:hover { border-color: ${T.teal}; color: ${T.teal}; }
        /* ─── Terminal card ─── */
        .tl-card {
          background: #0a0c10;
          border: 1px solid rgba(143,191,186,0.2);
          overflow: hidden;
          font-family: ${T.mono};
        }
        .tl-card__header {
          padding: 10px 18px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #080a0d;
          gap: 8px;
          flex-wrap: wrap;
        }
        .tl-card__label {
          font-size: 9px;
          color: ${T.muted};
          letter-spacing: 0.15em;
          text-transform: uppercase;
          flex-shrink: 0;
        }
        .tl-card__status {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          border: 1px solid;
          padding: 2px 8px;
          flex-shrink: 0;
        }
        .tl-card__body {
          padding: 18px;
        }
        .tl-card__headline {
          font-family: ${T.display};
          font-size: clamp(14px, 2vw, 16px);
          font-weight: 900;
          color: ${T.text};
          margin-bottom: 4px;
          letter-spacing: -0.02em;
          line-height: 1.3;
        }
        .tl-card__sub {
          font-size: 11px;
          color: ${T.muted};
          margin-bottom: 14px;
        }
        .tl-card__bar {
          height: 2px;
          background: rgba(255,255,255,0.08);
          margin-bottom: 16px;
        }
        .tl-card__bar-fill {
          height: 100%;
          transition: width 1s ease;
        }
        .tl-card__grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          background: rgba(255,255,255,0.05);
        }
        .tl-card__cell {
          background: #0a0c10;
          padding: 10px 12px;
        }
        .tl-card__cell-key {
          font-size: 8px;
          color: ${T.dim};
          text-transform: uppercase;
          letter-spacing: 0.15em;
          margin-bottom: 3px;
        }
        .tl-card__cell-val {
          font-size: clamp(13px, 2vw, 15px);
          color: ${T.text};
          font-weight: 700;
          margin-bottom: 2px;
        }
        .tl-card__cell-note {
          font-size: 8px;
          color: ${T.dim};
        }
        /* ─── Divider ─── */
        .tl-divider {
          height: 1px;
          background: linear-gradient(90deg,transparent,rgba(143,191,186,0.3),transparent);
          max-width: 1200px;
          margin: 0 auto;
        }
        /* ─── Ticker ─── */
        .tl-ticker {
          overflow: hidden;
          border-top: 1px solid rgba(255,255,255,0.07);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          padding: 16px 0;
          background: rgba(143,191,186,0.02);
        }
        .tl-ticker__track {
          display: flex;
          gap: 40px;
          white-space: nowrap;
          width: max-content;
        }
        .tl-ticker__item {
          font-family: ${T.mono};
          font-size: 10px;
          color: ${T.teal};
          letter-spacing: 0.2em;
          text-transform: uppercase;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .tl-ticker__dot {
          display: inline-block;
          width: 5px;
          height: 5px;
          background: ${T.gold};
          border-radius: 50%;
          flex-shrink: 0;
        }
        /* ─── Stats bar ─── */
        .tl-stats {
          border-top: 1px solid rgba(255,255,255,0.07);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          display: grid;
          grid-template-columns: repeat(2, 1fr);
        }
        @media (min-width: 640px) {
          .tl-stats {
            grid-template-columns: repeat(4, 1fr);
          }
        }
        .tl-stats__item {
          padding: 32px 24px;
          border-right: 1px solid rgba(255,255,255,0.07);
        }
        .tl-stats__item:last-child { border-right: none; }
        .tl-stats__item:nth-child(2n) {
          border-right: none;
        }
        @media (min-width: 640px) {
          .tl-stats__item:nth-child(2n) {
            border-right: 1px solid rgba(255,255,255,0.07);
          }
          .tl-stats__item:last-child { border-right: none; }
        }
        .tl-stats__value {
          font-family: ${T.display};
          font-size: clamp(1.8rem, 4vw, 2.8rem);
          font-weight: 900;
          color: ${T.text};
          margin-bottom: 6px;
          line-height: 1;
        }
        .tl-stats__label {
          font-family: ${T.mono};
          font-size: 8px;
          color: ${T.dim};
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }
        /* ─── Features ─── */
        .tl-features {
          padding: 80px 0 100px;
        }
        .tl-features__header {
          margin-bottom: 64px;
        }
        .tl-features__desktop {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 80px;
          align-items: start;
        }
        .tl-features__sticky {
          position: sticky;
          top: 80px;
        }
        .tl-features__dots {
          display: flex;
          gap: 8px;
          margin-top: 16px;
          justify-content: center;
        }
        .tl-features__dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          transition: background 0.3s ease;
        }
        .tl-features__scroll {
          display: flex;
          flex-direction: column;
          gap: 100px;
        }
        .tl-features__panel {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .tl-features__panel .tl-eyebrow {
          transition: color 0.3s ease;
        }
        .tl-features__mobile {
          display: flex;
          flex-direction: column;
          gap: 56px;
        }
        .tl-features__mobile-item {
          border-top: 1px solid rgba(255,255,255,0.07);
          padding-top: 32px;
        }
        /* ─── Comparison ─── */
        .tl-compare {
          background: ${T.bg2};
          border-top: 1px solid rgba(255,255,255,0.07);
          padding: 80px 0;
        }
        .tl-compare__table {
          border: 1px solid rgba(255,255,255,0.07);
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .tl-compare__head {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          background: ${T.bg2};
          border-bottom: 1px solid rgba(255,255,255,0.07);
          min-width: 480px;
        }
        .tl-compare__head-cell {
          padding: 12px 16px;
          font-family: ${T.mono};
          font-size: 9px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          border-left: 1px solid rgba(255,255,255,0.07);
        }
        .tl-compare__head-cell:first-child { border-left: none; }
        .tl-compare__row {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          min-width: 480px;
        }
        .tl-compare__row:last-child { border-bottom: none; }
        .tl-compare__feature {
          padding: 14px 16px;
          font-family: ${T.mono};
          font-size: 11px;
          color: ${T.muted};
        }
        .tl-compare__cell {
          padding: 14px 16px;
          font-family: ${T.mono};
          font-size: 12px;
          border-left: 1px solid rgba(255,255,255,0.07);
        }
        /* ─── CTA ─── */
        .tl-cta {
          background: ${T.bg2};
          border-top: 1px solid rgba(143,191,186,0.15);
          padding: 100px 1.5rem;
          text-align: center;
        }
        .tl-cta__inner {
          max-width: 680px;
          margin: 0 auto;
        }
        .tl-cta__btns {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 2.5rem;
        }
        .tl-cta__disclaimer {
          font-family: ${T.mono};
          font-size: 8px;
          color: rgba(167,176,191,0.3);
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        /* ─── Footer ─── */
        .tl-footer {
          border-top: 1px solid rgba(255,255,255,0.07);
          padding: 32px 1.5rem;
        }
        .tl-footer__inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }
        .tl-footer__brand {
          font-family: ${T.display};
          font-weight: 900;
          font-size: 13px;
          letter-spacing: -0.02em;
          color: ${T.muted};
        }
        .tl-footer__copy {
          font-family: ${T.mono};
          font-size: 8px;
          color: rgba(167,176,191,0.3);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          text-align: right;
        }
        /* ─── Logo icon ─── */
        .tl-logo {
          width: 22px;
          height: 22px;
          flex-shrink: 0;
        }
        /* ─── Animation ─── */
        @keyframes tlPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        /* ─── Prevent CLS on framer motion ─── */
        .tl-root * { will-change: auto; }
      `}</style>

      {/* ── Navbar ── */}
      <nav className="tl-nav">
        <div className="tl-nav__inner">
          <div className="tl-nav__brand">
            <svg className="tl-logo" viewBox="0 0 22 22" fill="none">
              <rect x="9" y="0" width="4" height="22" fill={T.teal} />
              <rect x="0" y="9" width="22" height="4" fill={T.teal} />
            </svg>
            <span className="tl-nav__wordmark">TING AI</span>
            <span className="tl-nav__sub">MACRO & WEALTH INTELLIGENCE</span>
          </div>
          {authenticated
            ? <Link to="/explore-intelligence" className="tl-nav__link">Dashboard →</Link>
            : <Link to="/login" className="tl-nav__link" style={{ color: T.muted }}>Login</Link>
          }
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className="tl-hero">
        <div className="tl-hero__grid">
          {/* Left: copy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="tl-hero__badge">
              <span className="tl-hero__pulse" />
              TING AI · THINKING PARTNER
            </div>
            <h1 className="tl-h1">
              Bukan memberi sinyal,<br />
              <span style={{ color: T.teal }}>tapi menyadarkan</span><br />
              realita.
            </h1>
            <p className="tl-body" style={{ maxWidth: 460 }}>
              Trading tanpa membedah risiko adalah judi. Ting AI dirancang sebagai teman diskusi agar kamu bisa membaca konteks pasar dan kelemahan portofoliomu sendiri sebelum bertindak.
            </p>
            <div className="tl-hero__btns">
              <Link to="/ting-ai" className="tl-btn tl-btn--primary">
                {language === 'id' ? 'Cek Portofolio' : 'Check Portfolio'} →
              </Link>
              <Link to={authenticated ? '/explore-intelligence' : '/login'} className="tl-btn tl-btn--outline">
                {language === 'id' ? 'Masuk Dashboard' : 'Dashboard'}
              </Link>
            </div>
            {stats.totalUsers > 0 && (
              <div className="tl-hero__stat">
                <span className="tl-hero__stat-dot" />
                <span style={{ fontFamily: T.mono, fontSize: 10, color: T.dim }}>
                  <span style={{ color: T.text, fontWeight: 700 }}>{stats.totalUsers.toLocaleString('id-ID')}</span>
                  {' '}{language === 'id' ? 'investor terdaftar' : 'registered investors'}
                </span>
              </div>
            )}
            <div className="tl-hero__disclaimer">
              SEPENUHNYA BEBAS DARI REKOMENDASI BELI/JUAL.
            </div>
          </motion.div>

          {/* Right: terminal preview (desktop only via CSS) */}
          <motion.div
            className="tl-hero__right"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <TerminalPreview data={FEATURES[0].preview} />
          </motion.div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="tl-divider" />

      {/* ── Manifesto Ticker ── */}
      <ManifestoTicker />

      {/* ── Stats ── */}
      <StatBar totalUsers={stats.totalUsers} />

      {/* ── Feature Showcase ── */}
      <FeatureShowcase />

      {/* ── Comparison ── */}
      <ComparisonTable />

      {/* ── CTA ── */}
      <FinalCTA authenticated={authenticated} language={language} />

      {/* ── Footer ── */}
      <footer className="tl-footer">
        <div className="tl-footer__inner">
          <div className="tl-footer__brand">TING AI</div>
          <div className="tl-footer__copy">
            © {new Date().getFullYear()} · Designed to help you think.<br />Not to tell you what to do.
          </div>
        </div>
      </footer>
    </div>
  )
}
