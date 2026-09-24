import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LanguageCode } from '../utils/language'
import type { NormalizedPortfolioSnapshot } from '../utils/portfolioSnapshot'
import type { PortfolioActionWatchlistItem } from '../utils/portfolioActionWatchlist'
import type { RiskBudgetEvaluation } from '../utils/riskBudget'
import { getAssetTypeLabel, inferAssetTypeFromInput, normalizeDisplaySymbol } from '../utils/assetNormalization'
import {
  addDecisionJournalEntry,
  decisionTypeLabel,
  readDecisionJournal,
  type DecisionJournalEntry,
  type DecisionJournalType,
} from '../utils/decisionJournal'
import FirstRunTooltip from './FirstRunTooltip'

type Props = {
  snapshot: NormalizedPortfolioSnapshot
  language: LanguageCode
  isPro: boolean
  riskBudgetEvaluation?: RiskBudgetEvaluation
  watchlistItems?: PortfolioActionWatchlistItem[]
  compact?: boolean
}

const reviewOptions = ['tomorrow', '3days', 'next_week', 'custom', 'none'] as const

const copy = {
  id: {
    title: 'Jurnal Keputusan',
    subtitle: 'Catat alasan sebelum mengambil keputusan agar kamu tidak hanya bereaksi pada market.',
    cta: 'Tulis catatan',
    close: 'Tutup',
    emptyTitle: 'Belum ada catatan keputusan',
    emptyBody: 'Mulai dari satu kalimat: apa yang sedang kamu pertimbangkan, dan risikonya apa?',
    asset: 'Aset terkait',
    assetPlaceholder: 'Contoh: XAU, BBCA, BTC',
    decision: 'Keputusan yang dipertimbangkan',
    reason: 'Alasan',
    reasonPlaceholder: 'Contoh: Saya ingin pantau XAU karena bobotnya paling besar di portofolio.',
    risk: 'Risiko yang disadari',
    riskPlaceholder: 'Contoh: Jika XAU bergerak tajam, portofolio saya ikut sangat terpengaruh.',
    review: 'Review lagi',
    customDate: 'Tanggal custom',
    save: 'Simpan catatan',
    required: 'Alasan wajib diisi.',
    limit: 'Akun Free bisa membuat sampai 3 catatan keputusan lokal.',
    upgrade: 'Gunakan Ting AI Pro untuk menyimpan lebih banyak catatan keputusan.',
    riskWarning: 'Catatan: aset ini sedang melewati batas risk budget kamu. Ini bukan berarti harus jual/beli, tapi perlu kamu sadari sebelum mengambil keputusan.',
    watchWarning: 'Aset ini masuk pantauan pribadi karena:',
    noAsset: 'Tidak dikaitkan ke aset tertentu',
    created: 'Dibuat',
    reviewAt: 'Review',
    options: {
      tomorrow: 'Besok',
      '3days': '3 hari lagi',
      next_week: 'Minggu depan',
      custom: 'Custom date',
      none: 'Tidak ditentukan',
    },
  },
  en: {
    title: 'Decision Journal',
    subtitle: 'Write down your reason before making a decision, so you are not only reacting to the market.',
    cta: 'Write note',
    close: 'Close',
    emptyTitle: 'No decision notes yet',
    emptyBody: 'Start with one sentence: what are you considering, and what is the risk?',
    asset: 'Related asset',
    assetPlaceholder: 'Example: XAU, BBCA, BTC',
    decision: 'Decision being considered',
    reason: 'Reason',
    reasonPlaceholder: 'Example: I want to watch XAU because it has the largest weight in my portfolio.',
    risk: 'Risk I am aware of',
    riskPlaceholder: 'Example: If XAU moves sharply, my portfolio will be strongly affected.',
    review: 'Review again',
    customDate: 'Custom date',
    save: 'Save note',
    required: 'Reason is required.',
    limit: 'Free accounts can create up to 3 local decision notes.',
    upgrade: 'Use Ting AI Pro to save more decision notes.',
    riskWarning: 'Note: this asset is currently above your risk budget. This does not mean you must buy/sell, but you should be aware of it before deciding.',
    watchWarning: 'This asset is in your personal watchlist because:',
    noAsset: 'Not linked to a specific asset',
    created: 'Created',
    reviewAt: 'Review',
    options: {
      tomorrow: 'Tomorrow',
      '3days': 'In 3 days',
      next_week: 'Next week',
      custom: 'Custom date',
      none: 'Not set',
    },
  },
} as const

const decisionTypes: DecisionJournalType[] = ['watch', 'add', 'reduce', 'hold', 'avoid', 'review']

const addDays = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const reviewDateFromOption = (option: typeof reviewOptions[number], customDate: string) => {
  if (option === 'tomorrow') return addDays(1)
  if (option === '3days') return addDays(3)
  if (option === 'next_week') return addDays(7)
  if (option === 'custom') return customDate || null
  return null
}

const formatDate = (raw?: string | null, language: LanguageCode = 'id') => {
  if (!raw) return '-'
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleDateString(language === 'en' ? 'en-US' : 'id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const badgeClass = (type: DecisionJournalType) => {
  if (type === 'add') return 'border-teal-500/20 bg-teal-500/10 text-teal-300'
  if (type === 'reduce' || type === 'avoid') return 'border-amber-500/20 bg-amber-500/10 text-amber-300'
  if (type === 'review') return 'border-sky-500/20 bg-sky-500/10 text-sky-300'
  return 'border-white/10 bg-white/[0.04] text-slate-300'
}

export default function DecisionJournal({
  snapshot,
  language,
  isPro,
  riskBudgetEvaluation,
  watchlistItems = [],
  compact = false,
}: Props) {
  const t = copy[language] || copy.id
  const [entries, setEntries] = useState<DecisionJournalEntry[]>(() => readDecisionJournal())
  const [open, setOpen] = useState(false)
  const [relatedAsset, setRelatedAsset] = useState('')
  const [manualAsset, setManualAsset] = useState('')
  const [decisionType, setDecisionType] = useState<DecisionJournalType>('watch')
  const [reason, setReason] = useState('')
  const [riskAwareNote, setRiskAwareNote] = useState('')
  const [reviewOption, setReviewOption] = useState<typeof reviewOptions[number]>('none')
  const [customDate, setCustomDate] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const sync = () => setEntries(readDecisionJournal())
    window.addEventListener('tingai-decision-journal', sync)
    return () => window.removeEventListener('tingai-decision-journal', sync)
  }, [])

  const holdings = snapshot.holdings || []
  const hasHoldings = holdings.length > 0
  const selectedAsset = hasHoldings ? relatedAsset : manualAsset.trim()
  const normalizedSelected = selectedAsset.toUpperCase()
  const selectedAssetType = inferAssetTypeFromInput(selectedAsset)
  const isFreeLimitReached = !isPro && entries.length >= 3
  const visibleEntries = entries.slice(0, isPro ? 5 : compact ? 1 : 2)

  const selectedRiskBreach = useMemo(() => {
    if (!normalizedSelected || !riskBudgetEvaluation?.breaches?.length) return null
    const selectedHolding = holdings.find((holding) => holding.symbol.toUpperCase() === normalizedSelected)
    if (!selectedHolding) return null
    const assetType = (selectedHolding.assetType || '').toLowerCase()
    return riskBudgetEvaluation.breaches.find((breach) => {
      const label = breach.label.toLowerCase()
      if (breach.type === 'single_asset' && selectedHolding.allocationPercent > breach.limitPercent) return true
      if (assetType.includes('crypto') && label.includes('crypto')) return true
      if ((assetType.includes('gold') || normalizedSelected.includes('XAU')) && (label.includes('emas') || label.includes('gold') || label.includes('xau'))) return true
      if ((selectedHolding.exchange === 'IDX' || normalizedSelected.endsWith('.JK')) && (label.includes('indonesia') || label.includes('saham'))) return true
      return false
    }) || null
  }, [holdings, normalizedSelected, riskBudgetEvaluation])

  const selectedWatchItem = useMemo(() => {
    if (!normalizedSelected) return null
    return watchlistItems.find((item) => item.symbol.toUpperCase() === normalizedSelected) || null
  }, [normalizedSelected, watchlistItems])

  const resetForm = () => {
    setRelatedAsset('')
    setManualAsset('')
    setDecisionType('watch')
    setReason('')
    setRiskAwareNote('')
    setReviewOption('none')
    setCustomDate('')
    setError('')
  }

  const handleSave = () => {
    const cleanedReason = reason.trim()
    if (!cleanedReason) {
      setError(t.required)
      return
    }
    if (isFreeLimitReached) {
      setError(t.limit)
      return
    }

    const nextEntries = addDecisionJournalEntry({
      relatedAsset: selectedAsset ? normalizeDisplaySymbol(selectedAsset) : undefined,
      decisionType,
      reason: cleanedReason.slice(0, 300),
      riskAwareNote: riskAwareNote.trim().slice(0, 300) || undefined,
      reviewAt: reviewDateFromOption(reviewOption, customDate),
      linkedRiskBudgetStatus: selectedRiskBreach ? riskBudgetEvaluation?.status : undefined,
      linkedWatchItems: selectedWatchItem ? [selectedWatchItem.reason, selectedWatchItem.whatToWatch] : [],
    })
    setEntries(nextEntries)
    resetForm()
    setOpen(false)
  }

  return (
    <section className={compact ? 'space-y-3' : 'space-y-5'}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 relative">
        <div className="flex flex-col gap-1.5 relative">
          <span className="label-uppercase text-[10px]">{t.title}</span>
          <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">{t.subtitle}</p>
          <FirstRunTooltip 
            id="decision_journal"
            titleId="Catat Sebelum Trading"
            titleEn="Log Before You Trade"
            descId="Ting AI akan memperingatkan jika keputusanmu melanggar batas risiko portofolio. Biasakan mencatat alasan sebelum mengeksekusi order di broker."
            descEn="Ting AI will warn you if your decision breaches your portfolio risk budget. Make a habit of logging your reasons before executing orders on your broker."
            placement="bottom"
            className="left-0 translate-x-0"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen((value) => !value)
            setError('')
          }}
          disabled={isFreeLimitReached && !open}
          className={`self-start rounded-sm border px-4 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
            open
              ? 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.07]'
              : 'border-teal-500/30 bg-teal-500/10 text-teal-300 hover:bg-teal-500/20 hover:border-teal-500/40 shadow-[0_0_16px_rgba(20,184,166,0.1)]'
          }`}
        >
          {open ? t.close : t.cta}
        </button>
      </div>

      {open && (
        <div className="rounded-sm border border-white/[0.07] bg-[#050505] border border-white/10 p-4 md:p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{t.asset}</span>
              {hasHoldings ? (
                <select
                  value={relatedAsset}
                  onChange={(event) => setRelatedAsset(event.target.value)}
                  className="w-full rounded-sm border border-white/10 bg-[#080a0f] px-3 py-2.5 text-sm text-slate-200 outline-none"
                >
                  <option value="">{t.noAsset}</option>
                  {holdings.map((holding) => (
                    <option key={holding.symbol} value={holding.symbol}>
                      {normalizeDisplaySymbol(holding.symbol)} - {getAssetTypeLabel(holding.assetType || inferAssetTypeFromInput(holding.symbol), language)} - {(holding.name || normalizeDisplaySymbol(holding.symbol)).slice(0, 40)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={manualAsset}
                  onChange={(event) => setManualAsset(event.target.value.slice(0, 40))}
                  placeholder={t.assetPlaceholder}
                  className="w-full rounded-sm border border-white/10 bg-[#080a0f] px-3 py-2.5 text-sm text-slate-200 outline-none"
                />
              )}
              {selectedAsset && (
                <span className="block text-[10px] font-mono text-slate-600">
                  {normalizeDisplaySymbol(selectedAsset)} - {getAssetTypeLabel(selectedAssetType, language)}
                </span>
              )}
            </label>

            <label className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{t.decision}</span>
              <select
                value={decisionType}
                onChange={(event) => setDecisionType(event.target.value as DecisionJournalType)}
                className="w-full rounded-sm border border-white/10 bg-[#080a0f] px-3 py-2.5 text-sm text-slate-200 outline-none"
              >
                {decisionTypes.map((type) => (
                  <option key={type} value={type}>{decisionTypeLabel(type, language)}</option>
                ))}
              </select>
            </label>
          </div>

          {selectedRiskBreach && (
            <div className="rounded-sm border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs text-amber-200 leading-relaxed">
              {t.riskWarning}
            </div>
          )}

          {selectedWatchItem && (
            <div className="rounded-sm border border-teal-500/20 bg-teal-500/[0.05] p-3 text-xs text-teal-100 leading-relaxed">
              <span className="font-semibold">{t.watchWarning}</span> {selectedWatchItem.reason}
            </div>
          )}

          <label className="space-y-1.5 block">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{t.reason}</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value.slice(0, 300))}
              placeholder={t.reasonPlaceholder}
              rows={3}
              className="w-full resize-none rounded-sm border border-white/10 bg-[#080a0f] px-3 py-2.5 text-sm text-slate-200 outline-none"
            />
            <span className="block text-right text-[10px] font-mono text-slate-700">{reason.length}/300</span>
          </label>

          <label className="space-y-1.5 block">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{t.risk}</span>
            <textarea
              value={riskAwareNote}
              onChange={(event) => setRiskAwareNote(event.target.value.slice(0, 300))}
              placeholder={t.riskPlaceholder}
              rows={2}
              className="w-full resize-none rounded-sm border border-white/10 bg-[#080a0f] px-3 py-2.5 text-sm text-slate-200 outline-none"
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{t.review}</span>
              <select
                value={reviewOption}
                onChange={(event) => setReviewOption(event.target.value as typeof reviewOptions[number])}
                className="w-full rounded-sm border border-white/10 bg-[#080a0f] px-3 py-2.5 text-sm text-slate-200 outline-none"
              >
                {reviewOptions.map((option) => (
                  <option key={option} value={option}>{t.options[option]}</option>
                ))}
              </select>
            </label>
            {reviewOption === 'custom' && (
              <label className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{t.customDate}</span>
                <input
                  type="date"
                  value={customDate}
                  onChange={(event) => setCustomDate(event.target.value)}
                  className="w-full rounded-sm border border-white/10 bg-[#080a0f] px-3 py-2.5 text-sm text-slate-200 outline-none"
                />
              </label>
            )}
          </div>

          {error && <p className="text-xs text-red-300">{error}</p>}

          <button
            type="button"
            onClick={handleSave}
            className="rounded-sm bg-teal-400 px-5 py-2.5 text-xs font-bold text-black hover:bg-teal-300 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_4px_16px_rgba(20,184,166,0.2)]"
          >
            {t.save}
          </button>
        </div>
      )}

      {!visibleEntries.length ? (
        <div className="rounded-sm border border-dashed border-white/10 bg-white/[0.015] p-6 text-center">
          {/* Icon */}
          <div className="mx-auto mb-3 w-10 h-10 rounded-sm bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-300">{t.emptyTitle}</p>
          <p className="mt-1.5 text-xs text-slate-500 leading-relaxed max-w-md mx-auto">{t.emptyBody}</p>
          {/* Writing prompts */}
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {(language === 'id'
              ? ['Pantau posisi terbesar', 'Review sebelum tambah posisi', 'Evaluasi risiko saat ini']
              : ['Watch largest position', 'Review before adding', 'Evaluate current risk']
            ).map((prompt) => (
              <span
                key={prompt}
                className="text-[10px] px-2.5 py-1 rounded-lg border border-white/[0.06] bg-[#050505] border border-white/10 text-slate-500 font-mono"
              >
                {prompt}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleEntries.map((entry) => (
            <article key={entry.id} className="rounded-sm border border-white/[0.06] bg-[#050505] border border-white/10 p-4 space-y-3 transition-all duration-300 hover:border-white/[0.12] hover:shadow-lg hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-3">
                <span className={`rounded-md border px-2 py-1 text-[10px] font-mono uppercase tracking-wider ${badgeClass(entry.decisionType)}`}>
                  {decisionTypeLabel(entry.decisionType, language)}
                </span>
                <span className="text-[10px] font-mono text-slate-600">{entry.relatedAsset ? normalizeDisplaySymbol(entry.relatedAsset) : t.noAsset}</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed">{entry.reason}</p>
              {entry.riskAwareNote && (
                <p className="rounded-sm border border-white/[0.05] bg-black/10 p-3 text-xs text-slate-400 leading-relaxed">
                  {entry.riskAwareNote}
                </p>
              )}
              <div className="flex flex-wrap gap-3 text-[10px] font-mono text-slate-600 uppercase tracking-widest">
                <span>{t.created}: {formatDate(entry.createdAt, language)}</span>
                {entry.reviewAt && <span>{t.reviewAt}: {formatDate(entry.reviewAt, language)}</span>}
              </div>
            </article>
          ))}
        </div>
      )}

      {!isPro && (
        <Link to="/upgrade" className="inline-flex text-xs font-semibold text-amber-400 hover:text-amber-300">
          {t.upgrade} &rarr;
        </Link>
      )}
    </section>
  )
}
