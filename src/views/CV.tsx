import React from 'react'
import { useNavigate } from 'react-router-dom'

const PRINT_STYLE = `
@media print {
  @page { margin: 12mm 14mm; size: A4; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body, html { margin: 0; padding: 0; background: #fff !important; }
  .no-print { display: none !important; }
  .cv-wrap { padding: 0 !important; }
}
`

export default function CV() {
  const navigate = useNavigate()

  React.useEffect(() => {
    const tag = document.createElement('style')
    tag.innerHTML = PRINT_STYLE
    document.head.appendChild(tag)
    return () => { document.head.removeChild(tag) }
  }, [])

  return (
    <div className="cv-wrap" style={{ minHeight: '100vh', background: '#f0f0ec', padding: '24px 16px', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}>

      {/* Action bar */}
      <div className="no-print" style={{ maxWidth: 794, margin: '0 auto 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Back to Portfolio
        </button>
        <button
          onClick={() => window.print()}
          style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
          Download / Print PDF
        </button>
      </div>

      {/* CV Paper */}
      <div style={{ maxWidth: 794, margin: '0 auto', background: '#fff', boxShadow: '0 4px 32px rgba(0,0,0,0.10)', borderRadius: 12, overflow: 'hidden' }}>

        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <div style={{ background: '#111', color: '#fff', padding: '20px 28px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
            {/* Left: name + title + summary */}
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1.1 }}>Faturachman Alkahfi</div>
              <div style={{ color: '#25d0c3', fontWeight: 700, fontSize: 13, marginTop: 3 }}>Full-Stack Engineer &amp; AI Product Builder</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 6, lineHeight: 1.5, maxWidth: 380 }}>
                3+ years building AI-integrated products from design to production. Shipped Ting AI (500+ users) and enterprise systems serving 3,000+ academic users — solo and on contract.
              </div>
            </div>
            {/* Right: contact */}
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 2 }}>
              <span>✉ faturachman.dev@gmail.com</span>
              <span>📍 Jakarta, Indonesia</span>
              <a href="https://faturachman.my.id" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>🌐 faturachman.my.id</a>
              <a href="https://tingsai.my.id" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>🌐 tingsai.my.id</a>
              <a href="https://github.com/Vinzz2303" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>⌥ github.com/Vinzz2303</a>
            </div>
          </div>

          {/* Metrics strip */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 14, paddingTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, textAlign: 'center' }}>
            {[
              { v: '500+', l: 'Ting AI Users' },
              { v: '3,000+', l: 'Students Served' },
              { v: '99.9%', l: 'Uptime' },
              { v: '<200ms', l: 'API Response' },
            ].map(m => (
              <div key={m.l}>
                <div style={{ color: '#25d0c3', fontWeight: 900, fontSize: 16 }}>{m.v}</div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{m.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── BODY ───────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 190px', gap: 0 }}>

          {/* ── LEFT ─────────────────────────────────────────────────── */}
          <div style={{ padding: '16px 20px 16px 28px', borderRight: '1px solid #f0f0f0' }}>

            <Section title="Work Experience">
              <Job
                title="Founder & Full-Stack Engineer"
                co="Ting AI — Market Intelligence SaaS"
                coColor="#25d0c3"
                period="Mar 2026 – Present · Jakarta"
                bullets={[
                  'Built entire platform solo in 4 months: auth (Supabase), Pro subscription gate, 6+ analytics modules (Whale Tracker, AI Forecast, Komando Pagi)',
                  'Yahoo Finance & FMP real-time integration; avg API response <200ms under concurrent load; 99.9% uptime on Windows VPS/IIS + PM2',
                  'Grew to 500+ registered users organically — zero paid acquisition — within 3 months of launch',
                ]}
              />
              <Job
                title="Full-Stack Developer (Contract)"
                co="Universitas Primagraha — upg.ac.id"
                coColor="#f59e0b"
                period="2024 – 2025 · Banten"
                bullets={[
                  'Built academic portal ecosystem for 3,000+ students: main portal, library OPAC, and online CBT exam platform — all production-grade on IIS',
                  '99%+ uptime since launch; zero downtime during peak exam periods',
                ]}
              />
              <Job
                title="Full-Stack Developer"
                co="Central Jual Emas — Gold Trading Platform"
                coColor="#4ea8de"
                period="Feb 2026 – Present · Remote"
                bullets={[
                  'Shipped responsive gold trading UI with real-time pricing engine — from Figma to production in 3 weeks, page load <1.5s',
                ]}
              />
            </Section>

            <Section title="Open Source Contributions">
              <Job
                title="Contributor"
                co="Tscircuit · Archestra · Matchpack"
                coColor="#a78bfa"
                period="2025 – Present · Remote"
                bullets={[
                  'Tscircuit: analog simulation viewer; Archestra: MCP catalog form; Matchpack: ChipPartitionsSolver algorithm — all PRs merged within 48h',
                ]}
              />
            </Section>

            <Section title="Selected Projects">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                {[
                  { name: 'Ting AI', url: 'tingsai.my.id', desc: 'AI market intelligence SaaS. 500+ users, 6+ modules, Pro subscription.' },
                  { name: 'UPG Academic Portal', url: 'upg.ac.id', desc: '3,000+ students. Portal, OPAC, CBT exam. 99%+ uptime.' },
                  { name: 'Central Jual Emas', url: 'centraljualemas.com', desc: 'Gold trading platform. Real-time price, <1.5s load, 3 weeks to ship.' },
                  { name: 'Rajawali Prestige', url: 'rajawaliprestige.my.id', desc: 'Company profile web app with dynamic content management.' },
                ].map(p => (
                  <div key={p.name} style={{ paddingBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: '#111' }}>{p.name}</span>
                      <a href={`https://${p.url}`} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: '#25d0c3', textDecoration: 'none' }}>{p.url} ↗</a>
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: 10.5, color: '#666', lineHeight: 1.45 }}>{p.desc}</p>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* ── RIGHT ────────────────────────────────────────────────── */}
          <div style={{ padding: '16px 20px 16px 16px' }}>

            <Section title="Education">
              <div style={{ fontSize: 11.5 }}>
                <div style={{ fontWeight: 700, color: '#111' }}>Bachelor of Informatics</div>
                <div style={{ color: '#666', marginTop: 1 }}>Universitas Multimedia Nusantara</div>
                <div style={{ color: '#999', fontSize: 10.5, marginTop: 1 }}>2022 – 2026 · Tangerang</div>
                <p style={{ color: '#777', fontSize: 10.5, marginTop: 5, lineHeight: 1.45 }}>Shipped multiple production freelance projects concurrently during studies.</p>
              </div>
            </Section>

            <Section title="Tech Stack">
              <SkillRow label="Frontend" items={['React', 'Next.js', 'TypeScript', 'Vite', 'Tailwind']} />
              <SkillRow label="Backend" items={['Node.js', 'Express', 'Supabase', 'PostgreSQL', 'MySQL']} />
              <SkillRow label="AI / Data" items={['LLM Integration', 'Yahoo Finance API', 'FMP', 'OpenAI']} />
              <SkillRow label="DevOps" items={['IIS', 'Windows Server', 'PM2', 'GitHub Actions']} />
            </Section>

            <Section title="Languages">
              <LangBar lang="Indonesian" level="Native" pct={100} />
              <LangBar lang="English" level="Professional" pct={80} />
            </Section>

            <Section title="Key Strengths">
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 10.5, color: '#555', lineHeight: 1.7 }}>
                {['Ship 0→production solo', 'System architecture', 'AI/LLM integration', 'IIS & Windows Server', 'Contract delivery on time'].map(s => (
                  <li key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ color: '#25d0c3', fontSize: 8 }}>▸</span>{s}
                  </li>
                ))}
              </ul>
            </Section>

          </div>
        </div>

        {/* ── FOOTER ─────────────────────────────────────────────────── */}
        <div style={{ background: '#f9f9f7', borderTop: '1px solid #eee', padding: '8px 28px', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa' }}>
          <span>faturachman.my.id · tingsai.my.id</span>
          <span>Open to full-time &amp; contract — Jakarta or Remote</span>
        </div>

      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        <span style={{ fontSize: 9.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#aaa' }}>{title}</span>
        <div style={{ flex: 1, height: 1, background: '#ebebeb' }} />
      </div>
      {children}
    </div>
  )
}

function Job({ title, co, coColor, period, bullets }: { title: string; co: string; coColor: string; period: string; bullets: string[] }) {
  return (
    <div style={{ marginBottom: 10, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '2px 8px', marginBottom: 3 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>{title}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: coColor }}>{co}</span>
        <span style={{ fontSize: 10, color: '#bbb', marginLeft: 'auto' }}>{period}</span>
      </div>
      <ul style={{ margin: 0, padding: '0 0 0 12px' }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ fontSize: 10.5, color: '#555', lineHeight: 1.5, marginBottom: 1 }}>{b}</li>
        ))}
      </ul>
    </div>
  )
}

function SkillRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div style={{ marginBottom: 5 }}>
      <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#bbb', display: 'block', marginBottom: 2 }}>{label}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 4px' }}>
        {items.map(i => (
          <span key={i} style={{ background: '#f3f3f3', color: '#555', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 500 }}>{i}</span>
        ))}
      </div>
    </div>
  )
}

function LangBar({ lang, level, pct }: { lang: string; level: string; pct: number }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginBottom: 2 }}>
        <span style={{ fontWeight: 600, color: '#333' }}>{lang}</span>
        <span style={{ color: '#aaa' }}>{level}</span>
      </div>
      <div style={{ height: 4, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: '#25d0c3', width: `${pct}%`, borderRadius: 4 }} />
      </div>
    </div>
  )
}
