import type { Metadata } from 'next'
import NextClientRoutePage from '../_components/NextClientRoutePage'

export const metadata: Metadata = {
  title: 'Trader Mode & Analisis Saham AI | Ting AI Explore',
  description: 'Gunakan Ting AI Trader Mode untuk mendapatkan analisis teknikal saham otomatis, area support & resistance, serta momentum indikator (RSI/MACD) secara real-time.',
  keywords: 'Analisis Saham AI, Trading Setup Saham, Rekomendasi Saham AI, Support Resistance Saham, Trader Mode Ting AI',
  robots: 'index, follow',
  alternates: { canonical: 'https://ting.ai/explore-intelligence' },
  openGraph: {
    title: 'Trader Mode & Analisis Saham AI | Ting AI Explore',
    description: 'Dapatkan sinyal trading dan setup teknikal otomatis dengan kecerdasan buatan Ting AI.',
    type: 'website',
  },
}

export default function ExploreIntelligencePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    'name': 'Ting AI Trader Mode',
    'applicationCategory': 'FinanceApplication',
    'operatingSystem': 'Web',
    'description': 'Fitur AI untuk analisis saham teknikal otomatis, menyediakan area support, resistance, dan momentum sinyal trading.',
    'offers': {
      '@type': 'Offer',
      'price': '0',
      'priceCurrency': 'IDR',
    }
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NextClientRoutePage />
    </>
  )
}
