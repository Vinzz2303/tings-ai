import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguagePreference } from '../utils/language'

type Props = {
  id: string
  titleId: string
  titleEn: string
  descId: string
  descEn: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

export default function FirstRunTooltip({ 
  id, 
  titleId, 
  titleEn, 
  descId, 
  descEn, 
  placement = 'bottom',
  className = ''
}: Props) {
  const { language } = useLanguagePreference()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const key = `tingai_tooltip_${id}`
    const hasSeen = localStorage.getItem(key)
    
    // We add a small delay to make it feel natural, arriving after page loads
    if (!hasSeen) {
      const timer = setTimeout(() => setIsVisible(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [id])

  const handleDismiss = () => {
    const key = `tingai_tooltip_${id}`
    localStorage.setItem(key, 'true')
    setIsVisible(false)
  }

  const title = language === 'id' ? titleId : titleEn
  const desc = language === 'id' ? descId : descEn
  const dismissText = language === 'id' ? 'Mengerti' : 'Got it'

  // Placement styles mapping
  const placementStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-3',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-3',
    left: 'right-full top-1/2 -translate-y-1/2 mr-3',
    right: 'left-full top-1/2 -translate-y-1/2 ml-3'
  }

  // Pointer styles
  const pointerStyles = {
    top: 'bottom-[-6px] left-1/2 -translate-x-1/2 border-t-teal-500/80 border-l-transparent border-r-transparent border-b-transparent border-solid border-[6px]',
    bottom: 'top-[-6px] left-1/2 -translate-x-1/2 border-b-teal-500/80 border-l-transparent border-r-transparent border-t-transparent border-solid border-[6px]',
    left: 'right-[-6px] top-1/2 -translate-y-1/2 border-l-teal-500/80 border-t-transparent border-b-transparent border-r-transparent border-solid border-[6px]',
    right: 'left-[-6px] top-1/2 -translate-y-1/2 border-r-teal-500/80 border-t-transparent border-b-transparent border-l-transparent border-solid border-[6px]'
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: placement === 'bottom' ? -10 : placement === 'top' ? 10 : 0 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={`absolute z-[100] w-64 md:w-72 ${placementStyles[placement]} ${className}`}
        >
          {/* Tooltip Card */}
          <div className="relative rounded-2xl bg-slate-900/95 border border-teal-500/50 p-4 shadow-[0_8px_32px_rgba(20,184,166,0.25)] backdrop-blur-md">
            {/* The Pointer */}
            <div className={`absolute w-0 h-0 ${pointerStyles[placement]}`} />
            
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-[13px] font-bold text-white leading-tight">
                  <span className="mr-1.5 text-teal-400">✨</span>
                  {title}
                </h4>
                <button 
                  onClick={handleDismiss}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                {desc}
              </p>
              <div className="pt-1 flex justify-end">
                <button
                  onClick={handleDismiss}
                  className="text-[10px] bg-teal-500/20 text-teal-300 font-bold px-3 py-1.5 rounded-lg hover:bg-teal-500/30 transition-all border border-teal-500/30"
                >
                  {dismissText}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
