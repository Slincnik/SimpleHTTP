import type { Query } from './types.js'

export function appendQuery(url: string, query?: Query): string {
  if (!query) return url

  const hashIndex = url.indexOf('#')
  const hash = hashIndex < 0 ? '' : url.slice(hashIndex)
  const base = hashIndex < 0 ? url : url.slice(0, hashIndex)
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.append(key, value === null ? '' : String(value))
  }

  const serialized = params.toString()
  if (!serialized) return url
  const separator = base.endsWith('?') || (base.includes('?') && base.endsWith('&'))
    ? ''
    : base.includes('?') ? '&' : '?'
  return `${base}${separator}${serialized}${hash}`
}
