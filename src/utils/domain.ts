// Domains that serve the personal portfolio website
const PERSONAL_DOMAINS = [
  'faturachman.my.id',
  'www.faturachman.my.id',
]

// Domains that serve the Ting AI platform
export const TING_AI_DOMAINS = [
  'tingsai.my.id',
  'www.tingsai.my.id',
  'app.tingsai.my.id'
]

export function isPersonalDomain(): boolean {
  if (typeof window === 'undefined') return true

  // Custom query param override for testing (e.g. ?personal=true or ?personal=false)
  const params = new URLSearchParams(window.location.search)
  if (params.has('personal')) {
    return params.get('personal') === 'true'
  }

  const hostname = window.location.hostname.toLowerCase()

  // If running on a known Ting AI domain or hostname contains tingsai → definitely NOT personal
  if (hostname.includes('tingsai') || hostname.includes('ting-ai') || TING_AI_DOMAINS.includes(hostname)) return false

  // If running on the personal portfolio domain → personal
  if (hostname.includes('faturachman') || PERSONAL_DOMAINS.includes(hostname)) return true

  // Fallback for localhost / unknown → treat as Ting AI (dev default)
  return false
}

export function isTingAiDomain(): boolean {
  return !isPersonalDomain()
}
