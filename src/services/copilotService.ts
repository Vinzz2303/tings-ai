import type { AssetWeight, FullInsight, MarketCondition } from '../engine/insightEngine'
import type { ConfidenceScore } from '../engine/trustLayer'
import type { AiMessage } from '../types'
import { API_URL } from '../utils/api'
import { fetchWithSession } from '../utils/authFetch'

import { detectUserIntent } from '../engine/intentEngine'
import { buildEngineContext } from '../engine/contextBuilder'
import { buildReasoning } from '../engine/reasoningEngine'
import { buildThinkingPrompt } from '../engine/thinkingPrompt'
import { enforcePlainText } from '../engine/outputGuard'
import { buildTrustLanguage } from '../engine/variationEngine'
import {
  decisionTypeLabel,
  formatDecisionJournalForCopilot,
  readDecisionJournal,
} from '../utils/decisionJournal'
import { normalizeDisplaySymbol } from '../utils/assetNormalization'

type Provider = 'gemini' | 'groq'

export type CopilotMessage = {
  role: 'user' | 'assistant'
  content: string
  image?: string
}

export type CopilotResponse = {
  text: string
  chips: string[]
  meta: {
    hasFallback: boolean
    usedTrust: ConfidenceScore['confidence']
    provider?: Provider | 'local'
  }
}

type RunCopilotInput = {
  message: string
  image?: string
  lang: 'id' | 'en'
  mode?: 'copilot' | 'chat'
  market: MarketCondition
  portfolio: AssetWeight[]
  trust: ConfidenceScore
  insight: FullInsight
  messages?: CopilotMessage[]
}

type ProviderResponse = {
  reply?: string
}

type CopilotIntent = 'identity' | 'smalltalk' | 'portfolio' | 'general'

type StoredNewsContext = {
  items?: Array<{
    title?: string
    source?: string
    publishedAt?: string
    relatedSymbols?: string[]
    relevanceReason?: string
    dataStatus?: string
  }>
  dataStatus?: 'live' | 'delayed' | 'cached' | 'unavailable'
  lastUpdated?: string | null
  message?: string | null
}

const PRIMARY_TIMEOUT_MS = 15000
const SECONDARY_TIMEOUT_MS = 10000
const NEWS_CONTEXT_KEY = 'tingai_market_news_context_v2_3_1'

const SYSTEM_PROMPT_ID = `Kamu adalah thinking copilot untuk investor, bukan pemberi jawaban biasa.

Tugasmu:
- membantu user memahami implikasi
- bukan menjelaskan definisi umum

CARA BERPIKIR:
1. Apa yang terlihat di permukaan (REALITY)
2. Apa yang sering terlewat (TRADE-OFF)
3. Bagaimana seharusnya melihatnya (DIRECTION)

ATURAN KERAS:
- BIAS DETECTOR (MUTLAK): Jika user menunjukkan conviction/keyakinan yang kuat (misal: "pasti naik", "saatnya buy", "all in"), kamu WAJIB bertindak sebagai DEVIL'S ADVOCATE. Berikan argumen bearish/berlawanan untuk mendinginkan emosinya dan mencegah Confirmation Bias atau FOMO.
- Jawab pertanyaan user dulu, baru hubungkan ke portofolio.
- DILARANG menjelaskan definisi umum seperti Google
- DILARANG menjawab terlalu generik
- DILARANG menggunakan JSON, bullet, atau format teknis
- NO-SIGNAL POLICY (MUTLAK): DILARANG memberi instruksi/saran beli, jual, hold, entry, exit, atau menjanjikan profit. Bantu BAGAIMANA cara berpikir, bukan APA yang harus dilakukan.
- WAJIB menyebut konsentrasi portofolio user dan aset dominan saat konteks tersedia
- Gunakan stance risk_pressure, neutral, atau supportive sebagai lensa reasoning, bukan sinyal transaksi
- HINDARI bahasa defensif seperti "tidak punya context live", "tidak yakin", atau "data tidak tersedia"
- Di mode copilot, wajib ada trade-off dalam bahasa natural

GAYA BAHASA:
Gunakan variasi natural. Jangan mengulang pembuka yang sama antar jawaban.

OUTPUT & STRUCTURE:
Kamu HARUS menstrukturkan jawaban ke dalam persis 4 bagian ini secara berurutan, mengalir natural dalam 1-2 paragraf, TANPA menggunakan label (seperti "Acknowledge:", "Context:"), TANPA bullet points, dan TANPA JSON:
1. ACKNOWLEDGE: Validasi pertanyaan/niat user. (Jika terdeteksi bias, langsung potong dengan devil's advocate).
2. CONTEXT: Sebutkan kondisi market/portofolio saat ini.
3. INSIGHT: Berikan realita dan trade-off (jelaskan sebab -> akibat).
4. REFLECTION: Akhiri dengan arah pemikiran (apa yang perlu dipantau/dipertimbangkan).

CONTEXT:
Gunakan:
- kondisi market
- struktur portofolio user (jika ada)
- trust level (secara implisit, bukan label)`

const SYSTEM_PROMPT_EN = `You are a thinking copilot for investors, not a standard answer bot.

Your task:
- help users understand implications
- do not explain general definitions

THINKING FRAMEWORK:
1. What is visible on the surface (REALITY)
2. What is often missed (TRADE-OFF)
3. How to look at it (DIRECTION)

HARD RULES:
- BIAS DETECTOR (ABSOLUTE): If the user shows strong conviction (e.g., "it will definitely go up", "time to buy", "all in"), you MUST act as a DEVIL'S ADVOCATE. Provide bearish/contrarian arguments to cool down their emotions and prevent Confirmation Bias or FOMO.
- Answer the user's question first, then connect it to the portfolio.
- DO NOT explain general definitions like Google
- DO NOT answer too generically
- DO NOT use JSON, bullets, or technical formats
- NO-SIGNAL POLICY (ABSOLUTE): DO NOT give instructions/advice to buy, sell, hold, entry, exit, or promise profits. Help with HOW to think, not WHAT to do.
- MUST mention user portfolio concentration and dominant assets when context is available
- Use risk_pressure, neutral, or supportive stances as a reasoning lens, not a transaction signal
- AVOID defensive language like "no live context", "not sure", or "data unavailable"
- In copilot mode, include a natural trade-off sentence

LANGUAGE STYLE:
Use natural variation. Do not repeat the same opening between answers.

OUTPUT & STRUCTURE:
You MUST structure the answer into exactly these 4 parts sequentially, flowing naturally in 1-2 paragraphs, WITHOUT using labels (like "Acknowledge:", "Context:"), WITHOUT bullet points, and WITHOUT JSON:
1. ACKNOWLEDGE: Validate user question/intent. (If bias is detected, cut in immediately with a devil's advocate stance).
2. CONTEXT: State current market/portfolio condition.
3. INSIGHT: Provide reality and trade-off (explain cause -> effect).
4. REFLECTION: End with a direction of thought (what to monitor/consider).

CONTEXT:
Use:
- market conditions
- user portfolio structure (if any)
- trust level (implicitly, not as a label)`

function timeoutSignal(timeoutMs: number) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  return { controller, timeoutId }
}

// normalizeCopilotOutput has been moved to enforcePlainText in outputGuard.ts

function detectIntent(q: string, hasImage?: boolean): CopilotIntent {
  if (hasImage) return 'portfolio'
  const text = q.toLowerCase().trim()

  if (text.match(/siapa|who are you|apa itu/i)) return 'identity'
  if (text.length < 5) return 'smalltalk'

  if (text.match(/portfolio|portofolio|risk|risiko|asset|aset|alokasi|market|pasar|berita|news|headline|katalis|catalyst|keputusan|decision|jurnal|journal|catatan|review|alasan|btc|bitcoin|emas|gold|xau|saham|stock|gorengan/i)) {
    return 'portfolio'
  }

  return 'general'
}

function asksAboutNews(message: string) {
  return /berita|news|headline|katalis|catalyst/i.test(message)
}

function asksAboutDecisionJournal(message: string) {
  return /keputusan|decision|jurnal|journal|catatan|review|alasan|terakhir|menambah posisi|tambah posisi|pantau/i.test(message)
}

function readStoredNewsContext(): StoredNewsContext | null {
  try {
    const raw = window.localStorage.getItem(NEWS_CONTEXT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredNewsContext
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

function passesTopicGuard(reply: string, query: string, history: CopilotMessage[]): boolean {
  const lowerReply = reply.toLowerCase()
  const fullContext = [query, ...history.map(m => m.content)].join(' ').toLowerCase()

  const isBtcMentioned = /btc|bitcoin|kripto|crypto/i.test(lowerReply)
  const isBtcInContext = /btc|bitcoin|kripto|crypto/i.test(fullContext)

  const isGoldMentioned = /emas|gold|xau/i.test(lowerReply)
  const isGoldInContext = /emas|gold|xau/i.test(fullContext)

  if (isBtcMentioned && !isBtcInContext) return false
  if (isGoldMentioned && !isGoldInContext) return false

  return true
}

function buildTopicGuardFallback(input: RunCopilotInput): string {
  if (input.lang === 'en') {
    return "Based on your question, I'm focusing strictly on the context you provided. I don't see a clear signal connecting this to other unrelated assets right now. What specific aspect of this would you like to explore further?"
  }
  return "Melihat pertanyaanmu, saya fokus pada konteks yang kamu sebutkan. Saat ini belum ada sinyal kuat yang secara langsung menghubungkannya dengan kelas aset lain di luar itu. Apa bagian spesifik dari ini yang ingin kamu perhatikan lebih jauh?"
}

function buildNaturalFallback(input: RunCopilotInput, intent: CopilotIntent) {
  if (input.lang === 'en') {
    if (intent === 'identity') {
      return 'I am Ting AI, your calm thinking companion for reading market and portfolio context. Ask me a market or portfolio question when you want a deeper risk-aware read.'
    }
    if (intent === 'smalltalk') {
      return 'I am here. Send a market or portfolio question whenever you want me to help read the context.'
    }
    return 'I can help with that. For the strongest read, ask me in the context of a market, asset, or portfolio question.'
  }

  if (intent === 'identity') {
    return 'Saya Ting AI, partner berpikir yang membantu membaca konteks market dan portofolio dengan tenang. Kalau kamu tanya soal aset, risiko, atau portofolio, saya bisa bantu uraikan dampaknya.'
  }
  if (intent === 'smalltalk') {
    return 'Saya aktif. Kirim pertanyaan soal market atau portofolio kalau kamu ingin saya bantu baca konteksnya.'
  }
  return 'Bisa. Kalau pertanyaannya dikaitkan ke market, aset, atau portofolio, saya bisa bantu membacanya dengan lebih tajam.'
}

// ── Context-aware chip generator ─────────────────────────────────────────────────────
// Detects user intent from message text and returns 3 contextual follow-up chips.
// Never repeats generic fallbacks when a specific intent can be detected.

type ChipIntent =
  | 'commodity'
  | 'crypto'
  | 'stock'
  | 'portfolio'
  | 'risk'
  | 'tradeoff'
  | 'market'
  | 'general'

function detectChipIntent(message: string): ChipIntent {
  const m = message.toLowerCase()
  if (/emas|gold|xau|perak|silver|minyak|oil|komoditas|commodity|crude/.test(m)) return 'commodity'
  if (/btc|bitcoin|eth|ethereum|kripto|crypto|altcoin|defi/.test(m))            return 'crypto'
  if (/saham|stock|equity|emiten|idx|jkse|ihsg|ticker|bbca|tlkm|bbri|gorengan/.test(m)) return 'stock'
  if (/portofolio|portfolio|holding|alokasi|allocation|posisi|weight/.test(m))  return 'portfolio'
  if (/risiko|risk|drawdown|volatil|bahaya|aman|safe|kerugian|loss/.test(m))    return 'risk'
  if (/tradeoff|trade.off|pertimbang|masuk|entry|tunggu|wait|timing/.test(m))   return 'tradeoff'
  if (/pasar|market|kondisi|condition|sentimen|sentiment|macro|global/.test(m)) return 'market'
  return 'general'
}

const CHIPS: Record<ChipIntent, { id: [string, string, string]; en: [string, string, string] }> = {
  commodity: {
    id: [
      'Bagaimana dampaknya ke portofolio saya?',
      'Bandingkan dengan emas?',
      'Apa risiko tersembunyi yang sering terlewat?',
    ],
    en: [
      'How does this affect my portfolio?',
      'Compare with gold?',
      'What hidden risks should I watch?',
    ],
  },
  crypto: {
    id: [
      'Bagaimana volatilitas ini memengaruhi alokasi saya?',
      'Apa yang sering terlewat dari pergerakan kripto?',
      'Bagaimana cara berpikir soal timing di kondisi ini?',
    ],
    en: [
      'How does this volatility affect my allocation?',
      "What's often missed in crypto moves?",
      'How should I think about timing in this condition?',
    ],
  },
  stock: {
    id: [
      'Berapa besar eksposur portofolio saya ke sektor ini?',
      'Apa trade-off yang perlu dipertimbangkan?',
      'Sentimen pasar saat ini mendukung atau tidak?',
    ],
    en: [
      'How much portfolio exposure do I have here?',
      'What trade-offs should I think through?',
      'Is current market sentiment supportive or not?',
    ],
  },
  portfolio: {
    id: [
      'Aset mana yang paling sensitif saat ini?',
      'Apa trade-off dari konsentrasi ini?',
      'Apa yang perlu saya tinjau ulang?',
    ],
    en: [
      'Which position is most sensitive right now?',
      'What are the trade-offs of this concentration?',
      'What should I revisit?',
    ],
  },
  risk: {
    id: [
      'Bagaimana cara membaca sensitivitas portofolio saya?',
      'Risiko mana yang paling langsung ke posisi saya?',
      'Apa yang sering terlewat dari analisis risiko ini?',
    ],
    en: [
      'How do I read my portfolio sensitivity?',
      'Which risk is most direct to my position?',
      "What's often missed in this risk analysis?",
    ],
  },
  tradeoff: {
    id: [
      'Apa yang sering tidak disadari dari pertimbangan ini?',
      'Bagaimana kalau kondisi berubah lebih cepat?',
      'Apa dampaknya ke aset lain di portofolio?',
    ],
    en: [
      "What's often not noticed about this trade-off?",
      'What if conditions shift faster than expected?',
      'How does this affect my other positions?',
    ],
  },
  market: {
    id: [
      'Bagaimana dampaknya ke portofolio saya?',
      'Apa yang berubah dari kondisi sebelumnya?',
      'Apa yang perlu dipantau dari kondisi ini?',
    ],
    en: [
      'How does this affect my portfolio?',
      'What changed from before?',
      'What should I monitor from this?',
    ],
  },
  general: {
    id: [
      'Bagaimana dampaknya ke portofolio saya?',
      'Apa trade-off yang sering terlewat?',
      'Apa yang perlu saya perhatikan?',
    ],
    en: [
      'How does this affect my portfolio?',
      'What trade-offs are often missed?',
      'What should I pay attention to?',
    ],
  },
}

function buildContextualChips(message: string, lang: 'id' | 'en'): [string, string, string] {
  const intent = detectChipIntent(message)
  return CHIPS[intent][lang]
}

function sentenceLimit(text: string, maxSentences: number) {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  const parts = cleaned.match(/[^.!?]+[.!?]?/g) || [cleaned]
  return parts.slice(0, maxSentences).map((part) => part.trim()).join(' ').trim()
}

function sanitizeDefensiveLanguage(text: string, lang: 'id' | 'en') {
  if (lang === 'id') {
    return text
      .replace(/saya belum punya context live[^.!?]*[.!?]?/gi, 'Belum terlihat sinyal kuat dari konteks yang ada.')
      .replace(/saya tidak punya konteks live[^.!?]*[.!?]?/gi, 'Belum terlihat sinyal kuat dari konteks yang ada.')
      .replace(/saya tidak yakin[^.!?]*[.!?]?/gi, 'Arahnya masih belum konsisten.')
      .replace(/data (belum|tidak) tersedia[^.!?]*[.!?]?/gi, 'Belum terlihat sinyal kuat dari data yang ada.')
  }

  return text
    .replace(/I do not have (enough )?(reliable )?live context[^.!?]*[.!?]?/gi, 'The current read does not show a strong signal yet.')
    .replace(/I am not sure[^.!?]*[.!?]?/gi, 'The direction is still not consistent.')
    .replace(/data (is )?(not available|unavailable)[^.!?]*[.!?]?/gi, 'The current read does not show a strong signal yet.')
}

function buildPortfolioBridge(
  context: ReturnType<typeof buildEngineContext>,
  lang: 'id' | 'en'
) {
  const asset = context.dominantAsset || (lang === 'id' ? 'aset dominan' : 'the dominant asset')
  const weight = context.dominantWeight ? `${context.dominantWeight.toFixed(0)}%` : lang === 'id' ? 'porsi terbesar' : 'the largest weight'

  if (lang === 'id') {
    const stance =
      context.stance === 'risk_pressure'
        ? 'cukup sensitif terhadap tekanan'
        : context.stance === 'supportive'
          ? 'relatif mendukung selama tekanan pasar tidak melebar'
          : 'belum menunjukkan arah yang konsisten'
    return `Dalam portofolio kamu, ${asset} masih dominan di sekitar ${weight}, jadi nilai keseluruhan ${stance}.`
  }

  const stance =
    context.stance === 'risk_pressure'
      ? 'fairly sensitive to pressure'
      : context.stance === 'supportive'
        ? 'relatively supported as long as pressure does not broaden'
        : 'not showing a consistent direction yet'
  return `In your portfolio, ${asset} is still dominant at around ${weight}, so the overall value is ${stance}.`
}

function buildTradeOffSentence(
  context: ReturnType<typeof buildEngineContext>,
  lang: 'id' | 'en'
) {
  const asset = context.dominantAsset || (lang === 'id' ? 'aset dominan' : 'the dominant asset')
  if (lang === 'id') {
    return `Trade-off-nya, aset yang lebih defensif bisa meredam tekanan, tapi selama ${asset} masih paling dominan, arah portofolio tetap banyak ditentukan oleh aset itu.`
  }
  return `The trade-off is that more defensive assets can soften pressure, but while ${asset} remains dominant, the portfolio is still mostly steered by that asset.`
}

function buildFromInsight(
  insight: FullInsight,
  trust: ConfidenceScore,
  lang: 'id' | 'en',
  context = buildEngineContext([], { volatility: 'medium', trend: 'sideways' }, trust),
  seed = ''
) {
  const bridge = buildPortfolioBridge(context, lang)
  const trustText = buildTrustLanguage(lang, context, trust.reason.note)
  const tradeOff = buildTradeOffSentence(context, lang)

  if (lang === 'en') {
    return sentenceLimit(`${insight.reality} ${bridge} ${insight.tradeoff || tradeOff} ${trustText} ${insight.direction}`, 4)
  }

  return sentenceLimit(`${insight.reality} ${bridge} ${insight.tradeoff || tradeOff} ${trustText} ${insight.direction}`, 4)
}

function localFallback(input: RunCopilotInput): CopilotResponse {
  const intent = detectIntent(input.message, !!input.image)
  const newsContext = readStoredNewsContext()
  const journalEntries = readDecisionJournal()
  if (asksAboutDecisionJournal(input.message)) {
    const latest = journalEntries[0]
    const latestAsset = latest?.relatedAsset ? normalizeDisplaySymbol(latest.relatedAsset) : ''
    const text = input.lang === 'id'
      ? latest
        ? `Catatanmu menunjukkan keputusan terakhir adalah ${decisionTypeLabel(latest.decisionType, input.lang)}${latestAsset ? ` untuk ${latestAsset}` : ''}. Alasannya: ${latest.reason}${latest.riskAwareNote ? ` Risiko yang sudah kamu sadari: ${latest.riskAwareNote}` : ''}. Sebelum bertindak, pastikan catatan ini masih sesuai dengan risk budget dan pantauan pribadimu.`
        : 'Belum ada catatan keputusan yang tersimpan. Mulai dari satu kalimat tentang apa yang kamu pertimbangkan dan risiko apa yang sudah kamu sadari.'
      : latest
        ? `Your journal shows the latest considered decision is ${decisionTypeLabel(latest.decisionType, input.lang)}${latestAsset ? ` for ${latestAsset}` : ''}. Reason: ${latest.reason}${latest.riskAwareNote ? ` Risk you already noted: ${latest.riskAwareNote}` : ''}. Before acting, make sure this still fits your risk budget and personal watchlist.`
        : 'There are no saved decision notes yet. Start with one sentence about what you are considering and what risk you already see.'
    return {
      text: sentenceLimit(text, 4),
      chips: buildContextualChips(input.message, input.lang),
      meta: {
        hasFallback: true,
        usedTrust: input.trust.confidence,
        provider: 'local',
      },
    }
  }
  if (asksAboutNews(input.message)) {
    const hasNews = newsContext?.dataStatus !== 'unavailable' && (newsContext?.items || []).length > 0
    const text = input.lang === 'id'
      ? hasNews
        ? `Berita yang tersedia saya baca dari sumber berita yang tersimpan, bukan dari headline buatan. Yang paling langsung terkait portofolio adalah ${(newsContext?.items || [])[0]?.relatedSymbols?.map(normalizeDisplaySymbol).join('/') || 'aset dengan eksposur terbesar'}, karena ${(newsContext?.items || [])[0]?.relevanceReason || 'konteksnya berhubungan dengan market dan risiko portofolio kamu'}.`
        : 'Sumber berita sedang belum tersedia, jadi saya tidak akan mengarang headline. Untuk sementara, saya tetap bisa membaca dampak dari alokasi, konsentrasi posisi, dan market context yang tersedia.'
      : hasNews
        ? `I am using the stored provider news, not invented headlines. The most direct portfolio link is ${(newsContext?.items || [])[0]?.relatedSymbols?.map(normalizeDisplaySymbol).join('/') || 'your largest exposed assets'}, because ${(newsContext?.items || [])[0]?.relevanceReason || 'the context relates to market and portfolio risk'}.`
        : 'The news source is unavailable, so I will not invent headlines. For now, I can still read the impact from allocation, position concentration, and available market context.'
    return {
      text: sentenceLimit(text, 3),
      chips: buildContextualChips(input.message, input.lang),
      meta: {
        hasFallback: true,
        usedTrust: input.trust.confidence,
        provider: 'local',
      },
    }
  }
  if (intent !== 'portfolio') {
    return {
      text: buildNaturalFallback(input, intent),
      chips: buildContextualChips(input.message, input.lang),
      meta: {
        hasFallback: true,
        usedTrust: input.trust.confidence,
        provider: 'local',
      },
    }
  }

  const context = buildEngineContext(input.portfolio, input.market, input.trust)
  return {
    text: buildFromInsight(input.insight, input.trust, input.lang, context, input.message),
    chips: buildContextualChips(input.message, input.lang),
    meta: {
      hasFallback: true,
      usedTrust: input.trust.confidence,
      provider: 'local',
    },
  }
}

function buildContext(input: RunCopilotInput) {
  const context = buildEngineContext(input.portfolio, input.market, input.trust)
  const holdings = input.portfolio
    .map((item) => `${normalizeDisplaySymbol(item.asset)} ${item.weight.toFixed(0)}%`)
    .join(', ')
  const newsContext = readStoredNewsContext()
  const journalContext = formatDecisionJournalForCopilot(readDecisionJournal(), input.lang, 5)
  const newsLines =
    newsContext?.dataStatus === 'unavailable'
      ? [
          'News source: unavailable',
          `News instruction: tell the user the news source is unavailable and do not invent headlines.`,
        ]
      : (newsContext?.items || []).slice(0, 6).map((item) =>
          `News: ${item.title || 'Untitled'} | source=${item.source || 'unknown'} | status=${item.dataStatus || newsContext?.dataStatus || 'delayed'} | symbols=${(item.relatedSymbols || []).map(normalizeDisplaySymbol).join(',') || 'none'} | relevance=${item.relevanceReason || 'market context'}`
        )

  return [
    `Language: ${input.lang}`,
    `Mode: ${input.mode || 'copilot'}`,
    `Market: volatility=${input.market.volatility}, trend=${input.market.trend}`,
    `Macro pressure: ${context.macroPressure}`,
    `Stance: ${context.stance}`,
    `Dominant asset: ${context.dominantAsset || 'none'} (${context.dominantWeight.toFixed(1)}%)`,
    `Concentration level: ${context.concentrationLevel}`,
    `Portfolio: ${holdings || 'none'}`,
    `Trust: ${input.trust.confidence}; ${input.trust.reason.note || 'No note'}`,
    `Insight reality: ${input.insight.reality}`,
    `Insight tradeoff: ${input.insight.tradeoff}`,
    `Insight direction: ${input.insight.direction}`,
    `News rule: use only the listed news titles/sources. Never invent a headline.`,
    ...newsLines,
    journalContext ? `Decision journal context: ${journalContext}` : 'Decision journal context: none',
    `Decision journal rule: reflect the user's notes with phrases like "catatanmu menunjukkan" or "yang perlu kamu review"; never say buy now, sell now, wajib entry, pasti naik, or pasti turun.`,
  ].join('\n')
}

function buildPayloadMessages(input: RunCopilotInput): AiMessage[] {
  const history = (input.messages || []).slice(-8).map((message) => ({
    role: message.role,
    content: message.content,
    image: message.image,
  }))

  return [
    {
      role: 'system',
      content: input.lang === 'id' ? SYSTEM_PROMPT_ID : SYSTEM_PROMPT_EN,
    },
    {
      role: 'system',
      content: buildContext(input),
    },
    ...history,
    {
      role: 'user',
      content: input.message,
      image: input.image,
    },
  ]
}

async function callProviderV2(
  provider: Provider,
  input: RunCopilotInput,
  timeoutMs: number
): Promise<CopilotResponse> {
  const { controller, timeoutId } = timeoutSignal(timeoutMs)
  const copilotIntent = detectIntent(input.message, !!input.image)

  if (copilotIntent !== 'portfolio') {
    try {
      const response = await fetchWithSession(`${API_URL}/api/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          provider,
          messages: [
            {
              role: 'system',
              content: input.lang === 'id'
                ? 'Kamu adalah Ting AI. Jawab natural, singkat, dan ramah. Jangan menyisipkan konteks portofolio kecuali user bertanya soal market, aset, risiko, atau portofolio.'
                : 'You are Ting AI. Reply naturally, briefly, and warmly. Do not inject portfolio context unless the user asks about markets, assets, risk, or portfolio.'
            },
            ...(input.messages || []).slice(-6).map((m) => ({ role: m.role, content: m.content, image: m.image })),
            { role: 'user', content: input.message, image: input.image },
          ],
          meta: {
            copilot: true,
            mode: 'chat',
            intent: copilotIntent,
            skipPortfolioReasoning: true,
          },
        }),
      })

      if (!response.ok) throw new Error('provider_failed')

      const data = (await response.json()) as ProviderResponse
      const rawReply: unknown = data.reply ?? data
      const normalized = enforcePlainText(rawReply, buildNaturalFallback(input, copilotIntent))
      if (!normalized) throw new Error('empty_provider_reply')

      return {
        text: sentenceLimit(sanitizeDefensiveLanguage(normalized, input.lang), copilotIntent === 'smalltalk' ? 2 : 3),
        chips: buildContextualChips(input.message, input.lang),
        meta: {
          hasFallback: provider === 'groq',
          usedTrust: input.trust.confidence,
          provider,
        },
      }
    } finally {
      window.clearTimeout(timeoutId)
    }
  }

  // 1. Detect intent
  const intent = detectUserIntent(input.message)

  // 2. Build context
  const context = buildEngineContext(input.portfolio, input.market, input.trust)

  // 3. Build reasoning
  const reasoning = buildReasoning(context, input.lang)

  // 4. Build prompt
  const promptText = buildThinkingPrompt(
    input.message,
    input.lang,
    intent,
    context,
    reasoning,
    input.trust.reason.note || ''
  )

  const payloadMessages = [
    { role: 'system', content: input.lang === 'id' ? SYSTEM_PROMPT_ID : SYSTEM_PROMPT_EN },
    ...(input.messages || []).map((m) => ({ role: m.role, content: m.content, image: m.image })),
    { role: 'user', content: promptText, image: input.image },
  ]

  try {
    const response = await fetchWithSession(`${API_URL}/api/ai-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        provider,
        messages: payloadMessages,
        insightContext: {
          reality: input.insight.reality,
          tradeoff: input.insight.tradeoff,
          direction: input.insight.direction,
          portfolioSummary: input.portfolio
            .map((item) => `${item.asset} ${item.weight.toFixed(0)}%`)
            .join(', '),
        },
        meta: {
          copilot: true,
          mode: input.mode || 'copilot',
          market: input.market,
          trust: input.trust,
          stance: context.stance,
          dominantAsset: context.dominantAsset,
          dominantWeight: context.dominantWeight,
          concentrationLevel: context.concentrationLevel,
        },
      }),
    })

    if (!response.ok) throw new Error('provider_failed')

    const data = (await response.json()) as ProviderResponse
    
    // 6. Output Guard
    const rawReply: unknown = data.reply ?? data
    const fallbackText = buildFromInsight(input.insight, input.trust, input.lang, context, input.message)
    const normalized = enforcePlainText(rawReply, fallbackText)
    if (!normalized) throw new Error('empty_provider_reply')

    if (!passesTopicGuard(normalized, input.message, input.messages || [])) {
      return {
        text: buildTopicGuardFallback(input),
        chips: buildContextualChips(input.message, input.lang),
        meta: {
          hasFallback: true,
          usedTrust: input.trust.confidence,
          provider: 'local',
        },
      }
    }

    return {
      text: ensurePersonalizedCopilotText(normalized, context, reasoning, input.lang),
      chips: buildContextualChips(input.message, input.lang),
      meta: {
        hasFallback: provider === 'groq',
        usedTrust: input.trust.confidence,
        provider,
      },
    }
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function ensurePersonalizedCopilotText(
  text: string,
  context: ReturnType<typeof buildEngineContext>,
  reasoning: ReturnType<typeof buildReasoning>,
  lang: 'id' | 'en'
) {
  const cleaned = sanitizeDefensiveLanguage(text, lang)
  if (!context.dominantAsset) return sentenceLimit(cleaned, 4)

  const lower = cleaned.toLowerCase()
  const mentionsAsset = lower.includes(context.dominantAsset.toLowerCase())
  const mentionsConcentration =
    lower.includes('concentration') ||
    lower.includes('konsentrasi') ||
    lower.includes(`${context.dominantWeight.toFixed(0)}%`)
  const mentionsTradeoff = lower.includes('trade-off') || lower.includes('tradeoff') || lower.includes('pertukaran')

  const parts = [cleaned]
  if (!mentionsAsset || !mentionsConcentration) {
    parts.push(buildPortfolioBridge(context, lang))
  }
  if (!mentionsTradeoff) {
    parts.push(reasoning.tradeOff || buildTradeOffSentence(context, lang))
  }

  return sentenceLimit(parts.join(' '), 4)
}

export async function runCopilotV2(input: RunCopilotInput): Promise<CopilotResponse> {
  try {
    return await callProviderV2('gemini', input, PRIMARY_TIMEOUT_MS)
  } catch {
    try {
      return await callProviderV2('groq', input, SECONDARY_TIMEOUT_MS)
    } catch {
      return localFallback(input)
    }
  }
}
