import axios from 'axios'
import { GoogleGenerativeAI } from '@google/generative-ai'

export type TingRawInsight = {
  insightUtama: string
  alasan: string[]
  risiko: string[]
  arahan: string
}

export type TingInsightProvider = 'gemini' | 'groq' | 'ollama' | 'local'

export type TingProviderFailure = {
  provider: Exclude<TingInsightProvider, 'local'>
  reason: string
  durationMs: number
}

export type TingRefinedInsight = TingRawInsight & {
  providerStatus: {
    used: TingInsightProvider
    fallbackDepth: number
    durationMs: number
    failures: TingProviderFailure[]
  }
}

const systemInstruction =
  'Anda adalah Ting AI, copilot risiko untuk investor ritel. Tugas Anda hanya merapikan insight yang sudah dibuat core engine. Jangan memberi saran beli/jual, jangan memprediksi, dan jangan mengubah fakta risiko. Balas hanya JSON valid dengan key insightUtama, alasan, risiko, arahan. Bahasa harus Indonesia natural, tegas, sederhana, dan tidak ambigu. alasan maksimal 2 item. risiko maksimal 2 item.'

const localFallbackInsight = (raw: TingRawInsight): TingRawInsight => normalizeInsight(raw)

const normalizeWhitespace = (text: string) => text.trim().replace(/\s+/g, ' ')

const removeEnglishLeakage = (text: string) =>
  normalizeWhitespace(text)
    .replace(/\bportfolio\b/gi, 'portofolio')
    .replace(/\bmarket\b/gi, 'pasar')
    .replace(/\brisk\b/gi, 'risiko')
    .replace(/\btiming risk\b/gi, 'risiko timing')
    .replace(/\bconfidence\b/gi, 'keyakinan')
    .replace(/\bexposure\b/gi, 'eksposur')
    .replace(/\bnegative\b/gi, 'negatif')
    .replace(/\bpositive\b/gi, 'positif')
    .replace(/\bneutral\b/gi, 'netral')

const cleanDanglingEnding = (text: string) => text.trim().replace(/[\s,;:.-]+$/, '')

const ensureSentenceEnd = (text: string) => {
  const cleaned = cleanDanglingEnding(text)
  if (!cleaned) return cleaned
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`
}

const sentenceSafeLimit = (text: string, maxLength = 180) => {
  const normalized = removeEnglishLeakage(text)
  if (normalized.length <= maxLength) return ensureSentenceEnd(normalized)

  const firstSentence = normalized.match(/^.+?[.!?](?=\s|$)/)?.[0]
  if (firstSentence && firstSentence.length <= maxLength + 32) {
    return ensureSentenceEnd(firstSentence)
  }

  const sliced = normalized.slice(0, maxLength).trim()
  const lastSpace = sliced.lastIndexOf(' ')
  const safe = lastSpace > 48 ? sliced.slice(0, lastSpace) : sliced
  return `${cleanDanglingEnding(safe)}...`
}

export const normalizeInsight = (input: Partial<TingRawInsight>): TingRawInsight => ({
  insightUtama: sentenceSafeLimit(
    input.insightUtama || 'Portofolio perlu dibaca dari sisi konsentrasi dan tekanan risiko.',
    150
  ),
  alasan: (Array.isArray(input.alasan) ? input.alasan : [])
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => sentenceSafeLimit(String(item), 150)),
  risiko: (Array.isArray(input.risiko) ? input.risiko : [])
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => sentenceSafeLimit(String(item), 150)),
  arahan: sentenceSafeLimit(
    input.arahan || 'Pikirkan kembali keseimbangan alokasi agar risiko tidak bertumpu pada satu posisi.',
    190
  )
})

const buildPrompt = (raw: TingRawInsight) =>
  [
    systemInstruction,
    '',
    'Raw insight dari core engine:',
    JSON.stringify(normalizeInsight(raw)),
    '',
    'Rapi-kan tanpa menambah fitur, tanpa prediksi, tanpa rekomendasi beli/jual.'
  ].join('\n')

const extractJsonObject = (text: string) => {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const source = fenced || trimmed
  const start = source.indexOf('{')
  const end = source.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Provider did not return JSON')
  }

  return JSON.parse(source.slice(start, end + 1)) as Partial<TingRawInsight>
}

const getErrorReason = (error: unknown) =>
  error instanceof Error ? error.message.slice(0, 160) : 'Unknown provider error'

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, provider: string) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`${provider} timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      })
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

async function callGemini(raw: TingRawInsight) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY missing')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    systemInstruction
  })
  const result = await model.generateContent(buildPrompt(raw))
  return normalizeInsight(extractJsonObject(result.response.text()))
}

async function callGroq(raw: TingRawInsight) {
  const url = process.env.GROQ_API_URL
  const apiKey = process.env.GROQ_API_KEY
  const model = process.env.GROQ_MODEL
  if (!url || !apiKey || !model) throw new Error('Groq env missing')

  const response = await axios.post(
    url,
    {
      model,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: buildPrompt(raw) }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: Number(process.env.GROQ_REQUEST_TIMEOUT_MS || 12000)
    }
  )

  const content = response.data?.choices?.[0]?.message?.content
  if (!content) throw new Error('Groq returned empty content')
  return normalizeInsight(extractJsonObject(content))
}

/**
 * K3: Ollama Local Fallback
 * Calls local Ollama API (http://localhost:11434) as 3rd-tier fallback.
 * Data context is PRE-INJECTED by the backend, so Ollama doesn't need internet.
 */
async function callOllama(raw: TingRawInsight) {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
  const ollamaModel = process.env.OLLAMA_MODEL || 'llama3:latest'

  // Use /api/chat endpoint for better instruction-following with llama3
  const messages = [
    {
      role: 'system',
      content: systemInstruction + ' Balas HANYA dengan objek JSON valid, tidak ada teks penjelasan, tidak ada markdown.'
    },
    {
      role: 'user',
      content: [
        'Raw insight dari core engine:',
        JSON.stringify(normalizeInsight(raw)),
        '',
        'Rapi-kan tanpa menambah fitur, tanpa prediksi, tanpa rekomendasi beli/jual.',
        'BALAS HANYA JSON VALID. Mulai langsung dengan karakter "{".'
      ].join('\n')
    }
  ]

  const response = await axios.post(
    `${ollamaUrl}/api/chat`,
    {
      model: ollamaModel,
      messages,
      stream: false,
      format: 'json',
      options: {
        temperature: 0.1,
        num_predict: 512
      }
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: Number(process.env.OLLAMA_TIMEOUT_MS || 60000)
    }
  )

  const content: string = response.data?.message?.content
  if (!content) throw new Error('Ollama returned empty response')
  console.log('[TING_AI] Ollama raw response:', content.slice(0, 300))
  return normalizeInsight(extractJsonObject(content))
}

export async function refineInsightWithLLM(raw: TingRawInsight): Promise<TingRefinedInsight> {
  const startedAt = Date.now()
  const normalizedRaw = normalizeInsight(raw)
  const failures: TingProviderFailure[] = []
  const providers: Array<{
    name: Exclude<TingInsightProvider, 'local'>
    run: (input: TingRawInsight) => Promise<TingRawInsight>
  }> = [
    { name: 'gemini', run: callGemini },
    { name: 'groq', run: callGroq },
    { name: 'ollama', run: callOllama }  // K3: Ollama local fallback
  ]
  const timeoutMs = Number(process.env.TING_AI_PROVIDER_TIMEOUT_MS || 7000)
  const ollamaTimeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 30000)
  const maxAttempts = Math.max(1, Number(process.env.TING_AI_PROVIDER_RETRIES || 1) + 1)

  for (const provider of providers) {
    const providerTimeout = provider.name === 'ollama' ? ollamaTimeoutMs : timeoutMs
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const providerStartedAt = Date.now()
      try {
        const insight = await withTimeout(provider.run(normalizedRaw), providerTimeout, provider.name)
        const durationMs = Date.now() - startedAt
        console.log(
          `[TING_AI_V19] provider=${provider.name} fallbackDepth=${failures.length} responseTimeMs=${durationMs} attempt=${attempt}`
        )
        return {
          ...insight,
          providerStatus: {
            used: provider.name,
            fallbackDepth: failures.length,
            durationMs,
            failures
          }
        }
      } catch (error) {
        const failure = {
          provider: provider.name,
          reason: getErrorReason(error),
          durationMs: Date.now() - providerStartedAt
        }
        failures.push(failure)
        console.log(
          `[TING_AI_V19] provider=${provider.name} failed fallbackDepth=${failures.length} responseTimeMs=${failure.durationMs} attempt=${attempt} reason=${failure.reason}`
        )
      }
    }
  }

  const durationMs = Date.now() - startedAt
  console.log(`[TING_AI_V19] provider=local fallbackDepth=${failures.length} responseTimeMs=${durationMs}`)
  return {
    ...localFallbackInsight(normalizedRaw),
    providerStatus: {
      used: 'local',
      fallbackDepth: failures.length,
      durationMs,
      failures
    }
  }
}
