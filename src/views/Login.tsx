import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { API_URL } from '../utils/api'
import { persistAuthSession } from '../utils/auth'
import { useLanguagePreference } from '../utils/language'
import type { LoginResponse } from '../types'

const t = {
  en: {
    eyebrow: 'Welcome back',
    title: 'Sign in to Ting AI',
    subtitle: 'Access your Morning Command Center, portfolio workspace, and daily market brief.',
    secure: 'Secure & Protected',
    emailLabel: 'Email address',
    emailPlaceholder: 'Enter your email',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    remember: 'Remember me',
    forgot: 'Forgot password?',
    submit: 'Sign in to Ting AI',
    submitting: 'Signing in...',
    orContinue: 'or continue with',
    noAccount: "Don't have an account?",
    createAccount: 'Create account',
    signupSuccess: 'Account created successfully. Sign in to continue.',
    featureTitle: 'Your AI Co-Pilot for Smarter Investing',
    featureDesc: 'A clarity-first interface that combines macro context, portfolio awareness, and AI-assisted decision support — before you trade.',
    feat1: 'Decision support',
    feat1Desc: 'Data-driven insights with market context',
    feat2: 'Risk & Portfolio Awareness',
    feat2Desc: 'Understand risk before making decisions',
    feat3: 'Real-time Market Context',
    feat3Desc: 'Live market conditions at a glance',
    trust1: 'End-to-end encrypted',
    trust1Desc: 'Bank-level security',
    trust2: 'No data sold',
    trust2Desc: 'Your privacy is our priority',
    trust3: 'Built for retail',
    trust3Desc: 'Simple, sharp, relevant',
    switchLang: 'Switch to Indonesian',
  },
  id: {
    eyebrow: 'Selamat datang kembali',
    title: 'Masuk ke Ting AI',
    subtitle: 'Buka Morning Command Center, workspace portofolio, dan ringkasan pasar hari ini.',
    secure: 'Aman & Terlindungi',
    emailLabel: 'Alamat email',
    emailPlaceholder: 'Masukkan email Anda',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Masukkan password Anda',
    remember: 'Ingat saya',
    forgot: 'Lupa password?',
    submit: 'Masuk ke Ting AI',
    submitting: 'Memproses...',
    orContinue: 'atau lanjutkan dengan',
    noAccount: 'Belum punya akun?',
    createAccount: 'Buat akun baru',
    signupSuccess: 'Akun berhasil dibuat. Silakan masuk untuk melanjutkan.',
    featureTitle: 'AI Copilot untuk Investasi yang Lebih Cerdas',
    featureDesc: 'Interface berbasis kejernihan yang menggabungkan konteks makro, kesadaran portofolio, dan dukungan keputusan berbasis AI — sebelum Anda bertransaksi.',
    feat1: 'Bantuan memahami keputusan',
    feat1Desc: 'Insight berbasis data & konteks pasar',
    feat2: 'Risk & Portfolio Awareness',
    feat2Desc: 'Pahami risiko sebelum mengambil keputusan',
    feat3: 'Real-time Market Context',
    feat3Desc: 'Update kondisi pasar secara real-time',
    trust1: 'Data terenkripsi end-to-end',
    trust1Desc: 'Keamanan tingkat bank',
    trust2: 'Tidak ada data dijual',
    trust2Desc: 'Privasi Anda prioritas kami',
    trust3: 'Dibuat untuk investor ritel',
    trust3Desc: 'Sederhana, cerdas, relevan',
    switchLang: 'Ganti ke Inggris',
  }
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { language, setLanguage } = useLanguagePreference()
  const lang = t[language]

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const loginNotice = new URLSearchParams(location.search).get('signup') === 'success'

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      })
      if (!res.ok) {
        let errorMessage = 'Login gagal'
        try {
          const isJson = res.headers.get('content-type')?.includes('application/json')
          if (isJson) {
            const errorData = await res.json()
            errorMessage = errorData.error || errorMessage
          } else {
            errorMessage = `Server Error (${res.status}): Sistem sedang maintenance.`
          }
        } catch (e) {
          errorMessage = 'Tidak dapat memproses respons server.'
        }
        throw new Error(errorMessage)
      }
      
      let data: LoginResponse
      try {
        data = await res.json()
      } catch (e) {
        throw new Error('Respons server tidak valid.')
      }

      persistAuthSession(data?.token || '', data.user || null)
      navigate('/komando-pagi', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-split-page">
      {/* Left panel */}
      <div className="auth-split-left">
        <div className="auth-split-left-inner">
          <div className="auth-brand">
            <div className="auth-brand-icon">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <path d="M16 2L28 9V23L16 30L4 23V9L16 2Z" stroke="url(#gold-grad)" strokeWidth="1.5" fill="none"/>
                <path d="M16 8L22 12V20L16 24L10 20V12L16 8Z" fill="url(#gold-grad-fill)" opacity="0.6"/>
                <defs>
                  <linearGradient id="gold-grad" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#F5C842"/>
                    <stop offset="1" stopColor="#B8860B"/>
                  </linearGradient>
                  <linearGradient id="gold-grad-fill" x1="10" y1="8" x2="22" y2="24" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#F5C842"/>
                    <stop offset="1" stopColor="#B8860B"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="auth-brand-name">Ting AI</span>
          </div>

          <div className="auth-left-content">
            <h2 className="auth-left-title">{lang.featureTitle}</h2>
            <p className="auth-left-desc">{lang.featureDesc}</p>

            <div className="auth-features">
              <div className="auth-feature-item">
                <div className="auth-feature-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5C842" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                  </svg>
                </div>
                <div>
                  <p className="auth-feature-name">{lang.feat1}</p>
                  <p className="auth-feature-desc">{lang.feat1Desc}</p>
                </div>
              </div>
              <div className="auth-feature-item">
                <div className="auth-feature-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5C842" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <div>
                  <p className="auth-feature-name">{lang.feat2}</p>
                  <p className="auth-feature-desc">{lang.feat2Desc}</p>
                </div>
              </div>
              <div className="auth-feature-item">
                <div className="auth-feature-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5C842" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                </div>
                <div>
                  <p className="auth-feature-name">{lang.feat3}</p>
                  <p className="auth-feature-desc">{lang.feat3Desc}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="auth-chart-decoration">
            <svg viewBox="0 0 320 80" fill="none" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F5C842" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="#F5C842" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d="M0,60 C20,55 40,45 60,42 C80,39 100,50 120,38 C140,26 160,30 180,22 C200,14 220,20 240,15 C260,10 280,18 320,8" stroke="#F5C842" strokeWidth="2" fill="none" opacity="0.7"/>
              <path d="M0,60 C20,55 40,45 60,42 C80,39 100,50 120,38 C140,26 160,30 180,22 C200,14 220,20 240,15 C260,10 280,18 320,8 L320,80 L0,80 Z" fill="url(#chartFill)"/>
            </svg>
          </div>

          <div className="auth-trust-bar">
            <div className="auth-trust-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <div>
                <p className="auth-trust-label">{lang.trust1}</p>
                <p className="auth-trust-sub">{lang.trust1Desc}</p>
              </div>
            </div>
            <div className="auth-trust-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <div>
                <p className="auth-trust-label">{lang.trust2}</p>
                <p className="auth-trust-sub">{lang.trust2Desc}</p>
              </div>
            </div>
            <div className="auth-trust-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              </svg>
              <div>
                <p className="auth-trust-label">{lang.trust3}</p>
                <p className="auth-trust-sub">{lang.trust3Desc}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="auth-split-right">
        <div className="auth-split-right-inner">
          <div className="auth-form-header">
            <button
              type="button"
              className="auth-lang-toggle"
              onClick={() => setLanguage(language === 'en' ? 'id' : 'en')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              {language === 'en' ? 'ID' : 'EN'}
            </button>
            <div className="auth-secure-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              {lang.secure}
            </div>
          </div>

          <div className="auth-form-eyebrow">{lang.eyebrow}</div>
          <h1 className="auth-form-title">{lang.title}</h1>
          <p className="auth-form-subtitle">{lang.subtitle}</p>

          {loginNotice && (
            <div className="auth-notice success">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              {lang.signupSuccess}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form-new" noValidate>
            <div className="auth-field-group">
              <label className="auth-field-label" htmlFor="login-email">{lang.emailLabel}</label>
              <div className="auth-field-wrap">
                <svg className="auth-field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
                <input
                  id="login-email"
                  className="auth-field-input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={lang.emailPlaceholder}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="auth-field-group">
              <label className="auth-field-label" htmlFor="login-password">{lang.passwordLabel}</label>
              <div className="auth-field-wrap">
                <svg className="auth-field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  id="login-password"
                  className="auth-field-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={lang.passwordPlaceholder}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="auth-field-toggle"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="auth-row-options">
              <label className="auth-checkbox-label">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  className="auth-checkbox"
                  id="login-remember"
                />
                <span className="auth-checkbox-custom" />
                {lang.remember}
              </label>
              <Link to="/forgot" className="auth-forgot-link">{lang.forgot}</Link>
            </div>

            {error && (
              <div className="auth-notice error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button className="auth-submit-btn" type="submit" disabled={loading} id="login-submit-btn">
              {loading ? (
                <>
                  <span className="auth-spinner" />
                  {lang.submitting}
                </>
              ) : (
                <>
                  {lang.submit}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </>
              )}
            </button>
          </form>



          <p className="auth-switch-page">
            {lang.noAccount}{' '}
            <Link to="/signup" className="auth-switch-link">
              {lang.createAccount}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
