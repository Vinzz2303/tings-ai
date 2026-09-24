/**
 * sectorsApi.ts
 * 
 * Integration with Sectors API v2 (Hackathon Track 3)
 */

export async function fetchTopChanges(): Promise<any> {
  const token = process.env.SECTORS_API_KEY
  if (!token) throw new Error('SECTORS_API_KEY not found in environment')

  const url = 'https://api.sectors.app/v2/companies/top-changes/'
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': token
    },
    signal: AbortSignal.timeout(10000)
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`Sectors API Error: ${response.status} - ${errText}`)
  }

  return response.json()
}
