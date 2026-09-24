import React, { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ParsedRow {
  symbol: string
  quantity: number
  avgPrice: number
  format: 'ajaib' | 'stockbit' | 'manual'
  rawLine: string
  error?: string
}

interface CsvImportModalProps {
  onClose: () => void
  onImport: (rows: ParsedRow[]) => Promise<void>
}

// ── CSV Parsers ────────────────────────────────────────────────────────────────

function detectAndParse(csvText: string): { rows: ParsedRow[]; format: string; errors: number } {
  const lines = csvText.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return { rows: [], format: 'unknown', errors: 0 }

  const header = lines[0].toLowerCase()
  let format = 'unknown'
  let parser: (cols: string[]) => ParsedRow | null

  // Detect Ajaib format: "Kode Saham","Lot","Harga Rata-rata"
  if (header.includes('kode saham') || header.includes('lot') && header.includes('harga')) {
    format = 'Ajaib'
    parser = (cols) => {
      const symbol = cols[0]?.replace(/['"]/g, '').trim().toUpperCase()
      const lot = parseFloat(cols[1]?.replace(/['",.]/g, '').trim())
      const avgPrice = parseFloat(cols[2]?.replace(/['",.]/g, '').trim())
      if (!symbol || isNaN(lot) || isNaN(avgPrice)) return null
      return { symbol: symbol.endsWith('.JK') ? symbol : `${symbol}.JK`, quantity: lot * 100, avgPrice, format: 'ajaib', rawLine: cols.join(',') }
    }
  }
  // Detect Stockbit format: "symbol","quantity","avgPrice" or "kode","qty","harga_beli"
  else if (header.includes('symbol') || header.includes('kode') && header.includes('qty')) {
    format = 'Stockbit'
    const cols = header.split(/[,;]/)
    const symIdx = cols.findIndex(c => c.includes('symbol') || c.includes('kode'))
    const qtyIdx = cols.findIndex(c => c.includes('qty') || c.includes('quantity') || c.includes('lembar') || c.includes('lot'))
    const priceIdx = cols.findIndex(c => c.includes('price') || c.includes('harga') || c.includes('avg'))
    parser = (row) => {
      const symbol = row[symIdx]?.replace(/['"]/g, '').trim().toUpperCase()
      const quantity = parseFloat(row[qtyIdx]?.replace(/['",.]/g, '').trim())
      const avgPrice = parseFloat(row[priceIdx]?.replace(/['",.]/g, '').trim())
      if (!symbol || isNaN(quantity) || isNaN(avgPrice)) return null
      return { symbol: symbol.endsWith('.JK') ? symbol : `${symbol}.JK`, quantity, avgPrice, format: 'stockbit', rawLine: row.join(',') }
    }
  }
  // Generic fallback: try symbol,qty,price
  else {
    format = 'Generic (kolom 1: Kode, 2: Qty/Lot, 3: Harga)'
    parser = (cols) => {
      const symbol = cols[0]?.replace(/['"]/g, '').trim().toUpperCase()
      const qty = parseFloat(cols[1]?.replace(/['",.]/g, '').trim())
      const price = parseFloat(cols[2]?.replace(/['",.]/g, '').trim())
      if (!symbol || isNaN(qty) || isNaN(price)) return null
      return { symbol: symbol.endsWith('.JK') ? symbol : `${symbol}.JK`, quantity: qty, avgPrice: price, format: 'manual', rawLine: cols.join(',') }
    }
  }

  const rows: ParsedRow[] = []
  let errors = 0

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,;]/).map(c => c.trim())
    try {
      const parsed = parser(cols)
      if (parsed && parsed.symbol && parsed.quantity > 0 && parsed.avgPrice > 0) {
        rows.push(parsed)
      } else {
        errors++
        rows.push({ symbol: cols[0] || '?', quantity: 0, avgPrice: 0, format: 'manual', rawLine: lines[i], error: 'Baris tidak valid — nilai kosong atau nol' })
      }
    } catch {
      errors++
    }
  }

  return { rows, format, errors }
}

// ── Modal Component ────────────────────────────────────────────────────────────

export default function CsvImportModal({ onClose, onImport }: CsvImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [detectedFormat, setDetectedFormat] = useState('')
  const [parseError, setParseError] = useState('')
  const [importError, setImportError] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setParseError('File harus berformat .csv')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { rows, format, errors } = detectAndParse(text)
      if (rows.length === 0) {
        setParseError('File CSV tidak bisa dibaca. Pastikan format sesuai Ajaib atau Stockbit.')
        return
      }
      setDetectedFormat(format)
      setParsedRows(rows)
      setParseError('')
      setStep('preview')
    }
    reader.readAsText(file, 'UTF-8')
  }, [])

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const validRows = parsedRows.filter(r => !r.error)
  const errorRows = parsedRows.filter(r => r.error)

  const handleConfirmImport = async () => {
    setStep('importing')
    setImportError('')
    try {
      await onImport(validRows)
      setStep('done')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Gagal import. Coba lagi.')
      setStep('preview')
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="csv-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ background: 'rgba(4, 6, 10, 0.85)', backdropFilter: 'blur(8px)' }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          key="csv-modal"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-xl rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl"
          style={{ background: '#0c0e14' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
            <div>
              <p className="text-[9px] font-mono text-teal-400/70 uppercase tracking-[0.2em] mb-0.5">CSV IMPORT</p>
              <h2 className="text-sm font-semibold text-slate-200">Import Portofolio dari Broker</h2>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.07] text-slate-500 hover:text-white hover:bg-white/[0.08] transition-all flex items-center justify-center text-xs"
            >✕</button>
          </div>

          {/* Body */}
          <div className="p-6">
            {/* STEP: Upload */}
            {step === 'upload' && (
              <div className="space-y-4">
                <div className="text-xs text-slate-500 leading-relaxed">
                  Mendukung format ekspor dari <span className="text-slate-300 font-medium">Ajaib</span> dan <span className="text-slate-300 font-medium">Stockbit</span>.
                  <br />Atau format generic: <span className="font-mono bg-white/[0.04] px-1.5 py-0.5 rounded text-slate-400">Kode, Qty/Lot, Harga Rata-rata</span>
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
                    isDragging
                      ? 'border-teal-500/60 bg-teal-500/[0.06]'
                      : 'border-white/[0.08] hover:border-white/20 hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="text-2xl mb-3">📂</div>
                  <p className="text-sm font-medium text-slate-300">Drag & drop file CSV di sini</p>
                  <p className="text-xs text-slate-600 mt-1">atau klik untuk pilih file</p>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFilePick} />
                </div>

                {parseError && (
                  <div className="p-3 rounded-xl bg-red-500/[0.08] border border-red-500/20 text-xs text-red-400">
                    ⚠️ {parseError}
                  </div>
                )}

                {/* Download template links */}
                <div className="pt-2 border-t border-white/[0.05]">
                  <p className="text-[10px] font-mono text-slate-700 uppercase tracking-widest mb-2">Template CSV</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Di Ajaib: Menu → Portofolio → Ekspor Data<br/>
                    Di Stockbit: Portofolio → Download CSV
                  </p>
                </div>
              </div>
            )}

            {/* STEP: Preview */}
            {step === 'preview' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-mono text-teal-400/80 uppercase tracking-widest">Format: {detectedFormat}</span>
                    <p className="text-sm text-slate-200 mt-0.5">
                      <span className="text-teal-400 font-bold">{validRows.length}</span> posisi siap diimpor
                      {errorRows.length > 0 && <span className="text-red-400 ml-2">· {errorRows.length} baris dilewati</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => { setStep('upload'); setParsedRows([]) }}
                    className="text-[10px] text-slate-600 hover:text-slate-300 transition-colors"
                  >
                    Ganti file ↩
                  </button>
                </div>

                {/* Table preview — first 8 rows */}
                <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-white/[0.03] text-slate-600">
                        <th className="text-left px-4 py-2.5 font-mono tracking-widest text-[9px] uppercase">Kode</th>
                        <th className="text-right px-4 py-2.5 font-mono tracking-widest text-[9px] uppercase">Qty</th>
                        <th className="text-right px-4 py-2.5 font-mono tracking-widest text-[9px] uppercase">Avg Price</th>
                        <th className="text-center px-4 py-2.5 font-mono tracking-widest text-[9px] uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 8).map((row, i) => (
                        <tr key={i} className={`border-t border-white/[0.04] ${row.error ? 'opacity-40' : ''}`}>
                          <td className="px-4 py-2.5 font-semibold text-slate-200">{row.symbol}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-400">{row.quantity.toLocaleString('id-ID')}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-400">
                            {row.avgPrice > 0 ? `Rp ${row.avgPrice.toLocaleString('id-ID')}` : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {row.error
                              ? <span className="text-[9px] text-red-400 font-mono">SKIP</span>
                              : <span className="text-[9px] text-teal-400 font-mono">✓ OK</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedRows.length > 8 && (
                    <div className="px-4 py-2 bg-white/[0.02] text-[10px] text-slate-600 text-center border-t border-white/[0.04]">
                      +{parsedRows.length - 8} baris lainnya
                    </div>
                  )}
                </div>

                {importError && (
                  <div className="p-3 rounded-xl bg-red-500/[0.08] border border-red-500/20 text-xs text-red-400">
                    ⚠️ {importError}
                  </div>
                )}

                <button
                  onClick={handleConfirmImport}
                  disabled={validRows.length === 0}
                  className="w-full py-3 rounded-xl bg-teal-500 text-black font-bold text-sm hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(20,184,166,0.2)]"
                >
                  Import {validRows.length} Posisi ke Portofolio
                </button>
              </div>
            )}

            {/* STEP: Importing */}
            {step === 'importing' && (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="w-10 h-10 rounded-full border-2 border-teal-500/20 border-t-teal-500 animate-spin" />
                <p className="text-sm text-slate-400">Sedang mengimpor {validRows.length} posisi...</p>
              </div>
            )}

            {/* STEP: Done */}
            {step === 'done' && (
              <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                <div className="w-12 h-12 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-xl">✓</div>
                <div>
                  <p className="text-base font-semibold text-slate-200">Import Berhasil!</p>
                  <p className="text-xs text-slate-500 mt-1">{validRows.length} posisi berhasil ditambahkan ke portofolio.</p>
                </div>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-teal-500 text-black font-bold text-sm hover:bg-teal-400 transition-all mt-2"
                >
                  Selesai
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
