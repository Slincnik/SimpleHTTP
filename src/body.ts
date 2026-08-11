import type { RequestBody } from './types.js'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === null || prototype.constructor?.name === 'Object'
}

export function prepareBody(body: RequestBody | undefined, headers: Headers): BodyInit | undefined {
  if (body === undefined) return undefined

  if (Array.isArray(body) || isPlainObject(body)) {
    if (!headers.has('content-type')) headers.set('content-type', 'application/json')
    return JSON.stringify(body)
  }

  return body as BodyInit
}
