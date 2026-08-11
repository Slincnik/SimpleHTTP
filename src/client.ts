import { prepareBody } from './body.js'
import { HttpError } from './error.js'
import { appendQuery } from './query.js'
import { parseResponse } from './response.js'
import type {
  Client,
  ClientOptions,
  RawRequestOptions,
  RequestOptions,
  RequestMethod,
  ResponseType,
  URLInput,
} from './types.js'

const absoluteURL = /^[a-z][a-z\d+.-]*:|^\/\//i

function resolveURL(baseURL: string | undefined, input: URLInput): string {
  const url = typeof input === 'string' ? input : input.href
  if (!baseURL || absoluteURL.test(url)) return url
  if (!url) return baseURL
  if (url.startsWith('?')) return `${baseURL.split(/[?#]/, 1)[0]}${url}`
  if (url.startsWith('#')) return `${baseURL.split('#', 1)[0]}${url}`

  const baseMatch = baseURL.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/)
  const urlMatch = url.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/)
  const path = `${baseMatch![1].replace(/\/$/, '')}/${urlMatch![1].replace(/^\//, '')}`
  const query = [baseMatch![2], urlMatch![2]].filter(Boolean).join('&').replace(/&\?/, '&')
  return `${path}${query}${urlMatch![3] ?? baseMatch![3] ?? ''}`
}

function mergeHeaders(defaults?: HeadersInit, overrides?: HeadersInit): Headers {
  const headers = new Headers(defaults)
  if (overrides) new Headers(overrides).forEach((value, name) => headers.set(name, value))
  return headers
}

interface ComposedSignal {
  signal: AbortSignal | null | undefined
  cleanup(): void
}

function composeSignal(signal: AbortSignal | null | undefined, timeout?: number): ComposedSignal {
  if (timeout === undefined) return { signal, cleanup() {} }
  if (!Number.isFinite(timeout) || timeout < 0 || timeout > 2_147_483_647) {
    throw new TypeError('timeout must be between 0 and 2147483647 milliseconds')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort(new DOMException(`Request timed out after ${timeout} ms`, 'TimeoutError'))
  }, timeout)

  return {
    signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
    cleanup() {
      clearTimeout(timer)
    },
  }
}

export function createClient(options: ClientOptions = {}): Client {
  const {
    baseURL,
    headers: defaultHeaders,
    responseType: defaultResponseType,
    timeout: defaultTimeout,
    onRequest,
    onResponse,
    onError,
    ...defaultInit
  } = options

  async function execute<T>(
    method: string,
    url: URLInput,
    requestOptions: RequestOptions,
    raw: boolean,
  ): Promise<T | Response> {
    const {
      body,
      headers: requestHeaders,
      query,
      responseType = defaultResponseType,
      timeout = defaultTimeout,
      signal: requestSignal,
      ...requestInit
    } = requestOptions

    const headers = mergeHeaders(defaultHeaders, requestHeaders)
    const preparedBody = prepareBody(body, headers)
    const selectedSignal = requestSignal === undefined ? defaultInit.signal : requestSignal
    const composed = composeSignal(selectedSignal, timeout)
    let request: Request
    try {
      request = new Request(appendQuery(resolveURL(baseURL, url), query), {
        ...defaultInit,
        ...requestInit,
        method,
        headers,
        body: preparedBody,
        signal: composed.signal,
      })
    } catch (error) {
      composed.cleanup()
      throw error
    }
    let response: Response | undefined

    try {
      await onRequest?.({ request })
      response = await fetch(request)
      await onResponse?.({ request, response })

      if (!response.ok) throw new HttpError(request, response)
      if (raw) return response
      if (method === 'HEAD') return undefined as T
      return (await parseResponse(response, responseType as ResponseType | undefined)) as T
    } catch (error) {
      await onError?.({ request, response, error })
      throw error
    } finally {
      composed.cleanup()
    }
  }

  const method = (name: string): RequestMethod =>
    (<T = unknown>(url: URLInput, requestOptions: RequestOptions = {}): Promise<T> =>
      execute<T>(name, url, requestOptions, false) as Promise<T>) as RequestMethod

  return {
    get: method('GET'),
    post: method('POST'),
    put: method('PUT'),
    patch: method('PATCH'),
    delete: method('DELETE'),
    head: (url, requestOptions = {}) =>
      execute<undefined>('HEAD', url, requestOptions, false) as Promise<undefined>,
    options: method('OPTIONS'),
    raw(url: URLInput, rawOptions: RawRequestOptions = {}) {
      const { method: rawMethod = 'GET', ...requestOptions } = rawOptions
      return execute(rawMethod.toUpperCase(), url, requestOptions, true) as Promise<Response>
    },
  }
}
