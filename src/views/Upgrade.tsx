import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { API_URL } from '../utils/api'
import { fetchWithSession, readResponseError } from '../utils/authFetch'
import { useAuthSession } from '../utils/useAuthSession'
import { useLanguagePreference } from '../utils/language'
import { getUpgradeI18n } from '../utils/upgradeI18n'
import type { ProUpgradeStatusResponse, ProUpgradeSubmitResponse } from '../types'

type PaymentStatus = 'idle' | 'pending_upload' | 'under_review' | 'active'

type PaymentDraft = {
  fullName: string
  email: string
  notes: string
  fileName: string
  status: 'draft' | 'pending'
}

const DRAFT_KEY = 'ting-ai-pro-payment-draft'

const readDraft = (): PaymentDraft | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PaymentDraft>
    return {
      fullName: parsed.fullName || '',
      email: parsed.email || '',
      notes: parsed.notes || '',
      fileName: parsed.fileName || '',
      status: parsed.status === 'pending' ? 'pending' : 'draft'
    }
  } catch {
    return null
  }
}

export default function Upgrade() {
  const { user } = useAuthSession()
  const navigate = useNavigate()
  const { language } = useLanguagePreference()
  const t = getUpgradeI18n(language)

  const [proofFile, setProofFile] = useState<File | null>(null)
  const [fullName, setFullName] = useState(user?.fullname || '')
  const [email, setEmail] = useState(user?.email || '')
  const [notes, setNotes] = useState('')
  const [fileName, setFileName] = useState('')
  
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle')
  const [message, setMessage] = useState('')
  
  const [showForm, setShowForm] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [hasViewedPaymentDetail, setHasViewedPaymentDetail] = useState(false)
  
  const [copied, setCopied] = useState(false)

  const isPremium = Boolean(user?.plan && user.plan !== 'free')

  useEffect(() => {
    let active = true

    const sync = async () => {
      if (isPremium) {
        setPaymentStatus('active')
        return
      }

      const draft = readDraft()
      if (draft) {
        setFullName(draft.fullName)
        setEmail(draft.email)
        setNotes(draft.notes)
        setFileName(draft.fileName)
        if (draft.status === 'pending') {
          setPaymentStatus('under_review')
          setStep(3)
        } else {
          setPaymentStatus('pending_upload')
        }
      }

      try {
        const response = await fetchWithSession(`${API_URL}/api/payments/status`)
        if (!response.ok) return
        const data = await response.json()
        const status = data.status
        if (!active) return

        if (!status || status === 'none') {
          setFullName(draft?.fullName || '')
          setEmail(draft?.email || '')
          setNotes(draft?.notes || '')
          setFileName(draft?.fileName || '')
          if (draft?.status === 'pending') {
            setPaymentStatus('pending_upload')
          }
          return
        }
        
        if (status === 'pending') {
          setPaymentStatus('under_review')
          setStep(3)
          setMessage('Pengajuan Pro Anda sudah diterima dan menunggu verifikasi.')
        } else if (status === 'verified') {
          setPaymentStatus('active')
        } else if (status === 'rejected') {
          setPaymentStatus('idle')
        }
      } catch {
        // Keep local draft if backend sync fails.
      }
    }

    void sync()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (showForm && step === 1) {
      setHasViewedPaymentDetail(true)
    }
  }, [showForm, step])

  useEffect(() => {
    if (step === 2 && !hasViewedPaymentDetail) {
      setStep(1)
    }
  }, [step, hasViewedPaymentDetail])

  const saveDraft = (next: PaymentDraft) => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(next))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!fullName.trim() || !email.trim() || !fileName.trim()) {
      setMessage('Lengkapi nama, email, dan bukti pembayaran terlebih dahulu.')
      setPaymentStatus('pending_upload')
      return
    }

    const next: PaymentDraft = {
      fullName: fullName.trim(),
      email: email.trim(),
      notes: notes.trim(),
      fileName,
      status: 'pending'
    }

    saveDraft(next)

    try {
      const formData = new FormData()
      formData.append('full_name', next.fullName)
      formData.append('email', next.email)
      if (next.notes) {
        formData.append('notes', next.notes)
      }
      
      if (proofFile) {
        formData.append('file', proofFile)
      }

      const response = await fetchWithSession(`${API_URL}/api/payments/upload`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(await readResponseError(response, 'Gagal mengirim bukti transfer.'))
      }

      const result = await response.json()
      if (response.status === 201 || result.message) {
        setPaymentStatus('under_review')
        setStep(3)
      } else {
        setPaymentStatus('pending_upload')
      }
      setMessage(result.message || 'Bukti transfer diterima. Ting AI sedang menunggu verifikasi manual.')
    } catch (error) {
      setPaymentStatus('pending_upload')
      setMessage(error instanceof Error ? error.message : 'Gagal mengirim bukti transfer.')
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      setProofFile(null)
      setFileName('')
      return
    }
    setProofFile(file)
    setFileName(file.name)
    setPaymentStatus('pending_upload')
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText('5411301142')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ==========================================
  // PAYMENT FLOW (Steps 1, 2, 3)
  // ==========================================
  if (showForm) {
    return (
      <div className="min-h-screen bg-[#07090E] text-white font-sans selection:bg-indigo-500/30 py-16 px-6">
        <div className="max-w-4xl mx-auto fade-in duration-500" style={{ position: 'relative', zIndex: 1 }}>
          
          <button 
            onClick={() => paymentStatus !== 'under_review' && setShowForm(false)} 
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-8"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            {t.payment.back}
          </button>

          {/* 1. HEADER */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-2">{t.payment.page1Title}</h1>
              <p className="text-slate-400 text-sm">{t.payment.page1Subtitle}</p>
            </div>
            <div className="hidden md:flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
            </div>
          </div>

          {/* 2. STEP INDICATOR */}
          <div className="flex items-center justify-between mb-10 bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6">
            {/* Step 1 */}
            <div className={`flex items-center gap-3 ${step >= 1 ? '' : 'opacity-50'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${step >= 1 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 border border-white/10 text-slate-400'}`}>
                {step > 1 ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> : <span className="font-bold">1</span>}
              </div>
              <div className="hidden sm:block">
                <div className={`text-xs font-semibold uppercase tracking-wider ${step >= 1 ? 'text-emerald-400' : 'text-slate-400'}`}>1. {t.payment.step1}</div>
              </div>
            </div>
            <div className="h-[1px] flex-1 bg-white/[0.05] mx-4" />
            {/* Step 2 */}
            <div className={`flex items-center gap-3 ${step >= 2 ? '' : 'opacity-50'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${step === 2 ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] font-bold' : step > 2 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 border border-white/10 text-slate-400 font-bold'}`}>
                {step > 2 ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> : '2'}
              </div>
              <div className="hidden sm:block">
                <div className={`text-xs font-semibold uppercase tracking-wider ${step === 2 ? 'text-white' : step > 2 ? 'text-emerald-400' : 'text-slate-400'}`}>2. {t.payment.step2}</div>
              </div>
            </div>
            <div className="h-[1px] flex-1 bg-white/[0.05] mx-4" />
            {/* Step 3 */}
            <div className={`flex items-center gap-3 ${step === 3 ? '' : 'opacity-50'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${step === 3 ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] font-bold' : 'bg-white/5 border border-white/10 text-slate-400 font-bold'}`}>
                3
              </div>
              <div className="hidden sm:block">
                <div className={`text-xs font-semibold uppercase tracking-wider ${step === 3 ? 'text-white' : 'text-slate-400'}`}>3. {t.payment.step3}</div>
              </div>
            </div>
          </div>

          {step === 1 && (
            <div className="fade-in duration-500">
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
                <svg className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-sm text-indigo-200">{t.payment.instructionStep1}</p>
              </div>

              {/* PAYMENT DETAIL CARD */}
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8 mb-8">
                <h3 className="text-sm font-medium text-slate-300 mb-6">{t.payment.paymentDetailTitle}</h3>
                <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-600/30">
                      <span className="font-bold tracking-tighter text-xl italic">BCA</span>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{t.payment.accNumber}</div>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-semibold tracking-tight text-white">5411 3011 42</span>
                        <button onClick={copyToClipboard} className="text-slate-400 hover:text-white transition-colors" title={t.payment.copyRekening}>
                          {copied ? (
                            <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                              {t.payment.copied}
                            </span>
                          ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          )}
                        </button>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 uppercase tracking-widest">Faturachman Al-Kahfi</div>
                    </div>
                  </div>

                  <div className="hidden md:block w-[1px] h-16 bg-white/[0.05]" />

                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{t.payment.transferNominal}</div>
                    <div className="text-2xl font-semibold text-indigo-400">{t.pricing.pro.price}</div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button 
                  onClick={() => setStep(2)}
                  className="py-4 px-8 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.2)] hover:shadow-[0_0_30px_rgba(79,70,229,0.4)] flex items-center justify-center gap-2"
                >
                  Lanjut Upload Bukti
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
              </div>
            </div>
          )}

          {(step === 2 || step === 3) && (
            <div style={{ position: 'relative', zIndex: 1 }}>
              <form onSubmit={handleSubmit} className="fade-in duration-500">
                {/* UPLOAD SECTION */}
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8 mb-8">
                <h3 className="text-sm font-medium text-slate-300 mb-6">{t.payment.upload}</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  
                  {/* Left: Drag & drop box — label wraps input for correct click-through */}
                  <div className="relative">
                    <input
                      id="upgrade-proof"
                      className="sr-only"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      disabled={paymentStatus === 'under_review'}
                    />
                    <label
                      htmlFor="upgrade-proof"
                      className={`block h-full min-h-[200px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 text-center transition-colors cursor-pointer ${paymentStatus === 'under_review' ? 'opacity-50 cursor-not-allowed' : ''} ${fileName ? 'border-indigo-500/50 bg-indigo-500/5 hover:bg-indigo-500/10' : 'border-white/10 bg-[#07090E] hover:bg-white/[0.02] hover:border-white/20'}`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${fileName ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/[0.05] text-slate-400'}`}>
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    </div>
                    {fileName ? (
                      <div>
                        <p className="text-sm font-medium text-indigo-300 mb-1 truncate max-w-[200px]">{fileName}</p>
                        <p className="text-xs text-indigo-500/60">{t.payment.uploadDesc}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-slate-300 mb-1">{t.payment.uploadDrop}</p>
                        <p className="text-xs text-slate-500 mb-4">{t.payment.uploadOr}</p>
                        <span className="px-4 py-2 rounded-lg bg-white/5 text-xs font-semibold text-slate-300 border border-white/10">
                          {t.payment.uploadButton}
                        </span>
                        <p className="text-[10px] text-slate-500 mt-4 uppercase tracking-wider">{t.payment.uploadFormat}</p>
                      </div>
                    )}
                    </label>
                  </div>

                  {/* Right: Form inputs */}
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider" htmlFor="upgrade-name">{t.payment.fullName}</label>
                      <input
                        id="upgrade-name"
                        className="w-full bg-[#07090E] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                        type="text"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        placeholder={t.payment.fullName}
                        disabled={paymentStatus === 'under_review'}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider" htmlFor="upgrade-email">{t.payment.email}</label>
                      <input
                        id="upgrade-email"
                        className="w-full bg-[#07090E] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder={t.payment.email}
                        disabled={paymentStatus === 'under_review'}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider" htmlFor="upgrade-notes">{t.payment.notes}</label>
                      <textarea
                        id="upgrade-notes"
                        className="w-full bg-[#07090E] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder={t.payment.notesPlaceholder}
                        rows={2}
                        disabled={paymentStatus === 'under_review'}
                      />
                    </div>
                  </div>

                </div>

                {/* SUBMIT BUTTON */}
                <div className="mt-8 flex gap-4">
                  {step === 2 && (
                    <button 
                      type="button"
                      onClick={() => setStep(1)}
                      className="py-4 px-6 bg-white/[0.05] hover:bg-white/[0.1] text-white font-semibold rounded-xl transition-all"
                    >
                      {t.payment.back}
                    </button>
                  )}
                  <button 
                    type="submit"
                    disabled={paymentStatus === 'under_review'}
                    className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.2)] hover:shadow-[0_0_30px_rgba(79,70,229,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
                  >
                    {paymentStatus === 'under_review' ? t.payment.submitPending : t.payment.submitReady}
                    {paymentStatus !== 'under_review' && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
                  </button>
                </div>
                
                {message && (
                  <div className={`mt-6 p-4 rounded-xl border text-sm font-medium text-center ${paymentStatus === 'under_review' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    {message}
                  </div>
                )}
              </div>
            </form>
          </div>
          )}

          {/* 6. VERIFICATION INFO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-white/[0.05]">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-white/[0.03] flex items-center justify-center text-slate-400 shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-200 mb-1">{t.payment.verificationTitle}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{t.payment.verificationDesc}</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-white/[0.03] flex items-center justify-center text-slate-400 shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-200 mb-1">{t.payment.secureTitle}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{t.payment.secureDesc}</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-white/[0.03] flex items-center justify-center text-slate-400 shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-200 mb-1">{t.payment.supportTitle}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{t.payment.supportDesc}</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    )
  }

  // ==========================================
  // PAGE 2: UPGRADE TO PRO (LANDING)
  // ==========================================
  return (
    <div className="min-h-screen bg-[#07090E] text-white font-sans selection:bg-indigo-500/30 pb-32 pt-24 px-6 overflow-hidden">
      <div className="max-w-5xl mx-auto space-y-24 fade-in duration-700">
        
        {/* 1. HEADER */}
        <header className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center px-3 py-1 mb-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-widest">
            Ting AI Pro
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-5">
            {t.title}
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed">
            {t.subtitle}
          </p>
        </header>

        {/* 2. MAIN SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20 items-center">
          
          {/* LEFT: Value Explanation */}
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] transition-colors hover:bg-white/[0.04]">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20 text-indigo-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div className="font-medium text-slate-200">{t.features[0]}</div>
            </div>
            
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] transition-colors hover:bg-white/[0.04]">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0 border border-purple-500/20 text-purple-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <div className="font-medium text-slate-200">{t.features[1]}</div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] transition-colors hover:bg-white/[0.04]">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 text-emerald-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div className="font-medium text-slate-200">{t.features[2]}</div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] transition-colors hover:bg-white/[0.04]">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20 text-amber-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
              </div>
              <div className="font-medium text-slate-200">{t.features[3]}</div>
            </div>
          </div>

          {/* RIGHT: Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            <div className="absolute -inset-8 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-[3rem] blur-2xl opacity-50 pointer-events-none" />
            
            {/* Free Card */}
            <div className="relative bg-[#0d1117] border border-white/[0.08] rounded-3xl p-6 flex flex-col h-full opacity-80 hover:opacity-100 transition-opacity">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">Free</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold tracking-tight text-white">{t.pricing.free.price}</span>
                </div>
              </div>
              <div className="flex-1 space-y-3 mb-6">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span className="text-slate-400 text-sm">{t.pricing.free.features[0]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span className="text-slate-400 text-sm">{t.pricing.free.features[1]}</span>
                </div>
              </div>
              <button disabled className="w-full py-3 bg-white/[0.05] text-slate-400 text-sm font-semibold rounded-xl cursor-default">
                {t.payment.btnActive}
              </button>
            </div>

            {/* Pro Card */}
            <div className="relative bg-[#111520] border border-indigo-500/30 rounded-3xl p-6 shadow-[0_0_30px_rgba(99,102,241,0.15)] flex flex-col h-full">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-[9px] font-bold uppercase tracking-widest bg-indigo-500 text-white rounded-full whitespace-nowrap">
                {t.payment.recommended}
              </div>
              <div className="mb-6 mt-2">
                <h3 className="text-lg font-semibold text-white mb-2">Pro</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold tracking-tight text-white">{t.pricing.pro.price}</span>
                  <span className="text-slate-500 text-xs">/ bln</span>
                </div>
              </div>
              <div className="flex-1 space-y-3 mb-6">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span className="text-slate-300 text-sm">{t.pricing.pro.features[0]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span className="text-slate-300 text-sm">{t.pricing.pro.features[1]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span className="text-slate-300 text-sm">{t.pricing.pro.features[2]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span className="text-slate-300 text-sm">{t.pricing.pro.features[3]}</span>
                </div>
              </div>
              
              <button 
                onClick={() => {
                  setStep(1)
                  setShowForm(true)
                  navigate('/upgrade')
                }}
                disabled={paymentStatus === 'active'}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {paymentStatus === 'idle' && t.payment.btnIdle}
                {paymentStatus === 'pending_upload' && t.payment.btnPendingUpload}
                {paymentStatus === 'under_review' && t.payment.btnUnderReview}
                {paymentStatus === 'active' && t.payment.btnActive}
                {paymentStatus !== 'active' && paymentStatus !== 'under_review' && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                )}
              </button>
            </div>

          </div>
        </div>

        {/* 4. TRUST SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-white/[0.05]">
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-white/[0.03] flex items-center justify-center text-slate-400 border border-white/[0.05]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div className="font-medium text-slate-300 text-sm">Aman & terpercaya</div>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-white/[0.03] flex items-center justify-center text-slate-400 border border-white/[0.05]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div className="font-medium text-slate-300 text-sm">Bisa dibatalkan</div>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-white/[0.03] flex items-center justify-center text-slate-400 border border-white/[0.05]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
            <div className="font-medium text-slate-300 text-sm">Dukungan prioritas</div>
          </div>
        </div>

      </div>
    </div>
  )
}
