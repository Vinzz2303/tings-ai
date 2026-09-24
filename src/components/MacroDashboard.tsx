import { useState, useEffect } from 'react'

interface MacroData {
  fedFundsRate: number | null
  us10YearYield: number | null
  dxy: number | null
  inflationRate: number | null
  vix: number | null
  us2YearYield: number | null
  gold: number | null
  unemploymentRate: number | null
  lastUpdated: string
  aiAnalysis?: string
  alphaSignals?: any[]
}

// ── Gauge ──────────────────────────────────────────────────────────────────────
function FearAndGreedGauge({ vix }: { vix: number | null }) {
  const v = vix || 15
  let score = 50
  if (v <= 10) score = 80 + (10 - v) * 2
  else if (v <= 15) score = 50 + (15 - v) * 6
  else if (v <= 25) score = 20 + (25 - v) * 3
  else score = Math.max(0, 20 - (v - 25) * 2)
  score = Math.min(100, Math.max(0, score))

  const rotation = -90 + (score / 100) * 180
  const color =
    score < 25 ? '#ef4444' :
    score < 45 ? '#f97316' :
    score < 55 ? '#eab308' :
    score < 75 ? '#84cc16' : '#22c55e'
  const text =
    score < 25 ? 'Extreme Fear' :
    score < 45 ? 'Fear' :
    score < 55 ? 'Neutral' :
    score < 75 ? 'Greed' : 'Extreme Greed'

  const zones = [
    { color: '#ef4444', label: 'E.Fear' },
    { color: '#f97316', label: 'Fear' },
    { color: '#eab308', label: 'Neutral' },
    { color: '#84cc16', label: 'Greed' },
    { color: '#22c55e', label: 'E.Greed' },
  ]

  return (
    <div className="flex flex-col items-center justify-center p-5 rounded-2xl border border-white/[0.05] bg-white/[0.015] h-full relative overflow-hidden md:col-span-2">
      <div className="absolute inset-0 rounded-2xl" style={{ background: `radial-gradient(ellipse at 50% 100%, ${color}08 0%, transparent 70%)` }} />
      <p className="text-[9px] font-mono tracking-[0.2em] text-slate-500 mb-4 uppercase z-10">Fear & Greed Index</p>

      {/* Arc gauge */}
      <div className="relative w-44 h-[88px] overflow-hidden z-10 mb-1">
        {/* Track */}
        <svg width="176" height="100" viewBox="0 0 176 100" className="absolute top-0 left-0">
          <path d="M 12 88 A 76 76 0 0 1 164 88" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" strokeLinecap="round" />
          {/* Color zones */}
          {zones.map((z, i) => {
            const startAngle = -180 + i * 36
            const endAngle = startAngle + 36
            const toRad = (deg: number) => (deg * Math.PI) / 180
            const cx = 88, cy = 88, r = 76
            const x1 = cx + r * Math.cos(toRad(startAngle))
            const y1 = cy + r * Math.sin(toRad(startAngle))
            const x2 = cx + r * Math.cos(toRad(endAngle))
            const y2 = cy + r * Math.sin(toRad(endAngle))
            return (
              <path key={i}
                d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`}
                fill="none"
                stroke={z.color}
                strokeWidth="10"
                strokeLinecap="round"
                opacity="0.25"
                style={{ clipPath: 'inset(0 0 50% 0)' }}
              />
            )
          })}
          {/* Active arc */}
          <path d="M 12 88 A 76 76 0 0 1 164 88" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 239} 239`} opacity="0.85"
            style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1), stroke 0.6s ease' }}
          />
          {/* Needle */}
          <g transform={`rotate(${rotation}, 88, 88)`} style={{ transition: 'transform 1.2s cubic-bezier(0.4,0,0.2,1)' }}>
            <line x1="88" y1="88" x2="88" y2="24" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
            <circle cx="88" cy="88" r="5" fill="#1a1d26" stroke={color} strokeWidth="2" />
          </g>
        </svg>
      </div>

      <p className="text-4xl font-bold font-mono z-10" style={{ color, transition: 'color 0.6s ease' }}>
        {Math.round(score)}
      </p>
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400 mt-1 z-10">{text}</p>
      <p className="text-[9px] font-mono text-slate-600 mt-2 z-10">VIX: {v?.toFixed(2)}</p>
    </div>
  )
}

// ── Metric Card ─────────────────────────────────────────────────────────────────
function MetricCard({
  label,
  value,
  subLabel,
  warnLevel,
}: {
  label: string
  value: string
  subLabel?: string
  warnLevel?: 'danger' | 'warn' | 'safe' | 'neutral'
}) {
  const colors = {
    danger: { border: 'border-red-500/25', bg: 'bg-red-500/[0.04]', val: 'text-red-400', dot: 'bg-red-500' },
    warn:   { border: 'border-amber-500/25', bg: 'bg-amber-500/[0.04]', val: 'text-amber-400', dot: 'bg-amber-500' },
    safe:   { border: 'border-emerald-500/25', bg: 'bg-emerald-500/[0.04]', val: 'text-emerald-400', dot: 'bg-emerald-500' },
    neutral: { border: 'border-white/[0.05]', bg: 'bg-white/[0.015]', val: 'text-slate-200', dot: 'bg-slate-500' },
  }
  const c = colors[warnLevel ?? 'neutral']

  return (
    <div className={`p-4 rounded-xl border ${c.border} ${c.bg} relative overflow-hidden transition-all duration-500`}>
      {warnLevel && warnLevel !== 'neutral' && (
        <div className={`absolute top-0 right-0 w-16 h-16 rounded-full filter blur-2xl opacity-20 ${c.dot}`} />
      )}
      <div className="flex items-center gap-1.5 mb-2">
        {warnLevel && warnLevel !== 'neutral' && (
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
        )}
        <p className="text-[9px] font-mono tracking-[0.15em] text-slate-500 uppercase">{label}</p>
      </div>
      <p className={`text-2xl font-bold font-mono ${c.val} transition-colors duration-500`}>{value}</p>
      {subLabel && <p className="text-[9px] text-slate-600 mt-1 font-mono">{subLabel}</p>}
    </div>
  )
}

// ── Signal badge helper ─────────────────────────────────────────────────────────
function getSignalDirection(signal: any): { label: string; style: string } {
  const text = ((signal.signal || '') + (signal.asset || '')).toLowerCase()
  if (signal.color === 'green' || text.includes('buy') || text.includes('beli') || text.includes('breakout') || text.includes('long'))
    return { label: 'BUY', style: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' }
  if (signal.color === 'red' || text.includes('sell') || text.includes('jual') || text.includes('short') || text.includes('hindari'))
    return { label: 'SELL', style: 'bg-red-500/15 text-red-400 border-red-500/30' }
  if (text.includes('warning') || text.includes('waspada') || text.includes('limit') || text.includes('system'))
    return { label: 'WARN', style: 'bg-orange-500/15 text-orange-400 border-orange-500/30' }
  return { label: 'WATCH', style: 'bg-slate-500/15 text-slate-400 border-slate-500/30' }
}

function getVixWarnLevel(vix: number | null): 'danger' | 'warn' | 'safe' | 'neutral' {
  if (!vix) return 'neutral'
  if (vix > 30) return 'danger'
  if (vix > 20) return 'warn'
  if (vix < 15) return 'safe'
  return 'neutral'
}

function getInflationWarnLevel(cpi: number | null): 'danger' | 'warn' | 'safe' | 'neutral' {
  if (!cpi) return 'neutral'
  if (cpi > 5) return 'danger'
  if (cpi > 3.5) return 'warn'
  if (cpi <= 2.5) return 'safe'
  return 'neutral'
}

function getYieldWarnLevel(y: number | null): 'danger' | 'warn' | 'safe' | 'neutral' {
  if (!y) return 'neutral'
  if (y > 5) return 'danger'
  if (y > 4.2) return 'warn'
  return 'neutral'
}

// ── Main Component ──────────────────────────────────────────────────────────────
export default function MacroDashboard({ i18n, activeCategory = 'all' }: { i18n: any, activeCategory?: string }) {
  const [data, setData] = useState<MacroData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    fetch('/api/market/macro')
      .then(res => res.json())
      .then(json => {
        if (json.success) setData(json.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
    return () => { window.speechSynthesis.cancel() }
  }, [])

  const handlePlayVoice = () => {
    if (isPlaying) {
      window.speechSynthesis.cancel()
      setIsPlaying(false)
      return
    }
    const textToRead = data?.aiAnalysis
      ? data.aiAnalysis.replace('INTELIGENSI MAKRO:', '').replace('INTELIGENSI MAKRO (Sistem Utama Sedang Sibuk):', '')
      : `Suku bunga ${data?.fedFundsRate}% dan inflasi ${data?.inflationRate}% mengindikasikan likuiditas global yang ketat. VIX di angka ${data?.vix} menunjukkan sentimen pasar saat ini.`

    const utterance = new SpeechSynthesisUtterance(textToRead)
    utterance.lang = 'id-ID'
    utterance.rate = 1.05
    utterance.pitch = 0.95
    utterance.onend = () => setIsPlaying(false)
    setIsPlaying(true)
    window.speechSynthesis.speak(utterance)
  }

  if (loading) return (
    <div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.01] animate-pulse h-48">
      <div className="w-1/3 h-6 bg-white/10 rounded mb-4" />
      <div className="w-full h-24 bg-white/5 rounded" />
    </div>
  )

  if (!data) return null

  const lastUpdatedStr = data.lastUpdated
    ? new Date(data.lastUpdated).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#090c13] space-y-6 shadow-2xl relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-teal-500/[0.03] rounded-full filter blur-3xl pointer-events-none" />

      <div className="px-6 pt-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-base font-semibold text-slate-200 tracking-tight">Global Macro & Geopolitics</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Indikator utama ekonomi AS yang memengaruhi arah pasar global.</p>
          </div>
          {lastUpdatedStr && (
            <span className="text-[9px] font-mono text-slate-600 border border-white/[0.05] rounded-full px-2.5 py-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              Diperbarui {lastUpdatedStr} WIB
            </span>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="px-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Fear & Greed — spans 2 cols */}
        <FearAndGreedGauge vix={data.vix} />

        <MetricCard
          label="Suku Bunga The Fed"
          value={data.fedFundsRate ? `${data.fedFundsRate}%` : '—'}
          subLabel="Target Range 3.50–3.75%"
          warnLevel={data.fedFundsRate && data.fedFundsRate > 4 ? 'warn' : 'safe'}
        />

        <MetricCard
          label="Inflasi AS (CPI YoY)"
          value={data.inflationRate ? `${data.inflationRate}%` : '—'}
          subLabel={data.inflationRate && data.inflationRate <= 2.5 ? 'Di bawah target Fed' : data.inflationRate && data.inflationRate > 4 ? 'Di atas target Fed' : 'Mendekati target 2%'}
          warnLevel={getInflationWarnLevel(data.inflationRate)}
        />

        <MetricCard
          label="Pengangguran (UNRATE)"
          value={data.unemploymentRate ? `${data.unemploymentRate}%` : '—'}
          warnLevel={data.unemploymentRate && data.unemploymentRate > 5 ? 'warn' : 'neutral'}
        />

        <MetricCard
          label="Obligasi 2Y (Sensitif)"
          value={data.us2YearYield ? `${data.us2YearYield}%` : '—'}
          subLabel="Barometer ekspektasi Fed"
          warnLevel={getYieldWarnLevel(data.us2YearYield)}
        />

        <MetricCard
          label="Obligasi AS 10Y"
          value={data.us10YearYield ? `${data.us10YearYield}%` : '—'}
          warnLevel={getYieldWarnLevel(data.us10YearYield)}
        />

        <MetricCard
          label="Emas (XAU/USD)"
          value={data.gold ? `$${data.gold.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : '—'}
          subLabel={data.gold && data.gold > 3000 ? 'Safe-haven aktif' : undefined}
          warnLevel={data.gold && data.gold > 3000 ? 'warn' : 'neutral'}
        />
      </div>

      {/* Divider */}
      <div className="mx-6 border-t border-white/[0.04]" />

      {/* AI Briefing + Alpha Signals */}
      <div className="px-6 pb-6 flex flex-col md:flex-row gap-4">
        
        {/* TINGS AI Voice Briefing */}
        <div className="pt-4 px-5 pb-5 border border-indigo-500/20 bg-indigo-500/[0.025] rounded-2xl flex-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/[0.06] rounded-full filter blur-3xl pointer-events-none" />
          <div className="flex justify-between items-center mb-4 relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-indigo-400">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </div>
              <h4 className="text-[10px] font-bold tracking-[0.15em] text-indigo-400 uppercase">TINGS AI BRIEFING</h4>
            </div>
            <button
              onClick={handlePlayVoice}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                isPlaying
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.25)] animate-pulse'
                  : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 hover:bg-indigo-500/25'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-red-500' : 'bg-indigo-400'}`} />
              {isPlaying ? 'HENTIKAN' : 'DENGARKAN'}
            </button>
          </div>
          <p className="text-[13px] text-slate-300 leading-[1.75] relative z-10" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {data.aiAnalysis ? (
              <span dangerouslySetInnerHTML={{ __html: data.aiAnalysis
                .replace('INTELIGENSI MAKRO (Sistem Utama Sedang Sibuk):', '<span class="text-orange-400 font-semibold text-[10px] uppercase tracking-widest">⚠ SISTEM SIBUK —</span>')
                .replace('INTELIGENSI MAKRO:', '<span class="text-teal-400 font-semibold text-[10px] uppercase tracking-widest block mb-2">INTELIGENSI MAKRO</span>') }} />
            ) : (
              <>
                <span className="text-teal-400 font-semibold text-[10px] uppercase tracking-widest block mb-2">INTELIGENSI MAKRO</span>
                Suku bunga {data.fedFundsRate}% dan inflasi {data.inflationRate}% mengindikasikan likuiditas global yang ketat.
                VIX di angka {data.vix} menunjukkan sentimen pasar saat ini.
              </>
            )}
          </p>
        </div>

        {/* Alpha Trade Signals */}
        <div className="pt-4 px-5 pb-5 border border-amber-500/20 bg-amber-500/[0.02] rounded-2xl flex-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/[0.06] rounded-full filter blur-3xl pointer-events-none" />
          <div className="flex items-center gap-2 mb-4 relative z-10">
            <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber-400">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
            <h4 className="text-[10px] font-bold tracking-[0.15em] text-amber-500 uppercase">Alpha Signals — Live AI</h4>
          </div>

          <div className="space-y-2.5 relative z-10">
            {data.alphaSignals && data.alphaSignals.length > 0 ? (
              data.alphaSignals.map((signalItem: any, idx: number) => {
                const direction = getSignalDirection(signalItem)
                return (
                  <div key={idx} className="bg-white/[0.025] border border-white/[0.06] p-3.5 rounded-xl hover:bg-white/[0.04] transition-colors duration-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[12px] font-semibold text-slate-200">{signalItem.asset}</p>
                      <span className={`text-[9px] font-black tracking-[0.15em] border px-2 py-0.5 rounded-full ${direction.style}`}>
                        {direction.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-[1.6]">{signalItem.signal}</p>
                  </div>
                )
              })
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <span className="w-4 h-4 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin flex-shrink-0" />
                <p className="text-[11px] text-slate-500">Menganalisis kondisi pasar secara real-time...</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
