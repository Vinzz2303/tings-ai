type RuntimeEnv = {
  VITE_API_URL?: string
  NEXT_PUBLIC_API_URL?: string
  NODE_ENV?: string
  DEV?: boolean
}

// Next.js statically replaces process.env.NEXT_PUBLIC_* references at build time.
// We must access them explicitly, not dynamically via an object cast.
let apiUrl = ''
let isDev = false

if (typeof process !== 'undefined' && process.env) {
  apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.VITE_API_URL || ''
  isDev = process.env.NODE_ENV === 'development'
}

// Fallback for Vite if import.meta is available
if (!apiUrl) {
  try {
    if (typeof import.meta !== 'undefined' && 'env' in (import.meta as any)) {
      const viteEnv = (import.meta as any).env
      apiUrl = viteEnv.VITE_API_URL || ''
      if (!isDev) isDev = Boolean(viteEnv.DEV)
    }
  } catch (error) {
    // Ignore ReferenceError if import.meta is fully undefined
  }
}

export const API_URL = apiUrl
export const IS_DEV = isDev
