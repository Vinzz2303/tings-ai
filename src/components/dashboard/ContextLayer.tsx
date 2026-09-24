import React from 'react'
import type { InstrumentSummary } from '../../types'
import type { DashboardCopy } from './types'

type Props = {
  copy: DashboardCopy
  summary: string
  instruments?: {
    ANTAM?: InstrumentSummary
    SP500?: InstrumentSummary
    IHSG?: InstrumentSummary
    BTC?: InstrumentSummary
  }
}

const currencyUsd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2
})

const currencyIdr = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
})

const decimalCompact = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2
})

function formatValue(kind: 'gold' | 'btc' | 'sp500' | 'ihsg', value?: number) {
  if (typeof value !== 'number') return '...'
  if (kind === 'gold') return currencyIdr.format(value)
  if (kind === 'ihsg') return decimalCompact.format(value)
  return currencyUsd.format(value)
}

function formatDelta(value: number | undefined, copy: DashboardCopy) {
  if (typeof value !== 'number') return copy.contextWaiting
  const sign = value > 0 ? '+' : value < 0 ? '' : ''
  return `${sign}${value.toFixed(2)}`
}

function formatUpdatedAt(value: string | undefined, copy: DashboardCopy) {
  if (!value) return copy.contextWaiting
  return value
}

export default function ContextLayer({ copy, summary, instruments }: Props) {
  const cards = [
    {
      label: copy.goldLabel,
      value: formatValue('gold', instruments?.ANTAM?.latestPrice),
      delta: formatDelta(instruments?.ANTAM?.delta, copy),
      updatedAt: formatUpdatedAt(instruments?.ANTAM?.latestDate, copy)
    },
    {
      label: copy.bitcoinLabel,
      value: formatValue('btc', instruments?.BTC?.latestPrice),
      delta: formatDelta(instruments?.BTC?.delta, copy),
      updatedAt: formatUpdatedAt(instruments?.BTC?.latestDate, copy)
    },
    {
      label: copy.usIndexLabel,
      value: formatValue('sp500', instruments?.SP500?.latestPrice),
      delta: formatDelta(instruments?.SP500?.delta, copy),
      updatedAt: formatUpdatedAt(instruments?.SP500?.latestDate, copy)
    },
    {
      label: copy.ihsgLabel,
      value: formatValue('ihsg', instruments?.IHSG?.latestPrice),
      delta: formatDelta(instruments?.IHSG?.delta, copy),
      updatedAt: formatUpdatedAt(instruments?.IHSG?.latestDate, copy)
    }
  ]

  return (
    <section className="py-10 border-t border-white/[0.05]" id="context-layer">
      <div className="mb-8">
        <p className="text-[10px] font-mono text-teal-500/80 uppercase tracking-widest mb-3">
          [ {copy.contextLayer} ]
        </p>
        <h3 className="text-xl md:text-2xl font-serif text-slate-200 mb-2">
          {copy.marketSummary}
        </h3>
        <p className="text-sm text-slate-400 max-w-3xl leading-relaxed">
          {summary.trim() || copy.contextLayerLead}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-white/[0.05]">
        {cards.map((card) => (
          <div key={card.label} className="flex flex-col gap-2">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">{card.label}</span>
            <strong className="text-lg text-slate-200 font-medium">{card.value}</strong>
            <div className="flex flex-col gap-0.5 mt-1">
              <span className="text-[10px] text-slate-500">{copy.changeLabel}: <span className={card.delta.startsWith('+') ? 'text-emerald-400' : card.delta.startsWith('-') ? 'text-red-400' : ''}>{card.delta}</span></span>
              <span className="text-[10px] text-slate-600">{copy.lastUpdateLabel}: {card.updatedAt}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
