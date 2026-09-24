import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { clearAuth } from '../utils/auth'
import { useAuthSession } from '../utils/useAuthSession'
import { useLanguagePreference } from '../utils/language'
import { isPersonalDomain } from '../utils/domain'

type AccountState = {
  fullname: string
  email: string
  authenticated: boolean
}

const formatInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('')

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [productOpen, setProductOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const { authenticated, user } = useAuthSession()
  const { language, setLanguage } = useLanguagePreference()
  const navigate = useNavigate()
  const location = useLocation()
  const productMenuRef = useRef<HTMLDivElement | null>(null)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)
  const isHome = location.pathname === '/'
  const isPersonal = isPersonalDomain()
  const account: AccountState = {
    fullname: user?.fullname || '',
    email: user?.email || '',
    authenticated
  }

  const greetName = useMemo(() => {
    if (!account.authenticated || !account.fullname) return ''
    const cleaned = account.fullname.trim()
    if (!cleaned) return ''
    const first = cleaned.split(/\s+/)[0]
    return first || cleaned
  }, [account.authenticated, account.fullname])

  const initials = useMemo(
    () => formatInitials(account.authenticated ? account.fullname : ''),
    [account.authenticated, account.fullname]
  )
  const isAdmin = account.email.toLowerCase() === 'faturachmanalkahfi7@gmail.com'

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (productMenuRef.current && !productMenuRef.current.contains(target)) {
        setProductOpen(false)
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setAccountOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [])

  const closeAll = () => {
    setOpen(false)
    setProductOpen(false)
    setAccountOpen(false)
  }

  const handleLogout = () => {
    clearAuth()
    closeAll()
    navigate('/login', { replace: true })
  }

  const handleSwitchAccount = () => {
    clearAuth()
    closeAll()
    navigate('/login', { replace: true })
  }

  const isEnglish = language === 'en'
  const navText = {
    explore: isEnglish ? 'Explore' : 'Jelajahi',
    product: isEnglish ? 'Ting AI Product' : 'Produk Ting AI',
    account: isEnglish ? 'Account' : 'Akun',
    tingAi: 'Ting AI',
    projects: isEnglish ? 'Projects' : 'Proyek',
    blog: 'Blog',
    resume: 'Resume',
    contact: isEnglish ? 'Contact' : 'Kontak',
    switchLang: isEnglish ? 'EN | switch to ID' : 'ID | switch to EN',
    openProduct: isEnglish ? 'Open Ting AI' : 'Buka Ting AI',
    login: isEnglish ? 'Login to Ting AI' : 'Masuk ke Ting AI',
    create: isEnglish ? 'Create Account' : 'Buat Akun',
    profile: isEnglish ? 'Profile' : 'Profil'
  }

  const productMenu = isEnglish
    ? [
        { title: 'Morning Command', desc: 'Start with today\'s market and risk briefing.', to: account.authenticated ? '/komando-pagi' : '/login', recommended: true },
        { title: 'Portfolio Workspace', desc: 'Read portfolio exposure, decision framing, and risk simulation.', to: account.authenticated ? '/portfolio' : '/login', recommended: true },
        { title: 'Explore Intelligence', desc: 'Market pulse, smart chart, and portfolio relevance in one place.', to: account.authenticated ? '/explore-intelligence' : '/login' },
        { title: 'Ting AI Copilot', desc: 'Your calm thinking companion for market context.', to: account.authenticated ? '/ting-ai' : '/login' },
        { title: 'Personal Space', desc: 'Manage your profile and investing context.', to: account.authenticated ? '/personal-space' : '/login' }
      ]
    : [
        { title: 'Komando Pagi', desc: 'Mulai dari briefing market dan risiko hari ini.', to: account.authenticated ? '/komando-pagi' : '/login', recommended: true },
        { title: 'Workspace Portofolio', desc: 'Baca eksposur, arah keputusan, dan simulasi risiko.', to: account.authenticated ? '/portfolio' : '/login', recommended: true },
        { title: 'Explore Intelligence', desc: 'Denyut pasar, grafik cerdas, dan relevansi portofolio dalam satu tempat.', to: account.authenticated ? '/explore-intelligence' : '/login' },
        { title: 'Ting AI Copilot', desc: 'Partner berpikir untuk membaca konteks market.', to: account.authenticated ? '/ting-ai' : '/login' },
        { title: 'Ruang Personal', desc: 'Kelola profil dan konteks investasimu.', to: account.authenticated ? '/personal-space' : '/login' }
      ]

  const isTingAiApp = ['/portfolio', '/ting-ai', '/komando-pagi', '/explore-intelligence'].includes(location.pathname)

  // ── Icon helpers ───────────────────────────────────────────────────
  const HomeIcon = () => (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
  const BoltIcon = () => (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
  const FolderIcon = () => (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
  const BookIcon = () => (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  )
  const MailIcon = () => (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
  const GlobeIcon = () => (
    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
      <path d="M2 12h20"/>
    </svg>
  )
  const ArrowIcon = () => (
    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  )

  if (isPersonal) {
    return (
      <>
        {/* ── Floating Pill Navbar (desktop ≥768px) ─────────────── */}
        <header className="hidden md:block">
          <nav className="navbar-pill">
            {/* Brand mark */}
            <Link to="/" onClick={closeAll} className="navbar-pill-brand">
              FA<span style={{ color: 'var(--accent)' }}>.</span>
            </Link>
            <div className="navbar-pill-divider" />

            {/* Nav links */}
            <Link to="/" onClick={closeAll} className={`navbar-pill-link ${location.pathname === '/' ? 'active' : ''}`}>
              <HomeIcon /> Home
            </Link>
            <Link to={isHome ? '#founder' : '/#founder'} onClick={closeAll} className="navbar-pill-link">
              <BookIcon /> {isEnglish ? 'About' : 'Tentang'}
            </Link>
            <Link to={isHome ? '#experience' : '/#experience'} onClick={closeAll} className="navbar-pill-link">
              <BoltIcon /> {isEnglish ? 'Experience' : 'Pengalaman'}
            </Link>
            <Link to={isHome ? '#projects' : '/#projects'} onClick={closeAll} className="navbar-pill-link">
              <FolderIcon /> {navText.projects}
            </Link>
            <a href="https://tingsai.my.id" target="_blank" rel="noreferrer" onClick={closeAll} className="navbar-pill-link">
              <GlobeIcon /> Ting AI
            </a>
            <Link to={isHome ? '#contact' : '/#contact'} onClick={closeAll} className="navbar-pill-link">
              <MailIcon /> {navText.contact}
            </Link>
            <Link
              to="/cv"
              onClick={closeAll}
              className="navbar-pill-link"
              style={{ color: 'var(--accent)', fontWeight: 600 }}
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              CV
            </Link>

            <div className="navbar-pill-divider" />

            {/* Language toggle */}
            <button
              type="button"
              onClick={() => setLanguage(isEnglish ? 'id' : 'en')}
              className="navbar-pill-link"
              title={isEnglish ? 'Switch to Bahasa Indonesia' : 'Switch to English'}
            >
              <GlobeIcon />
              <span className="text-[10px] font-mono tracking-wider uppercase">{isEnglish ? 'EN' : 'ID'}</span>
            </button>
          </nav>
        </header>

        {/* ── Mobile top-bar (<768px) ──────────────────────────── */}
        <header className="navbar w-full md:hidden">

          <div className="container-saas nav-inner">
            <div className="brand-wrap">
              <Link className="brand-link" to="/" onClick={closeAll}>
                <img className="brand-logo" src="/ting-ai-logo-navbar-final.png" alt="logo" width="40" height="40" />
                <div className="brand-copy">
                  <span className="brand">Faturachman Alkahfi</span>
                  <span className="brand-sub">AI Product Builder</span>
                </div>
              </Link>
            </div>
            <button className="nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen(prev => !prev)}>
              <span /><span /><span />
            </button>
            <nav className={open ? 'open' : ''}>
              <div className="nav-primary">
                <span className="nav-mobile-label">{navText.explore}</span>
                <Link to={isHome ? '#founder' : '/#founder'} onClick={closeAll}>{isEnglish ? 'About' : 'Tentang'}</Link>
                <Link to={isHome ? '#experience' : '/#experience'} onClick={closeAll}>{isEnglish ? 'Experience' : 'Pengalaman'}</Link>
                <Link to={isHome ? '#projects' : '/#projects'} onClick={closeAll}>{navText.projects}</Link>
                <a href="https://tingsai.my.id" target="_blank" rel="noreferrer" className="nav-link-button" onClick={closeAll}>Ting AI</a>
                <a href="/faturachman-alkahfi-resume.pdf" target="_blank" rel="noreferrer" onClick={closeAll}>{navText.resume}</a>
                <Link to={isHome ? '#contact' : '/#contact'} onClick={closeAll}>{navText.contact}</Link>
              </div>
              <div className="nav-secondary flex items-center gap-6">
                <button type="button" className="nav-language-toggle" onClick={() => setLanguage(isEnglish ? 'id' : 'en')}>{navText.switchLang}</button>
              </div>
            </nav>
          </div>
        </header>
      </>
    )
  }

  // ── Ting AI app domain: legacy top-bar navbar ──────────────────────
  return (
    <>
    <header className="navbar w-full">
      <div className="container-saas nav-inner">
        <div className="brand-wrap">
          <Link className="brand-link" to="/" onClick={closeAll}>
            <img className="brand-logo" src="/ting-ai-logo-navbar-final.png" alt="Ting AI mark" width="40" height="40" />
            <div className="brand-copy">
              <span className="brand">Ting AI</span>
              <span className="brand-sub">Macro &amp; Wealth Intelligence</span>
            </div>
          </Link>
        </div>
        <button className="nav-toggle !flex xl:!hidden" type="button" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen(prev => !prev)}>
          <span /><span /><span />
        </button>
        <nav className="hidden xl:flex">
          <div className="nav-primary">
            <span className="nav-mobile-label">{isEnglish ? 'Navigation' : 'Navigasi'}</span>
            {!account.authenticated && <Link to="/" onClick={closeAll}>Home</Link>}
            {account.authenticated ? (
              <>
                <Link to="/komando-pagi" onClick={closeAll}>{isEnglish ? 'Morning Command' : 'Komando Pagi'}</Link>
                <Link to="/portfolio" onClick={closeAll}>{isEnglish ? 'Portfolio' : 'Portofolio'}</Link>
                <Link to="/explore-intelligence" onClick={closeAll}>Explore</Link>
                <Link to="/decision-journal" onClick={closeAll}>{isEnglish ? 'Decision Journal' : 'Jurnal Keputusan'}</Link>
                <Link to="/trade-journal" onClick={closeAll}>{isEnglish ? 'Trade Journal' : 'Jurnal Trading'}</Link>
                <Link to="/ting-ai" onClick={closeAll}>Copilot</Link>
                <Link to="/personal-space" onClick={closeAll}>{isEnglish ? 'Personal Space' : 'Ruang Personal'}</Link>
              </>
            ) : (
              <Link to="/explore-intelligence" onClick={closeAll}>Explore</Link>
            )}
          </div>
          <div className="nav-secondary flex items-center gap-6">
            <button type="button" className="nav-language-toggle" onClick={() => setLanguage(isEnglish ? 'id' : 'en')} aria-label="Toggle language">{navText.switchLang}</button>
            <div className={`nav-dropdown nav-account ${accountOpen ? 'open' : ''}`} ref={accountMenuRef}>
              <span className="nav-mobile-label">{navText.account}</span>
              <button className="nav-account-btn" type="button" onClick={() => setAccountOpen(p => !p)}>
                <span className="nav-account-avatar">{initials || 'G'}</span>
                <span className="nav-account-name">{account.authenticated ? navText.profile : navText.account}</span>
              </button>
              <div className={`nav-dropdown-menu nav-account-menu ${accountOpen ? 'show' : ''}`} role="menu">
                {account.authenticated ? (
                  <>
                    <div className="nav-account-summary">
                      {greetName && <span className="nav-account-greet">{isEnglish ? 'Hi' : 'Hai'}, {greetName}</span>}
                      <span className="nav-account-summary-name">{account.fullname}</span>
                      <span className="nav-account-summary-email">{account.email || '-'}</span>
                    </div>
                    <Link to="/profile" onClick={closeAll}>{navText.profile}</Link>
                    {isAdmin && <Link to="/admin/pro" onClick={closeAll}>Admin Pro</Link>}
                    <div className="nav-account-divider" />
                    <a href="https://github.com/Vinzz2303" target="_blank" rel="noreferrer">GitHub</a>
                    <div className="nav-account-divider" />
                    <button type="button" className="nav-menu-action" onClick={handleSwitchAccount}>{isEnglish ? 'Switch Account' : 'Ganti Akun'}</button>
                    <button type="button" className="nav-menu-action danger" onClick={handleLogout}>{isEnglish ? 'Logout' : 'Keluar'}</button>
                  </>
                ) : (
                  <>
                    <div className="nav-account-summary">
                      <span className="nav-account-greet">{isEnglish ? 'Welcome' : 'Selamat datang'}</span>
                      <span className="nav-account-summary-name">{isEnglish ? 'Guest Account' : 'Akun Tamu'}</span>
                    </div>
                    <Link to="/login" onClick={closeAll}>{isEnglish ? 'Login' : 'Masuk'}</Link>
                    <Link to="/signup" onClick={closeAll}>{navText.create}</Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </nav>
      </div>
    </header>

    {/* ── Mobile Fullscreen Overlay (<768px) ──────────────────────── */}
    {open && (
      <div
        className="xl:hidden"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: '#0b0d12',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Top bar: Logo + Close ───────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/ting-ai-logo-navbar-final.png" alt="Ting AI" width="28" height="28" style={{ borderRadius: 8 }} />
            <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem', letterSpacing: '0.02em' }}>Ting AI</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable middle (nav links) ──────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>

          {/* NAV SECTION */}
          <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.18em', fontFamily: 'monospace', marginBottom: '0.5rem' }}>Navigation</p>

          {!account.authenticated && (
            <Link to="/" onClick={closeAll} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.6rem', fontWeight: 500, color: 'rgba(255,255,255,0.88)', padding: '0.75rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none' }}>
              Home <ArrowIcon />
            </Link>
          )}
          {account.authenticated ? (
            <>
              <Link to="/komando-pagi" onClick={closeAll} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.6rem', fontWeight: 500, color: 'rgba(255,255,255,0.88)', padding: '0.75rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none' }}>
                {isEnglish ? 'Morning Command' : 'Komando Pagi'} <ArrowIcon />
              </Link>
              <Link to="/portfolio" onClick={closeAll} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.6rem', fontWeight: 500, color: 'rgba(255,255,255,0.88)', padding: '0.75rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none' }}>
                {isEnglish ? 'Portfolio' : 'Portofolio'} <ArrowIcon />
              </Link>
              <Link to="/explore-intelligence" onClick={closeAll} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.6rem', fontWeight: 500, color: 'rgba(255,255,255,0.88)', padding: '0.75rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none' }}>
                Explore <ArrowIcon />
              </Link>
              <Link to="/decision-journal" onClick={closeAll} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.6rem', fontWeight: 500, color: 'rgba(255,255,255,0.88)', padding: '0.75rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none' }}>
                {isEnglish ? 'Decision Journal' : 'Jurnal Keputusan'} <ArrowIcon />
              </Link>
              <Link to="/trade-journal" onClick={closeAll} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.6rem', fontWeight: 500, color: 'rgba(255,255,255,0.88)', padding: '0.75rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none' }}>
                {isEnglish ? 'Trade Journal' : 'Jurnal Trading'} <ArrowIcon />
              </Link>
              <Link to="/ting-ai" onClick={closeAll} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.6rem', fontWeight: 500, color: 'rgba(255,255,255,0.88)', padding: '0.75rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none' }}>
                Copilot <ArrowIcon />
              </Link>
              <Link to="/personal-space" onClick={closeAll} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.6rem', fontWeight: 500, color: 'rgba(255,255,255,0.88)', padding: '0.75rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none' }}>
                {isEnglish ? 'Personal Space' : 'Ruang Personal'} <ArrowIcon />
              </Link>
            </>
          ) : (
            <Link to="/explore-intelligence" onClick={closeAll} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.6rem', fontWeight: 500, color: 'rgba(255,255,255,0.88)', padding: '0.75rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none' }}>
              Explore <ArrowIcon />
            </Link>
          )}

          {/* SETTINGS SECTION */}
          <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.18em', fontFamily: 'monospace', marginTop: '2rem', marginBottom: '0.5rem' }}>Settings</p>
          <button
            type="button"
            onClick={() => { setLanguage(isEnglish ? 'id' : 'en'); closeAll(); }}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.6rem', fontWeight: 500, color: 'rgba(255,255,255,0.88)', padding: '0.75rem 0', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            {navText.switchLang} <GlobeIcon />
          </button>

        </div>

        {/* ── Bottom pinned: account info + actions ────────────── */}
        <div style={{ flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.08)', padding: '1.25rem 1.5rem' }}>
          {account.authenticated ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', flexShrink: 0 }}>
                  {initials || 'G'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{account.fullname}</span>
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{account.email}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Link to="/profile" onClick={closeAll} style={{ flex: 1, padding: '0.8rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, textAlign: 'center', fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.88)', textDecoration: 'none' }}>
                  {navText.profile}
                </Link>
                <button type="button" onClick={handleLogout} style={{ flex: 1, padding: '0.8rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 14, fontSize: '0.82rem', fontWeight: 600, color: '#f87171', cursor: 'pointer' }}>
                  {isEnglish ? 'Logout' : 'Keluar'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Link to="/login" onClick={closeAll} style={{ flex: 1, padding: '0.9rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, textAlign: 'center', fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.88)', textDecoration: 'none' }}>
                {isEnglish ? 'Login' : 'Masuk'}
              </Link>
              <Link to="/signup" onClick={closeAll} style={{ flex: 1, padding: '0.9rem', background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.2)', borderRadius: 14, textAlign: 'center', fontSize: '0.82rem', fontWeight: 600, color: '#2dd4bf', textDecoration: 'none' }}>
                {navText.create}
              </Link>
            </div>
          )}
        </div>
      </div>
    )}
    </>
  )
}
