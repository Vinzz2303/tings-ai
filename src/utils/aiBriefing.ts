import { API_URL } from './api'
import type { LanguageCode } from './language'
import type { NormalizedPortfolioSnapshot } from './portfolioSnapshot'

export async function fetchMorningBriefing(
  language: LanguageCode,
  portfolio: NormalizedPortfolioSnapshot | null
): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/morning-brief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, portfolio })
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch morning brief: ${res.status}`)
    }

    const data = await res.json()
    return data.brief || null
  } catch (error) {
    console.error('[fetchMorningBriefing] error:', error)
    return null
  }
}
