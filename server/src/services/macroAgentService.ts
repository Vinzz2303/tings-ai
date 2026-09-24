import { GoogleGenerativeAI } from '@google/generative-ai'
import type { MacroData } from '../utils/openbbAdapter'
import { config } from 'dotenv'

config()

export async function generateMacroAnalysis(data: MacroData): Promise<{ text: string, alphaSignals?: any[] }> {
  const apiKey = process.env.GEMINI_API_KEY
  
  const prompt = `Sebagai analis keuangan tingkat institusi, berikan analisis makro dan setup trading harian berdasarkan data real-time menjelang/sesudah FOMC berikut:
- Suku Bunga The Fed: ${data.fedFundsRate}%
- Inflasi AS (CPI): ${data.inflationRate}%
- Pengangguran AS (UNRATE): ${data.unemploymentRate}%
- Fear Index (VIX): ${data.vix}
- Yield Obligasi AS 2Y (Sangat sensitif): ${data.us2YearYield}%
- Yield Obligasi AS 10Y: ${data.us10YearYield}%
- Indeks Dolar (DXY): ${data.dxy}
- Emas (XAU/USD): $${data.gold}

Instruksi:
Keluarkan output murni dalam bentuk JSON dengan format berikut (TIDAK BOLEH ADA MARKDOWN ATAU BACKTICKS):
{
  "aiAnalysis": "INTELIGENSI MAKRO: [Satu paragraf singkat maksimal 3 kalimat mengenai kondisi sentimen. Berikan sentimen pasar yang tajam, apakah ketakutan atau yakin. Gunakan bahasa Indonesia baku namun berkelas.]",
  "alphaSignals": [
    {
      "asset": "[Nama Aset, misal: Emas (XAU), Bitcoin (BTC), atau S&P 500]",
      "color": "[Warna relevan: green/blue/yellow/purple/orange]",
      "signal": "[Skenario trading 2 kalimat. Misal: Jika support jebol, hindari. Jika breakout, target di X.]"
    }
  ]
}`

  let jsonText = ""

  // 1. Try Gemini First
  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' })
      const result = await model.generateContent(prompt)
      const response = await result.response
      jsonText = response.text()
    } catch (error) {
      console.error('[MacroAgentService] Gemini Failed:', error)
    }
  }

  // 2. Try Groq if Gemini Failed
  if (!jsonText && process.env.GROQ_API_KEY) {
    console.log('[MacroAgentService] Falling back to Groq API...')
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const groqRes = await fetch(process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3
        }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      
      const groqData = await groqRes.json()
      if (groqData.choices && groqData.choices[0].message.content) {
        jsonText = groqData.choices[0].message.content
      }
    } catch (error) {
      console.error('[MacroAgentService] Groq Failed:', error)
    }
  }

  // 3. Parse JSON or Fallback
  if (jsonText) {
      jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim()
      try {
        const parsed = JSON.parse(jsonText)
        return {
          text: parsed.aiAnalysis?.replace(/\*\*/g, '').trim() || '',
          alphaSignals: parsed.alphaSignals
        }
      } catch (e) {
        console.error('[MacroAgentService] Failed to parse JSON:', e)
      }
  }

  // 4. Professional fallback — never expose internal errors to users
  return {
    text: `INTELIGENSI MAKRO: Suku bunga acuan The Fed berada di ${data.fedFundsRate}%, dengan VIX di level ${data.vix} dan inflasi ${data.inflationRate}%. Pasar menanti keputusan FOMC berikutnya.`,
    alphaSignals: [
      {
        asset: "Emas (XAU/USD)",
        color: "yellow",
        signal: `Harga emas di $${data.gold?.toLocaleString('en-US') || '4,040'}. Level saat ini menunjukkan permintaan safe-haven tetap kuat di tengah ketidakpastian suku bunga global.`
      },
      {
        asset: "Indeks Dolar (DXY)",
        color: "blue",
        signal: `DXY di ${data.dxy}. Arah dolar bergantung pada nada hawkish atau dovish dari pernyataan The Fed.`
      }
    ]
  }
}
