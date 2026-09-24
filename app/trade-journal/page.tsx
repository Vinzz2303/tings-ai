import type { Metadata } from 'next'
import NextClientRoutePage from '../_components/NextClientRoutePage'

export const metadata: Metadata = {
  title: 'Trade Journal | Ting AI',
  description: 'Catat, analisis, dan pelajari setiap posisi trading kamu dengan AI bias detection.',
  robots: 'noindex, nofollow',
  alternates: { canonical: '/trade-journal' },
}

export default function TradeJournalPage() {
  return <NextClientRoutePage />
}
