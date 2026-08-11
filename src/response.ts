import type { ResponseType } from './types.js'

export async function parseResponse(response: Response, type?: ResponseType): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return undefined

  if (type) return response[type]()

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (contentType.includes('application/json') || contentType.includes('+json')) {
    return response.json()
  }
  if (contentType.startsWith('text/')) return response.text()
  return response.blob()
}
