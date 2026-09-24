import React, { Suspense, lazy } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import MobileBottomNav from './components/MobileBottomNav'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ProtectedRoute from './views/ProtectedRoute'
// T4: Eager-loaded (auth + landing — must be instant)
import Login from './views/Login'
import Signup from './views/Signup'
import ForgotPassword from './views/ForgotPassword'
import ResetPassword from './views/ResetPassword'
import VerifyEmail from './views/VerifyEmail'
import TingAiLanding from './views/TingAiLanding'
// T4: Lazy-loaded (heavy views — loaded on demand)
const Dashboard        = lazy(() => import('./views/Dashboard'))
const LifeOS           = lazy(() => import('./views/LifeOS'))
const Profile          = lazy(() => import('./views/Profile'))
const Upgrade          = lazy(() => import('./views/Upgrade'))
const AdminPro         = lazy(() => import('./views/AdminPro'))
const Portfolio        = lazy(() => import('./views/Portfolio'))
const TingAi           = lazy(() => import('./views/TingAi'))
const TingAiTwo        = lazy(() => import('./views/TingAiTwo'))
const KomandoPagiPage  = lazy(() => import('./views/KomandoPagiPage'))
const ExploreIntelligence = lazy(() => import('./views/ExploreIntelligence'))
const DemoPercetakan   = lazy(() => import('./views/DemoPercetakan'))
const DemoSekolah      = lazy(() => import('./views/DemoSekolah'))
const Screener         = lazy(() => import('./views/Screener'))
const DecisionJournalPage = lazy(() => import('./views/DecisionJournalPage'))
const TradeJournalPage    = lazy(() => import('./views/TradeJournalPage'))
const BlogList         = lazy(() => import('./views/BlogList'))
const BlogPost         = lazy(() => import('./views/BlogPost'))
const CV               = lazy(() => import('./views/CV'))
// T4: Personal homepage components — lazy-loaded chunk
const Hero             = lazy(() => import('./components/Hero'))
const FeaturedProduct  = lazy(() => import('./components/FeaturedProduct'))
const Projects         = lazy(() => import('./components/Projects'))
const Founder          = lazy(() => import('./components/Founder'))
const Experience       = lazy(() => import('./components/Experience'))
const Contact          = lazy(() => import('./components/Contact'))
const SystemStack      = lazy(() => import('./components/SystemStack'))
const SystemThinking   = lazy(() => import('./components/SystemThinking'))
const Philosophy       = lazy(() => import('./components/Philosophy'))
const DecisionJournal  = lazy(() => import('./components/DecisionJournal'))
import { useLanguagePreference } from './utils/language'
import { useDocumentMetadata } from './utils/metadata'
import { isPersonalDomain as checkIsPersonalDomain } from './utils/domain'

// T4: PageLoader — shown while lazy chunks are downloading
function PageLoader() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#080a0f',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: '2px solid rgba(20,184,166,0.2)',
          borderTopColor: '#14b8a6',
          animation: 'spin 0.7s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: '10px',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.25)',
        }}
      >
        Loading...
      </span>
    </div>
  )
}

const sections = ['hero', 'system-stack', 'founder', 'experience', 'featured', 'system-flow', 'projects', 'philosophy', 'contact'] as const

function HomePage() {
  React.useEffect(() => {
    const scrollTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }
    scrollTop()
  }, [])

  return (
    <main className="home-page overflow-x-hidden pt-16 md:pt-0">
      
      <Hero sectionId={sections[0]} />
      <SystemStack />
      <Founder />
      <Experience sectionId={sections[3]} />
      <FeaturedProduct sectionId={sections[4]} />
      <SystemThinking />
      <Projects sectionId={sections[6]} />
      <Philosophy />
      <Contact sectionId={sections[8]} />
    </main>
  )
}

function RouteMetadata() {
  const location = useLocation()
  const { language } = useLanguagePreference()

  const metadata = React.useMemo(() => {
    switch (location.pathname) {
      case '/ting-ai':
        return {
          title:
            language === 'en'
              ? 'Ting AI | Macro, Market, and Wealth Intelligence'
              : 'Ting AI | Inteligensi Makro, Pasar, dan Portofolio',
          description:
            language === 'en'
              ? 'Product overview for Ting AI, a market intelligence surface focused on macro context, portfolio visibility, and AI-assisted decision support.'
              : 'Ikhtisar produk Ting AI yang berfokus pada konteks makro, visibilitas portofolio, dan dukungan keputusan berbasis AI.',
          path: '/ting-ai'
        }
      case '/ting-ai-2':
        return {
          title: 'Ting AI 2.0 - AI Financial Intelligence Layer',
          description:
            'Ting AI 2.0 is an AI financial intelligence layer focused on market context, risk awareness, narratives, and portfolio insight before financial decisions.',
          path: '/ting-ai-2'
        }
      case '/login':
        return {
          title: 'Login | Ting AI',
          description:
            'Secure login for Ting AI users to access the Morning Command Center, portfolio workspace, and personal account surfaces.',
          path: '/login',
          robots: 'noindex, nofollow'
        }
      case '/signup':
        return {
          title: 'Create Account | Ting AI',
          description:
            'Create a Ting AI account to access the market brief, portfolio workspace, and personal decision tools.',
          path: '/signup',
          robots: 'noindex, nofollow'
        }
      case '/forgot':
        return {
          title: 'Forgot Password | Ting AI',
          description: 'Reset your Ting AI password and recover access to your account securely.',
          path: '/forgot',
          robots: 'noindex, nofollow'
        }
      case '/reset':
        return {
          title: 'Reset Password | Ting AI',
          description: 'Set a new Ting AI password to restore access to your account.',
          path: '/reset',
          robots: 'noindex, nofollow'
        }
      case '/dashboard':
        return {
          title: language === 'en' ? 'Morning Command Center | Ting AI' : 'Pusat Komando Pagi | Ting AI',
          description:
            language === 'en'
              ? 'Daily cross-asset market summary, macro context, and AI-based reasoning for Ting AI members.'
              : 'Ringkasan pasar harian lintas aset, konteks makro, dan penjelasan AI untuk pengguna Ting AI.',
          path: '/dashboard',
          robots: 'noindex, nofollow'
        }
      case '/portfolio':
        return {
          title: language === 'en' ? 'Portfolio Workspace | Ting AI' : 'Workspace Portofolio | Ting AI',
          description:
            language === 'en'
              ? 'Track holdings, portfolio concentration, and current market value inside Ting AI.'
              : 'Pantau kepemilikan, konsentrasi portofolio, dan nilai pasar terkini di dalam Ting AI.',
          path: '/portfolio',
          robots: 'noindex, nofollow'
        }
      case '/profile':
        return {
          title: language === 'en' ? 'Personal Space | Ting AI' : 'Ruang Personal | Ting AI',
          description:
            language === 'en'
              ? 'Private Ting AI workspace that combines market brief, portfolio context, and personal operational metrics.'
              : 'Workspace privat Ting AI yang menggabungkan ringkasan pasar, konteks portofolio, dan metrik operasional personal.',
          path: '/profile',
          robots: 'noindex, nofollow'
        }
      case '/demo/percetakan':
        return {
          title: 'Demo Percetakan (AI Assistant)',
          description: 'Halaman demo khusus klien percetakan. Tersembunyi dari publik.',
          path: '/demo/percetakan',
          robots: 'noindex, nofollow'
        }
      case '/demo/sekolah':
        return {
          title: 'TING AI Parent Care | Demo',
          description: 'Halaman demo khusus TING AI Parent Care untuk SD IT / SMP IT. Tersembunyi dari publik.',
          path: '/demo/sekolah',
          robots: 'noindex, nofollow'
        }
      case '/upgrade':
        return {
          title: 'Upgrade Pro | Ting AI',
          description: 'Naik ke Ting AI Pro dengan alur manual payment untuk validasi awal.',
          path: '/upgrade',
          robots: 'noindex, nofollow'
        }
      case '/explore-intelligence':
        return {
          title: language === 'en' ? 'Explore Intelligence | Ting AI' : 'Explore Intelligence | Ting AI',
          description: language === 'en'
            ? 'Real market pulse, smart chart, and portfolio relevance — no trading signals.'
            : 'Denyut pasar nyata, grafik cerdas, dan relevansi portofolio — tanpa sinyal trading.',
          path: '/explore-intelligence',
          robots: 'noindex, nofollow'
        }
      case '/komando-pagi':
        return {
          title: 'Komando Pagi | Ting AI',
          description: 'Ringkasan harian kondisi portofolio dan arah pikiran sebelum market bergerak.',
          path: '/komando-pagi',
          robots: 'noindex, nofollow'
        }
      case '/admin/pro':
        return {
          title: 'Admin Pro | Ting AI',
          description: 'Panel admin untuk memantau request Pro, user baru, dan verifikasi manual.',
          path: '/admin/pro',
          robots: 'noindex, nofollow'
        }
      case '/personal-space':
      case '/lifeos':
        return {
          title: language === 'en' ? 'Profile | Ting AI' : 'Profil | Ting AI',
          description:
            language === 'en'
              ? 'Validated account summary for the currently active Ting AI session.'
              : 'Ringkasan akun tervalidasi untuk sesi Ting AI yang sedang aktif.',
          path: '/personal-space',
          robots: 'noindex, nofollow'
        }
      case '/cv':
        return {
          title: 'CV — Faturachman Alkahfi | Full-Stack Engineer & AI Builder',
          description: 'Resume of Faturachman Alkahfi: 500+ users on Ting AI, 3,000+ students served at Universitas Primagraha, 3+ production systems shipped.',
          path: '/cv',
          robots: 'index, follow'
        }
      case '/blog':
        return {
          title: language === 'en' ? 'Blog & Insights | Faturachman Alkahfi' : 'Blog & Wawasan | Faturachman Alkahfi',
          description: language === 'en' 
            ? 'Notes on building AI products, full-stack systems, and financial abstractions.'
            : 'Catatan tentang membangun produk AI, sistem full-stack, dan abstraksi finansial.',
          path: '/blog',
          robots: 'index, follow'
        }
      default:
        const isPersonal = checkIsPersonalDomain()
        if (!isPersonal) {
          return {
            title:
              language === 'en'
                ? 'Ting AI | Macro, Market, and Wealth Intelligence'
                : 'Ting AI | Inteligensi Makro, Pasar, dan Portofolio',
            description:
              language === 'en'
                ? 'Product overview for Ting AI, a market intelligence surface focused on macro context, portfolio visibility, and AI-assisted decision support.'
                : 'Ikhtisar produk Ting AI yang berfokus pada konteks makro, visibilitas portofolio, dan dukungan keputusan berbasis AI.',
            path: '/'
          }
        }
        return {
          title: 'Faturachman Alkahfi | AI Specialist & Full-Stack Architect Indonesia',
          description:
            'Portfolio of Faturachman Alkahfi, an AI Specialist and Full-Stack Architect based in Indonesia. Specializing in real AI systems, LLM orchestration, and production-ready architectures, beyond just vibecoding.',
          path: '/'
        }
    }
  }, [language, location.pathname])

  useDocumentMetadata(metadata)

  React.useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return null
}

const STANDALONE_PATHS = ['/login', '/signup', '/forgot', '/reset', '/verify-email', '/ting-ai', '/cv', '/demo', '/screener']

function AppShell() {
  const location = useLocation()
  
  // Domain router logic: If not on faturachman.my.id, default '/' to Ting AI Landing
  const isPersonal = checkIsPersonalDomain()
  const isTingAiRoot = !isPersonal && location.pathname === '/'

  // Redirect personal portfolio pages to faturachman.my.id if accessed via Ting AI domain
  if (!isPersonal) {
    const isPortfolioRoute = ['/blog'].some(p => location.pathname.startsWith(p))
    if (isPortfolioRoute) {
      window.location.href = `https://faturachman.my.id${location.pathname}${location.search}`
      return null
    }
  }

  const isStandalone = STANDALONE_PATHS.some(p => location.pathname.startsWith(p)) || isTingAiRoot

  if (isStandalone) {
    return (
      <>
        <RouteMetadata />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot" element={<ForgotPassword />} />
            <Route path="/reset" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/screener" element={<Screener />} />
            <Route path="/ting-ai" element={<TingAi />} />
            <Route path="/cv" element={isPersonal ? <CV /> : <Navigate to="/" replace />} />
            <Route path="/demo/percetakan" element={<DemoPercetakan />} />
            <Route path="/demo/sekolah" element={<DemoSekolah />} />
            {isTingAiRoot && <Route path="/" element={<TingAiLanding />} />}
          </Routes>
        </Suspense>
        {/* No MobileBottomNav for /cv — it's a print page */}
        {location.pathname !== '/cv' && <MobileBottomNav />}
      </>
    )
  }

  return (
    <div className="app pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
      <Navbar />
      <RouteMetadata />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={isPersonal ? <HomePage /> : <Navigate to="/" replace />} />
          <Route path="/ting-ai-2" element={<Navigate to="/explore-intelligence" replace />} />
          <Route path="/decision-briefing" element={<Navigate to="/explore-intelligence" replace />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/personal-space"
            element={
              <ProtectedRoute>
                <LifeOS />
              </ProtectedRoute>
            }
          />
          <Route path="/lifeos" element={<Navigate to="/personal-space" replace />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upgrade"
            element={
              <ProtectedRoute>
                <Upgrade />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/pro"
            element={
              <ProtectedRoute>
                <AdminPro />
              </ProtectedRoute>
            }
          />
          <Route
            path="/portfolio"
            element={
              <ProtectedRoute>
                <Portfolio />
              </ProtectedRoute>
            }
          />
          <Route
            path="/explore-intelligence"
            element={
              <ProtectedRoute>
                <ExploreIntelligence />
              </ProtectedRoute>
            }
          />
          <Route
            path="/decision-journal"
            element={
              <ProtectedRoute>
                <DecisionJournalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/morning-command"
            element={
              <ProtectedRoute>
                <KomandoPagiPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/komando-pagi"
            element={
              <ProtectedRoute>
                <KomandoPagiPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trade-journal"
            element={
              <ProtectedRoute>
                <TradeJournalPage />
              </ProtectedRoute>
            }
          />
          <Route path="/blog" element={isPersonal ? <BlogList /> : <Navigate to="/" replace />} />
          <Route path="/blog/:slug" element={isPersonal ? <BlogPost /> : <Navigate to="/" replace />} />
          <Route path="/cv" element={isPersonal ? <CV /> : <Navigate to="/" replace />} />
          <Route path="*" element={isPersonal ? <HomePage /> : <Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Footer />
      <MobileBottomNav />
    </div>
  )
}

import IOSInstallPrompt from './components/IOSInstallPrompt'

export default function App() {
  return (
    <>
      <AppShell />
      <IOSInstallPrompt />
    </>
  )
}
