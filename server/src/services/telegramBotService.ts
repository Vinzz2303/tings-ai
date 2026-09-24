/**
 * telegramBotService.ts
 * 
 * Robust Telegram Bot Service for Portfolio Backend (TingAI Morning Command)
 * Uses native Node.js fetch (Node 18+) for long-polling instead of node-telegram-bot-api
 * polling, which is known to EFATAL on network recovery in Node 26.
 *
 * Architecture: Manual long-poll loop with exponential backoff reconnect.
 */

import { getMarketNews } from './marketNewsService'
import { resolveMarketQuotes } from './marketQuoteService'
import { getFxRate } from './fxAdapter'
import { sendChatWithFallback, ChatMessage } from './chatProvider'

const TELEGRAM_API = 'https://api.telegram.org'
const POLL_TIMEOUT = 20        // seconds (Telegram long-poll window)
const CONNECT_TIMEOUT_MS = 30_000
const MAX_RECONNECT_ATTEMPTS = 20
const BASE_RECONNECT_DELAY_MS = 5_000
const MAX_RECONNECT_DELAY_MS = 5 * 60_000  // 5 minutes

// ── State ─────────────────────────────────────────────────────────────────
let pollingActive = false
let abortController: AbortController | null = null
let reconnectAttempts = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let botUsername = ''
let lastUpdateId = 0

// ── Telegram API helpers ──────────────────────────────────────────────────
function getToken(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN
}

async function telegramCall(
  token: string,
  method: string,
  body?: Record<string, unknown>,
  signal?: AbortSignal
): Promise<any> {
  const url = `${TELEGRAM_API}/bot${token}/${method}`
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Telegram ${method} failed: ${res.status} ${text.slice(0, 200)}`)
  }
  const json = await res.json()
  if (!json.ok) {
    throw new Error(`Telegram ${method} error: ${JSON.stringify(json.description || json)}`)
  }
  return json.result
}

// ── Reconnect logic ───────────────────────────────────────────────────────
function scheduleReconnect(reason: string) {
  if (!pollingActive) return
  if (reconnectTimer) clearTimeout(reconnectTimer)

  reconnectAttempts++
  const delay = Math.min(BASE_RECONNECT_DELAY_MS * Math.pow(1.5, reconnectAttempts - 1), MAX_RECONNECT_DELAY_MS)
  console.log(`[TelegramBot] ${reason} — reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempts})`)

  reconnectTimer = setTimeout(() => {
    if (pollingActive) startPollingLoop()
  }, delay)
}

// ── Message handler ───────────────────────────────────────────────────────
async function handleUpdate(token: string, update: any) {
  const msg = update.message
  if (!msg || !msg.text) return

  const chatId = msg.chat.id
  const text: string = msg.text

  if (text.startsWith('/start')) {
    await telegramCall(token, 'sendMessage', {
      chat_id: chatId,
      text: `Halo! Ting AI Bot siap bertugas. Chat ID ini adalah: ${chatId}\n\nMasukkan ID ini ke TELEGRAM_CHAT_ID di .env backend.`,
    }).catch(err => console.error('[TelegramBot] sendMessage error:', err.message))
  } else if (text.startsWith('/pagi')) {
    await telegramCall(token, 'sendMessage', { chat_id: chatId, text: 'Memproses Komando Pagi... ⏳' }).catch(() => {})
    const ok = await sendMorningCommandToGroup()
    if (!ok) {
      await telegramCall(token, 'sendMessage', {
        chat_id: chatId,
        text: 'Gagal mengambil data pasar. Coba lagi nanti.',
      }).catch(() => {})
    }
  } else {
    console.log(`[TelegramBot] Received message in chat ${chatId}: ${text.slice(0, 80)}`)
    
    // Send typing action
    await telegramCall(token, 'sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {})
    
    const messages: ChatMessage[] = [
      { 
        role: 'system', 
        content: 'Anda adalah Ting AI, asisten trading pintar dari Indonesia. Jawab pertanyaan pengguna dengan ringkas, tajam, dan sertakan kalimat "**Disclaimer:** Keputusan investasi ada di tangan trader." di awal. Anda ahli dalam saham IHSG, kripto, forex (valas), dan makroekonomi.' 
      },
      { role: 'user', content: text }
    ]

    try {
      const { reply } = await sendChatWithFallback(messages, 'id')
      await telegramCall(token, 'sendMessage', { 
        chat_id: chatId, 
        text: reply, 
        parse_mode: 'Markdown' 
      })
    } catch (err: any) {
      console.error('[TelegramBot] Chat error:', err.message)
      await telegramCall(token, 'sendMessage', { 
        chat_id: chatId, 
        text: 'Maaf, koneksi ke otak AI terputus. Coba beberapa saat lagi.' 
      }).catch(() => {})
    }
  }
}

// ── Long-poll loop ────────────────────────────────────────────────────────
async function startPollingLoop() {
  const token = getToken()
  if (!token) {
    console.log('[TelegramBot] No token configured. Polling disabled.')
    return
  }

  // Cancel any existing poll
  if (abortController) abortController.abort()
  abortController = new AbortController()
  const signal = abortController.signal

  try {
    // Clear any stale webhook so polling works
    await telegramCall(token, 'deleteWebhook', { drop_pending_updates: true }, signal)

    // Get bot info
    const me = await telegramCall(token, 'getMe', undefined, signal)
    botUsername = me.username || ''
    reconnectAttempts = 0  // Reset on successful init
    console.log(`[TelegramBot] Polling active as @${botUsername}`)

    // Polling loop
    while (pollingActive && !signal.aborted) {
      try {
        const ac = new AbortController()
        const timer = setTimeout(() => ac.abort(), CONNECT_TIMEOUT_MS)
        const combinedSignal = signal.aborted ? signal : ac.signal

        const updates = await telegramCall(
          token,
          'getUpdates',
          {
            offset: lastUpdateId + 1,
            timeout: POLL_TIMEOUT,
            allowed_updates: ['message'],
          },
          combinedSignal
        )
        clearTimeout(timer)

        if (Array.isArray(updates) && updates.length > 0) {
          for (const update of updates) {
            lastUpdateId = Math.max(lastUpdateId, update.update_id)
            handleUpdate(token, update).catch(err =>
              console.error('[TelegramBot] handleUpdate error:', err.message)
            )
          }
        }
      } catch (pollErr: any) {
        if (signal.aborted) break
        const msg = pollErr?.message || ''
        const isTimeout = msg.includes('abort') || msg.includes('timeout')
        if (!isTimeout) {
          console.error('[TelegramBot] Poll error:', msg.slice(0, 120))
          scheduleReconnect('Poll error')
          return
        }
        // Timeout is normal — just retry the loop
      }
    }
  } catch (initErr: any) {
    if (!signal.aborted) {
      console.error('[TelegramBot] Init error:', initErr.message?.slice(0, 200))
      scheduleReconnect('Init failed')
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────
export function initTelegramBot() {
  const token = getToken()
  if (!token) {
    console.log('[TelegramBot] TELEGRAM_BOT_TOKEN is missing. Bot is disabled.')
    return
  }

  pollingActive = true
  reconnectAttempts = 0
  lastUpdateId = 0
  console.log('[TelegramBot] Backend polling is RE-ENABLED. 409 conflicts handled via dropPendingUpdates.')
  startPollingLoop()
}

export function stopTelegramBot() {
  pollingActive = false
  if (abortController) abortController.abort()
  if (reconnectTimer) clearTimeout(reconnectTimer)
  console.log('[TelegramBot] Polling stopped.')
}

export async function sendMorningCommandToGroup(): Promise<boolean> {
  const token = getToken()
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    console.warn('[TelegramBot] Cannot send message: Missing token or chat ID.')
    return false
  }

  try {
    // 1. Fetch Market Quotes
    const quotes = await resolveMarketQuotes(['^JKSE', 'GC=F', 'BTC-USD'])
    const ihsg = quotes.find((q: any) => q.symbol === 'IHSG')
    const gold = quotes.find((q: any) => q.symbol === 'XAUUSD')
    const btc = quotes.find((q: any) => q.symbol === 'BTC')

    // 2. Fetch News (Top 3 general market news)
    const news = await getMarketNews({ symbols: ['IHSG', 'US', 'Gold', 'Crypto'], limit: 3 })
    
    // 3. Format Date
    const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

    // 4. Build message
    const lines = [
      `🧠 *Komando Pagi Ting AI* — ${today}`,
      ``,
      `📊 *Snapshot Pasar:*`,
      `• *IHSG:* ${ihsg?.price ? ihsg.price.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : 'N/A'} (${ihsg?.changePercent?.toFixed(2) ?? 'N/A'}%)`,
      `• *Emas (XAU):* $${gold?.price ? gold.price.toLocaleString('en-US', { maximumFractionDigits: 1 }) : 'N/A'} (${gold?.changePercent?.toFixed(2) ?? 'N/A'}%)`,
      `• *Bitcoin:* $${btc?.price ? btc.price.toLocaleString('en-US', { maximumFractionDigits: 0 }) : 'N/A'} (${btc?.changePercent?.toFixed(2) ?? 'N/A'}%)`,
      ``,
      `📰 *Sinyal Berita Pagi Ini:*`,
      ...news.items.map((item: any) => `• [${item.source}] ${item.title}`),
      ``,
      `⚡ Analisis mandiri, bukan rekomendasi. Selalu ukur risiko Anda.`,
      `👉 https://tingsai.my.id/`,
    ]
    const text = lines.join('\n')

    await telegramCall(token, 'sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    })
    console.log(`[TelegramBot] Successfully sent Morning Command to ${chatId}`)
    return true
  } catch (error: any) {
    console.error('[TelegramBot] Failed to send Morning Command:', error.message)
    return false
  }
}

export async function sendTestMessage(message: string): Promise<boolean> {
  const token = getToken()
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return false

  try {
    await telegramCall(token, 'sendMessage', {
      chat_id: chatId,
      text: `🛠 *TEST MESSAGE*\n\n${message}`,
      parse_mode: 'Markdown',
    })
    return true
  } catch (error: any) {
    console.error('[TelegramBot] Failed to send test message:', error.message)
    return false
  }
}
