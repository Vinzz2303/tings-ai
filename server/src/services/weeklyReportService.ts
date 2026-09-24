/**
 * weeklyReportService.ts
 * S5-M3: AI Weekly Report — PDF/email otomatis tiap Senin 07.00 WIB
 *
 * Flow:
 * 1. Query semua user aktif (verified)
 * 2. Per user: ambil portfolio holdings dari DB
 * 3. Hitung P&L sederhana (harga entry vs current dari portfolio_price_cache)
 * 4. Generate insight singkat via Gemini/Groq
 * 5. Kirim HTML email via nodemailer
 */

import nodemailer from 'nodemailer'
import axios from 'axios'
import pool from '../db'
import type { RowDataPacket } from 'mysql2'
import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null
const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
const GROQ_API_URL = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant'

// ── Email transporter ──────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT) || 465,
  secure: Number(process.env.EMAIL_PORT) === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

// ── Types ──────────────────────────────────────────────────────────────────────
interface UserRow extends RowDataPacket {
  id: number
  fullname: string
  email: string
  email_verified: number
}

interface HoldingRow extends RowDataPacket {
  symbol: string
  quantity: number
  average_price: number
  currency: string
  latest_price: number | null
}

interface MarketCacheRow extends RowDataPacket {
  symbol: string
  latest_price: number
}

// ── Insight Generator ──────────────────────────────────────────────────────────
async function generateWeeklyInsight(
  userName: string,
  holdings: HoldingRow[],
  language: 'id' | 'en' = 'id'
): Promise<string> {
  if (holdings.length === 0) {
    return language === 'id'
      ? 'Tambahkan aset ke portofolio Anda untuk mendapatkan analisis mingguan yang lebih detail.'
      : 'Add assets to your portfolio to receive a more detailed weekly analysis.'
  }

  // Build a summary of holdings for the prompt
  const holdingSummary = holdings
    .slice(0, 10)
    .map(h => {
      const currentPrice = h.latest_price ?? h.average_price
      const pnlPct = h.average_price > 0
        ? ((currentPrice - h.average_price) / h.average_price) * 100
        : 0
      return `${h.symbol}: avg_price ${h.average_price.toFixed(2)}, current ~${currentPrice.toFixed(2)}, PnL ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%`
    })
    .join('\n')

  const prompt = language === 'id'
    ? `Kamu adalah Ting AI, asisten investasi pribadi. Tulis RINGKASAN MINGGUAN portofolio singkat (maks 3 kalimat) untuk investor bernama ${userName}. Portofolionya:\n${holdingSummary}\n\nFokus pada: 1 insight kunci, 1 risiko yang perlu diperhatikan. Gunakan bahasa santai tapi profesional. JANGAN berikan rekomendasi beli/jual spesifik.`
    : `You are Ting AI, a personal investment assistant. Write a SHORT WEEKLY SUMMARY (max 3 sentences) for an investor named ${userName}. Their portfolio:\n${holdingSummary}\n\nFocus on: 1 key insight, 1 risk to watch. Use casual but professional tone. DO NOT give specific buy/sell recommendations.`

  // Try Gemini first, fallback to Groq
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
      const result = await model.generateContent(prompt)
      return result.response.text().trim()
    } catch (err) {
      console.warn('[WeeklyReport] Gemini failed, trying Groq fallback:', (err as Error).message)
    }
  }

  // Groq fallback
  if (GROQ_API_KEY) {
    try {
      const groqRes = await axios.post(
        GROQ_API_URL,
        {
          model: GROQ_MODEL,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 200,
          temperature: 0.7,
        },
        {
          headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          timeout: 10000,
        }
      )
      const text = groqRes.data?.choices?.[0]?.message?.content?.trim()
      if (text) return text
    } catch (err) {
      console.error('[WeeklyReport] Groq fallback also failed:', (err as Error).message)
    }
  }

  return language === 'id'
    ? 'Analisis AI tidak tersedia minggu ini. Pantau portofolio Anda di Ting AI.'
    : 'AI analysis unavailable this week. Monitor your portfolio on Ting AI.'
}

// ── HTML Email Builder ─────────────────────────────────────────────────────────
function buildWeeklyEmailHtml(
  userName: string,
  holdings: HoldingRow[],
  insight: string,
  weekLabel: string
): string {
  const holdingRows = holdings.slice(0, 10).map(h => {
    const currentPrice = h.latest_price ?? h.average_price
    const pnlPct = h.average_price > 0
      ? ((currentPrice - h.average_price) / h.average_price) * 100
      : 0
    const up = pnlPct >= 0
    return `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #1a1d24;font-family:monospace;color:#e2e8f0;font-size:13px;">${h.symbol}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #1a1d24;text-align:right;color:#94a3b8;font-size:12px;">${h.entry_price.toLocaleString('id-ID')}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #1a1d24;text-align:right;font-size:12px;color:${up ? '#2dd4bf' : '#f87171'};font-weight:bold;">
          ${up ? '+' : ''}${pnlPct.toFixed(2)}%
        </td>
      </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ting AI Weekly Report</title></head>
<body style="margin:0;padding:0;background:#080a0f;font-family:'Segoe UI',system-ui,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    
    <!-- Header -->
    <div style="text-align:center;margin-bottom:40px;">
      <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#14b8a6;margin:0 0 8px;">TING AI</p>
      <h1 style="font-size:24px;font-weight:700;color:#f8fafc;margin:0 0 4px;">Weekly Portfolio Report</h1>
      <p style="font-size:13px;color:#475569;margin:0;">${weekLabel}</p>
    </div>

    <!-- Greeting -->
    <div style="background:#0c0e14;border:1px solid #1e2330;border-radius:16px;padding:24px;margin-bottom:24px;">
      <p style="font-size:14px;color:#94a3b8;margin:0 0 8px;">Halo, <strong style="color:#e2e8f0;">${userName}</strong> 👋</p>
      <p style="font-size:14px;color:#cbd5e1;margin:0;line-height:1.75;">${insight}</p>
    </div>

    <!-- Portfolio Table -->
    ${holdings.length > 0 ? `
    <div style="background:#0c0e14;border:1px solid #1e2330;border-radius:16px;overflow:hidden;margin-bottom:24px;">
      <div style="padding:16px 16px 0;border-bottom:1px solid #1a1d24;">
        <p style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#475569;margin:0 0 12px;">RINGKASAN POSISI</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <thead>
          <tr style="background:#0a0c11;">
            <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#475569;border-bottom:1px solid #1a1d24;">Aset</th>
            <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#475569;border-bottom:1px solid #1a1d24;">Harga Entry</th>
            <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#475569;border-bottom:1px solid #1a1d24;">PnL Est.</th>
          </tr>
        </thead>
        <tbody>${holdingRows}</tbody>
      </table>
    </div>` : ''}

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:40px;">
      <a href="https://tingsai.my.id/explore-intelligence"
        style="display:inline-block;padding:14px 32px;background:#14b8a6;color:#000;font-weight:700;font-size:14px;text-decoration:none;border-radius:12px;">
        Buka Ting AI →
      </a>
    </div>

    <!-- Disclaimer -->
    <div style="border-top:1px solid #1e2330;padding-top:24px;text-align:center;">
      <p style="font-size:11px;color:#334155;line-height:1.6;margin:0;">
        Laporan ini bersifat informatif. Bukan saran investasi.<br>
        Data harga menggunakan estimasi terbaru dari Yahoo Finance.<br><br>
        <a href="https://tingsai.my.id/profile" style="color:#475569;">Kelola preferensi notifikasi</a>
      </p>
    </div>

  </div>
</body>
</html>`
}

// ── Main Export ────────────────────────────────────────────────────────────────
export async function sendWeeklyReports(): Promise<{ sent: number; failed: number; skipped: number }> {
  console.log('[WeeklyReport] Starting weekly report job...')
  let sent = 0, failed = 0, skipped = 0

  const now = new Date()
  const weekLabel = `Minggu ${now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`

  try {
    // 1. Get all verified users
    // NOTE: last_login_at column does not exist in users table, removed filter
    const [users] = await pool.query<UserRow[]>(`
      SELECT id, fullname, email, email_verified
      FROM users
      WHERE email_verified = 1
      LIMIT 500
    `)

    if (!users.length) {
      console.log('[WeeklyReport] No eligible users found.')
      return { sent: 0, failed: 0, skipped: 0 }
    }

    // 2. Process each user
    for (const user of users) {
      try {
        // Get user holdings from DB with latest cached price (portfolio_price_cache JOIN assets_master)
        // portfolio_holdings schema: id, user_id, symbol, quantity, average_price, currency, is_active
        const [holdings] = await pool.query<HoldingRow[]>(`
          SELECT
            ph.symbol,
            ph.quantity,
            ph.average_price,
            ph.currency,
            ppc.latest_price
          FROM portfolio_holdings ph
          LEFT JOIN assets_master am ON am.symbol = ph.symbol AND am.is_active = 1
          LEFT JOIN portfolio_price_cache ppc ON ppc.asset_id = am.id
          WHERE ph.user_id = ?
            AND ph.quantity > 0
            AND ph.is_active = 1
          ORDER BY ph.quantity * ph.average_price DESC
          LIMIT 15
        `, [user.id])

        if (holdings.length === 0) {
          skipped++
          continue
        }

        // Generate AI insight (Gemini with Groq fallback)
        const insight = await generateWeeklyInsight(
          user.fullname || 'Investor',
          holdings,
          'id'
        )

        // Build and send email
        const html = buildWeeklyEmailHtml(
          user.fullname || 'Investor',
          holdings,
          insight,
          weekLabel
        )

        await transporter.sendMail({
          from: process.env.EMAIL_FROM || 'TingAI <noreply@tingsai.my.id>',
          to: user.email,
          subject: `📊 Laporan Portofolio Mingguan Anda — ${weekLabel}`,
          html,
        })

        sent++
        console.log(`[WeeklyReport] Sent to ${user.email} (${holdings.length} holdings)`)

        // Throttle: 1 email per 500ms to avoid SMTP rate limits
        await new Promise(r => setTimeout(r, 500))

      } catch (userErr) {
        failed++
        console.error(`[WeeklyReport] Failed for user ${user.id}:`, userErr)
      }
    }

  } catch (err) {
    console.error('[WeeklyReport] Fatal error:', err)
    failed++
  }

  console.log(`[WeeklyReport] Done: ${sent} sent, ${failed} failed, ${skipped} skipped`)
  return { sent, failed, skipped }
}
