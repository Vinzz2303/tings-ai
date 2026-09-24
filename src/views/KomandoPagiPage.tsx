/**
 * KomandoPagiPage.tsx
 * Route wrapper for /komando-pagi.
 * Wider container — Command Center grid needs more breathing room.
 * OnboardingModal muncul di sini (bukan di Dashboard) karena ini
 * adalah halaman PERTAMA yang dikunjungi user setelah login.
 */

import { useMemo } from 'react'
import KomandoPagi from '../components/KomandoPagi'
import OnboardingModal from '../components/OnboardingModal'
import { useAuthSession } from '../utils/useAuthSession'
import { useLanguagePreference } from '../utils/language'
import { Helmet } from 'react-helmet-async'

export default function KomandoPagiPage() {
  const { user } = useAuthSession()
  const { language } = useLanguagePreference()

  const userPlan = useMemo(() => {
    try { return localStorage.getItem('lifeOS_user_plan') || 'free' }
    catch { return 'free' }
  }, [])

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Komando Pagi - Briefing Makro & Pasar",
    "author": {
      "@type": "Organization",
      "name": "Ting AI"
    },
    "description": "Ringkasan harian kondisi makro, IHSG, Kripto, dan arah pikiran sebelum market bergerak. Dihasilkan oleh sistem intelijen Ting AI.",
    "publisher": {
      "@type": "Organization",
      "name": "Ting AI"
    }
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(20,184,166,0.055) 0%, transparent 55%), #080a0f',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <Helmet>
        <title>Komando Pagi | Ting AI</title>
        <meta name="description" content="Ringkasan harian kondisi portofolio dan arah pikiran sebelum market bergerak." />
        <script type="application/ld+json">
          {JSON.stringify(schemaData)}
        </script>
      </Helmet>
      {/* Ambient grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Content — wider max-w for grid layout */}
      <div className="max-w-5xl mx-auto px-4 pt-[88px] pb-12 space-y-1">
        <KomandoPagi userPlan={userPlan} />
      </div>

      {/* Onboarding flow — muncul sekali setelah user login pertama kali */}
      <OnboardingModal />
    </div>
  )
}
