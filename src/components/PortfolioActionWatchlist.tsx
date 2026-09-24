import { Link } from 'react-router-dom'
import type { LanguageCode } from '../utils/language'
import type { PortfolioActionWatchlistItem } from '../utils/portfolioActionWatchlist'
import { normalizeDisplaySymbol } from '../utils/assetNormalization'

type Props = {
  items: PortfolioActionWatchlistItem[]
  language: LanguageCode
  isPro: boolean
  compact?: boolean
  onAddAsset?: () => void
}

const copy = {
  id: {
    title: 'Pantauan Pribadi',
    subtitle: 'Aset dan faktor yang paling perlu kamu pantau berdasarkan portofolio kamu.',
    emptyTitle: 'Belum ada pantauan pribadi',
    emptyBody: 'Tambahkan aset di Portfolio Workspace agar Ting AI bisa membuat daftar pantauan berdasarkan portofolio kamu.',
    emptyCta: 'Tambah aset portfolio',
    watch: 'Yang dipantau',
    locked: 'Lihat pantauan lengkap dengan Ting AI Pro',
  },
  en: {
    title: 'Personal Watchlist',
    subtitle: 'Assets and factors to monitor based on your portfolio composition.',
    emptyTitle: 'No personal watchlist yet',
    emptyBody: 'Add assets in Portfolio Workspace so Ting AI can build a watchlist from your portfolio.',
    emptyCta: 'Add portfolio assets',
    watch: 'What to watch',
    locked: 'See full watchlist with Ting AI Pro',
  },
} as const

const badgeClass = (badge: string) => {
  const lower = badge.toLowerCase()
  if (lower.includes('konsentrasi') || lower.includes('concentration')) return 'border-amber-500/20 bg-amber-500/10 text-amber-300'
  if (lower.includes('volatil') || lower.includes('volatility')) return 'border-red-500/20 bg-red-500/10 text-red-300'
  if (lower.includes('data')) return 'border-teal-500/20 bg-teal-500/10 text-teal-300'
  return 'border-white/10 bg-white/[0.04] text-slate-300'
}

export default function PortfolioActionWatchlist({ items, language, isPro, compact = false, onAddAsset }: Props) {
  const t = copy[language] || copy.id
  const visibleItems = items.slice(0, isPro ? 5 : 2)
  const hasLockedItems = !isPro && items.length > visibleItems.length

  return (
    <section className={compact ? 'space-y-3' : 'space-y-5'}>
      <div className="flex flex-col gap-1.5">
        <span className="label-uppercase text-[10px]">{t.title}</span>
        <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">{t.subtitle}</p>
      </div>

      {!items.length ? (
        <div className="rounded-sm border border-dashed border-white/10 bg-white/[0.015] p-5">
          <p className="text-sm font-medium text-slate-300">{t.emptyTitle}</p>
          <p className="mt-1.5 text-xs text-slate-500 leading-relaxed max-w-md">{t.emptyBody}</p>
          {onAddAsset ? (
            <button onClick={onAddAsset} className="mt-4 inline-flex text-xs font-semibold text-teal-400 hover:text-teal-300">
              {t.emptyCta} →
            </button>
          ) : (
            <Link to="/portfolio" className="mt-4 inline-flex text-xs font-semibold text-teal-400 hover:text-teal-300">
              {t.emptyCta} →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleItems.map((item) => (
            <article
              key={item.symbol}
              className="rounded-sm border border-white/[0.06] bg-[#050505] border border-white/10 p-4 md:p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {item.name} · {item.allocationPercent.toFixed(1)}%
                  </p>
                </div>
                <span className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-mono text-slate-300">
                  {normalizeDisplaySymbol(item.symbol)}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {item.badges.slice(0, 3).map((badge) => (
                  <span
                    key={badge}
                    className={`rounded-md border px-2 py-1 text-[9px] font-mono uppercase tracking-wider ${badgeClass(badge)}`}
                  >
                    {badge}
                  </span>
                ))}
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">{item.reason}</p>

              {isPro && (
                <div className="rounded-sm border border-white/[0.05] bg-black/10 px-3 py-2.5">
                  <p className="text-[9px] font-mono uppercase tracking-widest text-slate-600">{t.watch}</p>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">{item.whatToWatch}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {hasLockedItems && (
        <Link to="/upgrade" className="inline-flex text-xs font-semibold text-amber-400 hover:text-amber-300">
          {t.locked} →
        </Link>
      )}
    </section>
  )
}
