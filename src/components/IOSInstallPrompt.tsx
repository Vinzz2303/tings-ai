import React, { useState, useEffect } from 'react'

export default function IOSInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Check if device is iOS
    const isIos = () => {
      const userAgent = window.navigator.userAgent.toLowerCase()
      return /iphone|ipad|ipod/.test(userAgent)
    }

    // Check if app is already installed (standalone mode)
    const isStandalone = () => {
      return ('standalone' in window.navigator) && (window.navigator as any).standalone
    }

    // Check if we should show the prompt (not installed + is iOS)
    if (isIos() && !isStandalone()) {
      // Don't show if user previously dismissed it in this session
      if (!sessionStorage.getItem('ios_prompt_dismissed')) {
        setShowPrompt(true)
      }
    }
  }, [])

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-24 md:bottom-8 left-4 right-4 md:left-auto md:right-8 md:w-96 z-[9999] animate-in slide-in-from-bottom-8 duration-500">
      <div className="bg-[#111520]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 relative">
        <button
          onClick={() => {
            sessionStorage.setItem('ios_prompt_dismissed', 'true')
            setShowPrompt(false)
          }}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#080a0f] flex items-center justify-center border border-white/10 shrink-0">
            <img src="/pwa-192x192.png" alt="TINGS AI" className="w-8 h-8 rounded-lg" />
          </div>
          <div className="flex-1 pr-6">
            <h3 className="text-sm font-semibold text-white">Install TINGS AI</h3>
            <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
              Install aplikasi ke Home Screen untuk pengalaman full-screen yang lebih cepat.
            </p>
          </div>
        </div>

        <div className="bg-white/5 rounded-xl p-3 flex items-center justify-center gap-2 text-xs text-slate-300">
          Tap ikon <svg className="w-4 h-4 text-blue-400 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> di bawah, lalu pilih <strong>Add to Home Screen</strong>
        </div>
      </div>
    </div>
  )
}
