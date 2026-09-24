import React from 'react'
import { useLanguagePreference } from '../utils/language'

export default function CommunityBanner() {
  const { language } = useLanguagePreference()

  return (
    <div className="relative rounded-2xl overflow-hidden border border-sky-500/20 bg-gradient-to-r from-sky-950/40 to-[#0B0D12] p-6 flex flex-col md:flex-row items-center justify-between gap-6 mb-8 group hover:border-sky-500/40 transition-colors">
      <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      
      <div className="relative z-10 flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-sky-500/10 flex items-center justify-center shrink-0 border border-sky-500/20">
          <svg className="w-6 h-6 text-sky-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.664 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
        </div>
        <div>
          <h3 className="text-base font-semibold text-white mb-1">
            {language === 'id' ? 'Jangan Trading Sendirian' : 'Don\'t Trade Alone'}
          </h3>
          <p className="text-sm text-slate-400 max-w-xl">
            {language === 'id' 
              ? 'Gabung dengan Elite Circle TINGS AI di Telegram. Diskusi market real-time, dapatkan alert NFP otomatis, dan kelola psikologi bareng komunitas.'
              : 'Join the TINGS AI Elite Circle on Telegram. Real-time market discussions, automated NFP alerts, and community psychology management.'}
          </p>
        </div>
      </div>
      
      <div className="relative z-10 w-full md:w-auto shrink-0">
        <a 
          href="https://t.me/TINGS_AI_COMMUNITY_WAITLIST" 
          target="_blank" 
          rel="noreferrer"
          className="flex items-center justify-center gap-2 w-full md:w-auto px-5 py-2.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-sm font-semibold rounded-xl border border-sky-500/30 transition-all"
        >
          {language === 'id' ? 'Gabung Telegram' : 'Join Telegram'}
          <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </a>
      </div>
    </div>
  )
}
