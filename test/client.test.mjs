import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { createClient, HttpError } from '@slincnik/simplehttp'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function mockFetch(handler) {
  const requests = []
  globalThis.fetch = async (request) => {
    requests.push(request)
    return handler(request)
  }
  return requests
}

function json(value, init = {}) {
  return new Response(JSON.stringify(value), {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  })
}

test('GET sends a GET request and parses JSON', async () => {
  const requests = mockFetch(() => json({ id: 1 }))
  const result = await createClient().get('https://example.test/users/1')
  assert.deepEqual(result, { id: 1 })
  assert.equal(requests[0].method, 'GET')
})

test('POST sends a POST request', async () => {
  const requests = mockFetch(() => json({ created: true }))
  await createClient().post('https://example.test/users', { body: 'payload' })
  assert.equal(requests[0].method, 'POST')
  assert.equal(await requests[0].text(), 'payload')
})

test('baseURL joins paths without dropping the base path', async () => {
  const requests = mockFetch(() => json([]))
  const client = createClient({ baseURL: 'https://example.test/api/' })
  await client.get('/users')
  assert.equal(requests[0].url, 'https://example.test/api/users')
})

test('absolute request URLs and URL objects bypass baseURL', async () => {
  const requests = mockFetch(() => json([]))
  const client = createClient({ baseURL: 'https://example.test/api' })
  await client.get(new URL('https://other.test/users'))
  assert.equal(requests[0].url, 'https://other.test/users')
})

test('base and request query/hash components merge after the joined path', async () => {
  const requests = mockFetch(() => json([]))
  await createClient({ baseURL: 'https://example.test/api?tenant=1#base' }).get(
    '/users?active=true#users',
  )
  assert.equal(requests[0].url, 'https://example.test/api/users?tenant=1&active=true#users')
})

test('query-only and fragment-only references replace the matching base component', async () => {
  const requests = mockFetch(() => json([]))
  const client = createClient({ baseURL: 'https://example.test/api?tenant=1#base' })
  await client.get('?page=2')
  await client.get('#next')
  assert.equal(requests[0].url, 'https://example.test/api?page=2')
  assert.equal(requests[1].url, 'https://example.test/api?tenant=1#next')
})

test('query serializes primitives, preserves existing values, skips undefined, and encodes null as empty', async () => {
  const requests = mockFetch(() => json([]))
  await createClient().get('https://example.test/users?sort=name#top', {
    query: { page: 1, active: true, search: 'John Doe', empty: null, skip: undefined },
  })
  assert.equal(
    requests[0].url,
    'https://example.test/users?sort=name&page=1&active=true&search=John+Doe&empty=#top',
  )
})

test('global and request headers merge case-insensitively', async () => {
  const requests = mockFetch(() => json({}))
  const client = createClient({ headers: { Authorization: 'first', 'X-App': 'web' } })
  await client.get('https://example.test', {
    headers: { authorization: 'second', 'X-Request-ID': '123' },
  })
  const headers = requests[0].headers
  assert.equal(headers.get('authorization'), 'second')
  assert.equal(headers.get('x-app'), 'web')
  assert.equal(headers.get('x-request-id'), '123')
})

test('plain objects are JSON serialized and receive a content type', async () => {
  const requests = mockFetch(() => json({}))
  await createClient().post('https://example.test', { body: { name: 'John' } })
  assert.equal(requests[0].headers.get('content-type'), 'application/json')
  assert.deepEqual(await requests[0].json(), { name: 'John' })
})

test('an explicit content type is preserved for JSON serialization', async () => {
  const requests = mockFetch(() => json({}))
  await createClient().post('https://example.test', {
    headers: { 'Content-Type': 'application/vnd.api+json' },
    body: { id: 1 },
  })
  assert.equal(requests[0].headers.get('content-type'), 'application/vnd.api+json')
})

test('FormData is passed through without JSON serialization or a forced content type', async () => {
  const requests = mockFetch(() => json({}))
  const body = new FormData()
  body.set('name', 'John')
  await createClient().post('https://example.test', { body })
  assert.match(requests[0].headers.get('content-type'), /^multipart\/form-data; boundary=/)
  assert.equal((await requests[0].formData()).get('name'), 'John')
})

test('responseType text parses text', async () => {
  mockFetch(() => new Response('hello'))
  assert.equal(await createClient().get('https://example.test', { responseType: 'text' }), 'hello')
})

test('text content types are detected automatically', async () => {
  mockFetch(() => new Response('hello', { headers: { 'content-type': 'text/plain' } }))
  assert.equal(await createClient().get('https://example.test'), 'hello')
})

test('blob and arrayBuffer response types use native parsers', async () => {
  mockFetch(() => new Response('abc'))
  const blob = await createClient().get('https://example.test', { responseType: 'blob' })
  assert.equal(await blob.text(), 'abc')
  mockFetch(() => new Response('abc'))
  const buffer = await createClient().get('https://example.test', { responseType: 'arrayBuffer' })
  assert.equal(new TextDecoder().decode(buffer), 'abc')
})

test('204 and HEAD responses return undefined without parsing', async () => {
  mockFetch(() => new Response(null, { status: 204, headers: { 'content-type': 'application/json' } }))
  assert.equal(await createClient().get('https://example.test'), undefined)
  mockFetch(() => new Response(null, { headers: { 'content-type': 'application/json' } }))
  assert.equal(await createClient().head('https://example.test'), undefined)
})

test('raw returns the native unconsumed Response', async () => {
  mockFetch(() => json({ ok: true }))
  const response = await createClient().raw('https://example.test')
  assert.ok(response instanceof Response)
  assert.deepEqual(await response.json(), { ok: true })
})

test('raw supports a native method option', async () => {
  const requests = mockFetch(() => new Response(null, { status: 201 }))
  await createClient().raw('https://example.test', { method: 'post', body: 'value' })
  assert.equal(requests[0].method, 'POST')
})

test('non-success responses throw HttpError and preserve the Response body', async () => {
  mockFetch(() => json({ message: 'missing' }, { status: 404, statusText: 'Not Found' }))
  const error = await createClient().get('https://example.test').catch((failure) => failure)
  assert.ok(error instanceof HttpError)
  assert.equal(error.status, 404)
  assert.equal(error.request.url, 'https://example.test/')
  assert.deepEqual(await error.response.json(), { message: 'missing' })
})

test('native network errors remain unchanged', async () => {
  const failure = new TypeError('Failed to fetch')
  mockFetch(() => Promise.reject(failure))
  await assert.rejects(createClient().get('https://example.test'), (error) => error === failure)
})

test('a user AbortSignal cancels the native fetch boundary', async () => {
  globalThis.fetch = (request) => new Promise((resolve, reject) => {
    if (request.signal.aborted) reject(request.signal.reason)
    else request.signal.addEventListener('abort', () => reject(request.signal.reason), { once: true })
  })
  const controller = new AbortController()
  const pending = createClient().get('https://example.test', { signal: controller.signal })
  controller.abort()
  await assert.rejects(pending, (error) => error?.name === 'AbortError')
})

test('a raw response retains caller cancellation after headers arrive with timeout enabled', async () => {
  globalThis.fetch = async (request) => new Response(new ReadableStream({
    start(controller) {
      const abort = () => controller.error(request.signal.reason)
      if (request.signal.aborted) abort()
      else request.signal.addEventListener('abort', abort, { once: true })
    },
  }))
  const controller = new AbortController()
  const response = await createClient().raw('https://example.test', {
    signal: controller.signal,
    timeout: 1000,
  })
  controller.abort()
  await assert.rejects(response.text(), (error) => error?.name === 'AbortError')
})

test('timeout aborts and remains composed with a user signal', async () => {
  let receivedSignal
  globalThis.fetch = (request) => new Promise((resolve, reject) => {
    receivedSignal = request.signal
    request.signal.addEventListener('abort', () => reject(request.signal.reason), { once: true })
  })
  const controller = new AbortController()
  const pending = createClient().get('https://example.test', { timeout: 5, signal: controller.signal })
  await assert.rejects(pending, (error) => error?.name === 'TimeoutError')
  assert.equal(controller.signal.aborted, false)
  assert.equal(receivedSignal.aborted, true)
})

test('onRequest and onResponse run in order and support async hooks', async () => {
  const order = []
  mockFetch(async () => {
    order.push('fetch')
    return json({})
  })
  const client = createClient({
    async onRequest({ request }) {
      await Promise.resolve()
      order.push(`request:${request.method}`)
    },
    async onResponse({ response }) {
      await Promise.resolve()
      order.push(`response:${response.status}`)
    },
  })
  await client.get('https://example.test')
  assert.deepEqual(order, ['request:GET', 'fetch', 'response:200'])
})

test('an onError rejection replaces the original failure', async () => {
  const hookFailure = new Error('logging failed')
  mockFetch(() => Promise.reject(new TypeError('offline')))
  await assert.rejects(
    createClient({ onError: async () => { throw hookFailure } }).get('https://example.test'),
    (error) => error === hookFailure,
  )
})

test('onError receives HTTP responses and native errors', async () => {
  const contexts = []
  const client = createClient({ onError: async (context) => contexts.push(context) })
  mockFetch(() => new Response('bad', { status: 500 }))
  await assert.rejects(client.get('https://example.test'), HttpError)
  assert.equal(contexts[0].response.status, 500)
  assert.ok(contexts[0].error instanceof HttpError)

  const failure = new TypeError('offline')
  mockFetch(() => Promise.reject(failure))
  await assert.rejects(client.get('https://example.test'), (error) => error === failure)
  assert.equal(contexts[1].response, undefined)
  assert.equal(contexts[1].error, failure)
})

test('request native options override client defaults', async () => {
  const requests = mockFetch(() => json({}))
  const client = createClient({ credentials: 'include', cache: 'reload' })
  await client.get('https://example.test', { credentials: 'omit', cache: 'no-store' })
  assert.equal(requests[0].credentials, 'omit')
  assert.equal(requests[0].cache, 'no-store')
})
