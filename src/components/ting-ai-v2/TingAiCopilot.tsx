/**
 * TingAiCopilot.tsx
 * Redesigned for Premium Utilitarian Minimalism
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { FullInsight, AssetWeight, MarketCondition } from '../../engine/insightEngine'
import type { ConfidenceScore } from '../../engine/trustLayer'
import { runCopilotV2, type CopilotResponse } from '../../services/copilotService'
import { normalizeDisplaySymbol } from '../../utils/assetNormalization'
import { useLanguagePreference } from '../../utils/language'
import { getTingAiI18n } from '../../utils/tingAiI18n'
import ReactMarkdown from 'react-markdown'

// ── Minimalist Dark Tokens ──
const C = {
  bg:       '#09090b', // zinc-950
  surface:  '#18181b', // zinc-900
  border:   '#27272a', // zinc-800
  borderHover: '#3f3f46',
  text:     '#e4e4e7', // zinc-200
  muted:    '#a1a1aa', // zinc-400
  faded:    '#71717a', // zinc-500
  accent:   '#3f3f46', // zinc-700
  mono:     "'Geist Mono', 'SF Mono', 'JetBrains Mono', monospace",
  sans:     "'Inter', system-ui, sans-serif",
  serif:    "'Instrument Serif', 'Newsreader', 'Playfair Display', serif",
}

export interface TingAiCopilotProps {
  market: MarketCondition
  portfolio: AssetWeight[]
  trust: ConfidenceScore
  insight: FullInsight
  isPro?: boolean
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  chips?: string[]
  meta?: CopilotResponse['meta']
  image?: string
}

// ── Components ──

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 0' }}>
      <span style={{ fontFamily: C.mono, fontSize: 10, color: C.faded, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        Ting AI is thinking
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
            style={{ width: 4, height: 4, borderRadius: '50%', background: C.muted }}
          />
        ))}
      </div>
    </div>
  )
}

function Chip({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '6px 12px',
        borderRadius: 4,
        border: `1px solid ${hovered ? C.borderHover : C.border}`,
        background: hovered ? C.surface : 'transparent',
        color: hovered ? C.text : C.muted,
        fontFamily: C.mono,
        fontSize: 11,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        opacity: disabled ? 0.5 : 1,
        textAlign: 'left',
      }}
    >
      {normalizeDisplaySymbol(label)}
    </button>
  )
}

function MessageBlock({ msg, onChipClick, t }: { msg: Message; onChipClick: (c: string) => void; t: any }) {
  const isUser = msg.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: isUser ? '0 0 0 24px' : '0 24px 0 0',
        alignItems: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <div style={{
        padding: isUser ? '12px 16px' : '0',
        background: isUser ? C.surface : 'transparent',
        border: isUser ? `1px solid ${C.border}` : 'none',
        borderRadius: isUser ? 8 : 0,
        maxWidth: isUser ? '80%' : '100%',
      }}>
        {isUser ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {msg.image && (
              <img src={msg.image} alt="User Upload" style={{ maxWidth: 300, borderRadius: 4, border: `1px solid ${C.border}` }} />
            )}
            <p style={{
              margin: 0,
              fontFamily: C.sans,
              fontSize: 14,
              lineHeight: 1.7,
              color: C.text,
              whiteSpace: 'pre-line',
              fontWeight: 400,
            }}>
              {msg.content}
            </p>
          </div>
        ) : (
          <div className="prose prose-invert max-w-none" style={{
            margin: 0,
            fontFamily: C.sans,
            fontSize: 14,
            lineHeight: 1.7,
            color: C.text,
            fontWeight: 400,
          }}>
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        )}
      </div>

      {!isUser && msg.meta && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <span style={{ fontFamily: C.mono, fontSize: 9, color: C.faded, letterSpacing: '0.05em' }}>
            {t.basedOnCurrentData}
          </span>
          <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted, letterSpacing: '0.1em' }}>
            {msg.meta.usedTrust} CONFIDENCE
          </span>
        </div>
      )}

      {!isUser && msg.chips && msg.chips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {msg.chips.map(chip => (
            <Chip key={chip} label={chip} onClick={() => onChipClick(chip)} disabled={false} />
          ))}
        </div>
      )}
    </motion.div>
  )
}

export default function TingAiCopilot({ market, portfolio, trust, insight, isPro = false }: TingAiCopilotProps) {
  const { language: hookLang } = useLanguagePreference()
  const lang = hookLang as 'id' | 'en'
  const t = getTingAiI18n(lang)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isTyping])

  const sendMessage = useCallback(async (content: string) => {
    const trimmed = content.trim()
    if (!trimmed || isTyping) return

    if (!isPro) {
      const today = new Date().toDateString()
      const usageKey = `tingai_copilot_usage_${today}`
      const usageCount = parseInt(localStorage.getItem(usageKey) || '0', 10)
      if (usageCount >= 3) {
        setMessages(prev => [...prev, { role: 'assistant', content: lang === 'id' ? 'Batas harian Copilot (3 pesan) telah habis. Upgrade ke Ting AI Pro untuk akses tanpa batas.' : 'Daily Copilot limit reached (3 messages). Upgrade to Ting AI Pro.' }])
        return
      }
      localStorage.setItem(usageKey, (usageCount + 1).toString())
    }

    const currentImage = selectedImage
    setInput('')
    setSelectedImage(null)
    setMessages(prev => [...prev, { role: 'user', content: trimmed, image: currentImage || undefined }])
    setIsTyping(true)

    try {
      const response = await runCopilotV2({
        message: trimmed,
        image: currentImage || undefined,
        lang, mode: 'copilot', market, portfolio, trust, insight,
        messages: messages.map(m => ({ role: m.role, content: m.content, image: m.image })),
      })
      setMessages(prev => [...prev, { role: 'assistant', content: response.text, chips: response.chips, meta: response.meta }])
    } finally {
      setIsTyping(false)
    }
  }, [insight, isTyping, lang, market, messages, portfolio, trust, isPro, selectedImage])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 800
        const MAX_HEIGHT = 800
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width
            width = MAX_WIDTH
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height
            height = MAX_HEIGHT
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8)
        setSelectedImage(compressedBase64)
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div style={{
      width: '100%',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: C.bg,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      
      {/* ── Chat History ── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '40px',
          display: 'flex',
          flexDirection: 'column',
          gap: 32,
          scrollbarWidth: 'none',
        }}
      >
        <AnimatePresence mode="popLayout">
          {isEmpty ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                height: '100%',
                maxWidth: 600,
                margin: '0 auto',
                width: '100%'
              }}
            >
              <h1 style={{ 
                fontFamily: C.serif, 
                fontSize: '2.5rem', 
                fontWeight: 400, 
                color: C.text,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                marginBottom: 16
              }}>
                {lang === 'id' ? 'Selamat datang di Ruang Kerja Anda.' : 'Welcome to your Workspace.'}
              </h1>
              <p style={{ 
                fontFamily: C.sans, 
                fontSize: 14, 
                color: C.muted,
                lineHeight: 1.6,
                marginBottom: 32,
                maxWidth: 480
              }}>
                {t.copilotWelcome}
              </p>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {(isPro ? t.proPromptChips : t.freePromptChips).map((c: string) => (
                  <Chip key={c} label={c} onClick={() => sendMessage(c)} disabled={false} />
                ))}
              </div>
            </motion.div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 40, maxWidth: 800, margin: '0 auto', width: '100%' }}>
              {messages.map((msg, idx) => (
                <MessageBlock key={idx} msg={msg} onChipClick={sendMessage} t={t} />
              ))}
              {isTyping && <TypingIndicator />}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Input Area ── */}
      <div style={{
        padding: '24px 40px',
        borderTop: `1px solid ${C.border}`,
        background: C.bg,
      }}>
        <div style={{
          position: 'relative',
          maxWidth: 800,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          transition: 'border 0.2s ease',
        }}
        onFocus={e => e.currentTarget.style.borderColor = C.borderHover}
        onBlur={e => e.currentTarget.style.borderColor = C.border}
        >
          {selectedImage && (
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <img src={selectedImage} alt="Preview" style={{ height: 60, borderRadius: 4, border: `1px solid ${C.border}` }} />
              <button onClick={() => setSelectedImage(null)} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: 4 }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isTyping}
            placeholder={t.copilotPlaceholder}
            rows={1}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: C.text,
              fontFamily: C.sans,
              fontSize: 14,
              padding: '16px 48px 16px 16px',
              resize: 'none',
              lineHeight: 1.5,
              minHeight: 54,
              opacity: isTyping ? 0.5 : 1,
            }}
          />
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isTyping}
            style={{
              position: 'absolute',
              right: 48,
              bottom: 12,
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              color: selectedImage ? C.text : C.muted,
              border: 'none',
              cursor: isTyping ? 'default' : 'pointer',
              transition: 'color 0.2s ease',
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isTyping}
            style={{
              position: 'absolute',
              right: 12,
              bottom: 12,
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: input.trim() && !isTyping ? C.text : 'transparent',
              color: input.trim() && !isTyping ? C.bg : C.muted,
              border: 'none',
              borderRadius: 4,
              cursor: input.trim() && !isTyping ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <span style={{ fontFamily: C.mono, fontSize: 10, color: C.faded }}>
            {t.insightDisclaimer}
          </span>
        </div>
      </div>

    </div>
  )
}
