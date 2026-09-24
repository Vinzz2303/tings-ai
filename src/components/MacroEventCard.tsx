import React from 'react'
import { AlertCircle, CheckCircle2, MinusCircle, Clock } from 'lucide-react'

export interface MacroEvent {
  id: string
  eventName: string
  date: string
  actual: string
  forecast: string
  previous: string
  status: 'MISS' | 'BEAT' | 'IN_LINE' | 'UPCOMING'
  impact: 'HIGH' | 'MEDIUM' | 'LOW'
  aiVerdict?: string
  affectedAssets?: { symbol: string; direction: 'up' | 'down' | 'neutral' }[]
}

interface Props {
  event: MacroEvent
  isEnglish?: boolean
}

export default function MacroEventCard({ event, isEnglish = false }: Props) {
  const getStatusConfig = () => {
    switch (event.status) {
      case 'BEAT':
        return {
          icon: <CheckCircle2 className="w-4 h-4" />,
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/20',
          label: isEnglish ? 'BEAT' : 'DI ATAS EKSPEKTASI',
        }
      case 'MISS':
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          color: 'text-red-400',
          bg: 'bg-red-500/10',
          border: 'border-red-500/20',
          label: isEnglish ? 'MISS' : 'DI BAWAH EKSPEKTASI',
        }
      case 'IN_LINE':
        return {
          icon: <MinusCircle className="w-4 h-4" />,
          color: 'text-slate-400',
          bg: 'bg-slate-500/10',
          border: 'border-slate-500/20',
          label: isEnglish ? 'IN LINE' : 'SESUAI EKSPEKTASI',
        }
      case 'UPCOMING':
      default:
        return {
          icon: <Clock className="w-4 h-4" />,
          color: 'text-amber-400',
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/20',
          label: isEnglish ? 'UPCOMING' : 'SEGERA',
        }
    }
  }

  const config = getStatusConfig()

  return (
    <div className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.03] transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            {event.impact === 'HIGH' && (
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            )}
            <h4 className="text-sm font-semibold text-slate-200">{event.eventName}</h4>
          </div>
          <p className="text-[11px] text-slate-500 font-mono">{event.date}</p>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${config.bg} ${config.border} ${config.color}`}>
          {config.icon}
          <span className="text-[9px] font-bold tracking-widest uppercase">{config.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="p-3 rounded-xl bg-[#090c13] border border-white/[0.04]">
          <p className="text-[9px] font-mono text-slate-500 mb-1 uppercase tracking-wider">{isEnglish ? 'Actual' : 'Aktual'}</p>
          <p className={`text-sm font-semibold font-mono ${event.status === 'UPCOMING' ? 'text-slate-600' : 'text-slate-200'}`}>
            {event.actual || '-'}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-[#090c13] border border-white/[0.04]">
          <p className="text-[9px] font-mono text-slate-500 mb-1 uppercase tracking-wider">{isEnglish ? 'Forecast' : 'Proyeksi'}</p>
          <p className="text-sm font-semibold font-mono text-slate-400">{event.forecast}</p>
        </div>
        <div className="p-3 rounded-xl bg-[#090c13] border border-white/[0.04]">
          <p className="text-[9px] font-mono text-slate-500 mb-1 uppercase tracking-wider">{isEnglish ? 'Previous' : 'Sebelumnya'}</p>
          <p className="text-sm font-semibold font-mono text-slate-400">{event.previous}</p>
        </div>
      </div>

      {event.aiVerdict && (
        <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.03] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl pointer-events-none rounded-full" />
          <div className="flex items-start gap-3 relative z-10">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-indigo-400">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase mb-1.5">Ting AI Verdict</p>
              <p className="text-xs leading-relaxed text-slate-300">{event.aiVerdict}</p>
              
              {event.affectedAssets && event.affectedAssets.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-indigo-500/10">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider mr-1">{isEnglish ? 'Impact:' : 'Dampak:'}</span>
                  {event.affectedAssets.map((asset) => {
                    const dirConfig = 
                      asset.direction === 'up' ? { color: 'text-emerald-400', icon: '↑' } :
                      asset.direction === 'down' ? { color: 'text-red-400', icon: '↓' } :
                      { color: 'text-slate-400', icon: '↔' }
                    
                    return (
                      <span key={asset.symbol} className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border border-white/[0.05] bg-white/[0.02] ${dirConfig.color}`}>
                        {asset.symbol} {dirConfig.icon}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
