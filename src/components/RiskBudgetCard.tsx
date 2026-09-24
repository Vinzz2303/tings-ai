import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LanguageCode } from '../utils/language'
import type { NormalizedPortfolioSnapshot } from '../utils/portfolioSnapshot'
import {
  defaultRiskBudget,
  evaluateRiskBudget,
  readRiskBudget,
  saveRiskBudget,
  type RiskBudgetConfig,
} from '../utils/riskBudget'

type Props = {
  snapshot: NormalizedPortfolioSnapshot
  language: LanguageCode
  isPro: boolean
  compact?: boolean
  onBudgetChange?: (budget: RiskBudgetConfig) => void
  onAddAsset?: () => void
}

const fieldLabels: Record<keyof Omit<RiskBudgetConfig, 'updatedAt'>, Record<LanguageCode, string>> = {
  maxSingleAssetPercent: { id: 'Maksimal porsi per aset', en: 'Max per asset' },
  maxCryptoPercent: { id: 'Maksimal crypto', en: 'Max crypto' },
  maxGoldPercent: { id: 'Maksimal emas/XAU', en: 'Max gold/XAU' },
  maxIndonesianStockPercent: { id: 'Maksimal saham Indonesia', en: 'Max Indonesian stocks' },
  maxUSStockPercent: { id: 'Maksimal saham US', en: 'Max US stocks' },
  maxManualOrDataLimitedPercent: { id: 'Maksimal aset data terbatas', en: 'Max limited-data assets' },
  maxSpeculativeStockPercent: { id: 'Maksimal saham spekulatif', en: 'Max speculative stocks' },
}

const fields = Object.keys(fieldLabels) as Array<keyof Omit<RiskBudgetConfig, 'updatedAt'>>

const copy = {
  id: {
    subtitle: 'Batas risiko pribadi agar kamu tahu kapan portofolio mulai terlalu terkonsentrasi.',
    safe: 'Masih dalam batas risiko',
    statusWatch: 'Perlu dipantau',
    exceeded: 'Risk budget terlampaui',
    set: 'Atur Risk Budget',
    save: 'Simpan batas risiko',
    cancel: 'Tutup',
    error: 'Nilai harus berada di antara 0 sampai 100, tanpa angka minus.',
    freeCta: 'Gunakan Ting AI Pro untuk mengatur batas risiko pribadi.',
    emptyTitle: 'Risk budget belum aktif',
    emptyBody: 'Tambahkan aset di Portfolio Workspace agar Ting AI bisa membandingkan komposisi dengan batas risiko.',
    emptyCta: 'Tambah aset portfolio',
    awareness: 'Yang perlu disadari',
    limit: 'Batas',
  },
  en: {
    subtitle: 'Personal risk limits so you know when your portfolio starts becoming too concentrated.',
    safe: 'Still within risk limits',
    statusWatch: 'Needs monitoring',
    exceeded: 'Risk budget exceeded',
    set: 'Set Risk Budget',
    save: 'Save risk limits',
    cancel: 'Close',
    error: 'Values must be between 0 and 100, with no negative numbers.',
    freeCta: 'Use Ting AI Pro to customize personal risk limits.',
    emptyTitle: 'Risk budget is not active yet',
    emptyBody: 'Add assets in Portfolio Workspace so Ting AI can compare composition against your risk limits.',
    emptyCta: 'Add portfolio assets',
    awareness: 'What to be aware of',
    limit: 'Limit',
  },
} as const

const toneClass = {
  safe: 'border-teal-500/20 bg-teal-500/[0.04] text-teal-300',
  watch: 'border-amber-500/20 bg-amber-500/[0.04] text-amber-300',
  exceeded: 'border-red-500/20 bg-red-500/[0.04] text-red-300',
}

export default function RiskBudgetCard({ snapshot, language, isPro, compact = false, onBudgetChange, onAddAsset }: Props) {
  const t = copy[language] || copy.id
  const [budget, setBudget] = useState<RiskBudgetConfig>(() => readRiskBudget())
  const [draft, setDraft] = useState<RiskBudgetConfig>(() => readRiskBudget())
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const sync = () => {
      const next = readRiskBudget()
      setBudget(next)
      setDraft(next)
      onBudgetChange?.(next)
    }
    window.addEventListener('tingai-risk-budget', sync)
    return () => window.removeEventListener('tingai-risk-budget', sync)
  }, [onBudgetChange])

  const evaluation = useMemo(
    () => evaluateRiskBudget(snapshot, budget, language),
    [budget, language, snapshot]
  )
  const visibleBreaches = evaluation.breaches.slice(0, isPro ? 5 : 2)
  const title = evaluation.status === 'safe' ? t.safe : evaluation.status === 'watch' ? t.statusWatch : t.exceeded

  const handleSave = () => {
    const invalid = fields.some((field) => {
      const value = Number(draft[field])
      return !Number.isFinite(value) || value < 0 || value > 100
    })
    if (invalid) {
      setError(t.error)
      return
    }

    const saved = saveRiskBudget(draft)
    setBudget(saved)
    setDraft(saved)
    setError('')
    setOpen(false)
    onBudgetChange?.(saved)
  }

  const resetToDefaults = () => {
    const defaults = defaultRiskBudget()
    setDraft(defaults)
    setError('')
  }

  return (
    <section className={compact ? 'space-y-3' : 'space-y-5'}>
      <div className="flex flex-col gap-1.5">
        <span className="label-uppercase text-[10px]">Risk Budget</span>
        <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">{t.subtitle}</p>
      </div>

      {!snapshot.hasPortfolio ? (
        <div className="rounded-sm border border-dashed border-white/10 bg-white/[0.015] p-5">
          <p className="text-sm font-medium text-slate-300">{t.emptyTitle}</p>
          <p className="mt-1.5 text-xs text-slate-500 leading-relaxed max-w-md">{t.emptyBody}</p>
          {onAddAsset ? (
            <button type="button" onClick={onAddAsset} className="mt-4 inline-flex text-xs font-semibold text-teal-400 hover:text-teal-300">
              {t.emptyCta} →
            </button>
          ) : (
            <Link to="/portfolio" className="mt-4 inline-flex text-xs font-semibold text-teal-400 hover:text-teal-300">
              {t.emptyCta} →
            </Link>
          )}
        </div>
      ) : (
        <div className={`rounded-sm border p-4 md:p-5 space-y-4 ${toneClass[evaluation.status]}`}>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-white">{title}</h3>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed max-w-2xl">{evaluation.summary}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDraft(budget)
                setOpen((value) => !value)
                setError('')
              }}
              className="self-start rounded-sm border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.07]"
            >
              {t.set}
            </button>
          </div>

          {visibleBreaches.length ? (
            <div className="space-y-2.5">
              {visibleBreaches.map((breach) => (
                <div key={`${breach.type}-${breach.label}`} className="rounded-sm border border-white/[0.06] bg-black/10 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-100">{breach.label}</p>
                    <span className="text-[10px] font-mono text-slate-400">
                      {breach.currentPercent.toFixed(1)}% / {t.limit} {breach.limitPercent.toFixed(0)}%
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{breach.explanation}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-sm border border-white/[0.06] bg-black/10 p-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">{t.awareness}</p>
              <p className="mt-1 text-xs text-slate-400">{evaluation.watchItems[0]}</p>
            </div>
          )}

          {!isPro && (
            <Link to="/upgrade" className="inline-flex text-xs font-semibold text-amber-300 hover:text-amber-200">
              {t.freeCta} →
            </Link>
          )}

          {open && (
            <div className="rounded-sm border border-white/[0.08] bg-[#080a0f]/80 p-4 space-y-4">
              {!isPro ? (
                <p className="text-xs text-slate-400 leading-relaxed">{t.freeCta}</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {fields.map((field) => (
                      <label key={field} className="space-y-1.5">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                          {fieldLabels[field][language]}
                        </span>
                        <div className="flex items-center gap-2 rounded-sm border border-white/10 bg-white/[0.03] px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={draft[field]}
                            onChange={(event) => setDraft((current) => ({
                              ...current,
                              [field]: Number(event.target.value),
                            }))}
                            className="w-full bg-transparent text-sm text-white outline-none"
                          />
                          <span className="text-xs text-slate-500">%</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  {error && <p className="text-xs text-red-300">{error}</p>}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={handleSave} className="rounded-sm bg-teal-400 px-4 py-2 text-xs font-bold text-black">
                      {t.save}
                    </button>
                    <button type="button" onClick={resetToDefaults} className="rounded-sm border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300">
                      Default
                    </button>
                    <button type="button" onClick={() => setOpen(false)} className="rounded-sm border border-white/10 px-4 py-2 text-xs font-semibold text-slate-500">
                      {t.cancel}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
