# simplehttp

> Browser-only, zero-dependency HTTP client built on native Fetch.

`simplehttp` adds typed data returns, JSON request bodies, query parameters, HTTP errors, timeouts, and small lifecycle hooks while retaining Fetch primitives and behavior.

## Installation

```bash
pnpm add @slincnik/simplehttp
```

## Basic usage

```ts
import { createClient } from '@slincnik/simplehttp'

interface User {
  id: number
  name: string
}

const api = createClient({ baseURL: '/api' })
const users = await api.get<User[]>('/users')
```

Request-level native Fetch options override client defaults.

## POST

Plain objects and arrays are JSON-stringified. `Content-Type: application/json` is added unless already set. Native bodies such as strings, `FormData`, `Blob`, `ArrayBuffer`, `URLSearchParams`, and `ReadableStream` pass through unchanged.

```ts
const user = await api.post<User>('/users', {
  body: { name: 'John' },
  credentials: 'include',
})
```

## Query params

```ts
await api.get('/users', {
  query: { page: 1, active: true, search: 'john', filter: null },
})
```

Values may be strings, numbers, booleans, `null`, or `undefined`. `undefined` is omitted; `null` becomes an empty value (`filter=`). Existing query parameters are preserved. Nested values and arrays are not supported in v1.

## Headers

Headers are merged with native, case-insensitive `Headers` behavior. Request headers take precedence.

```ts
const api = createClient({
  headers: { Authorization: 'Bearer token' },
})

await api.get('/users', {
  headers: { 'X-Request-ID': '123' },
})
```

## Response parsing

JSON and text content types are detected automatically; other content defaults to `Blob`. Select a parser explicitly when needed:

```ts
const text = await api.get<string>('/readme', { responseType: 'text' })
const file = await api.get<Blob>('/file', { responseType: 'blob' })
const bytes = await api.get<ArrayBuffer>('/file', { responseType: 'arrayBuffer' })
```

`204`, `205`, and successful `HEAD` responses return `undefined`.

## Hooks

Hooks are optional and run in this order: `onRequest`, Fetch, `onResponse`, parsing. `onResponse` also runs for HTTP error responses. `onError` runs after network failures, hook failures, or non-success HTTP responses. Hooks may be async; thrown hook errors propagate, and an `onError` rejection replaces the original error. Contexts expose native objects, so use `response.clone()` if a hook needs to read a body without consuming it.

```ts
const api = createClient({
  async onRequest({ request }) {
    console.log(request.method, request.url)
  },
  onResponse({ response }) {
    console.log(response.status)
  },
  onError({ error, response }) {
    console.error(response?.status, error)
  },
})
```

## Error handling

Non-2xx responses throw `HttpError`. Network and cancellation errors remain native errors.

```ts
import { HttpError } from '@slincnik/simplehttp'

try {
  await api.get('/users/1')
} catch (error) {
  if (error instanceof HttpError) {
    console.log(error.status)
    console.log(error.request)
    console.log(error.response)
  }
}
```

The error response body is not consumed by the client.

## Cancellation

Use native cancellation directly:

```ts
const controller = new AbortController()
const request = api.get('/users', { signal: controller.signal })
controller.abort()
await request
```

## Timeout

Timeouts use `AbortController`. A request signal and timeout are composed; timing out does not abort the caller's controller.

```ts
await api.get('/users', { timeout: 5000 })
```

A timeout rejects with a native `DOMException` named `TimeoutError`. Client-level timeout defaults may be overridden per request. For parsed methods the timeout includes body parsing; for `raw`, it ends when the response is returned.

## Raw response

`raw` skips parsing and returns the native, unconsumed `Response`. Like parsed methods, it throws `HttpError` for non-2xx responses.

```ts
const response = await api.raw('/users')
const created = await api.raw('/users', {
  method: 'POST',
  body: { name: 'John' },
})
```

## Browser support

This package assumes a modern browser with Fetch, `Request`, `Response`, `Headers`, `AbortController`, `AbortSignal.any`, `URLSearchParams`, and related web platform APIs. It performs no environment detection and provides no server runtime adapter.

Relative `baseURL` values such as `/api` resolve through the browser's native `Request` behavior. Absolute request URLs bypass `baseURL`; other request paths are joined to it without discarding the base path.

## Design philosophy

The API is an ergonomic extension of Fetch, not an Axios compatibility layer. It uses web platform objects, exposes native request options, has no runtime dependencies or initialization side effects, and deliberately keeps lifecycle hooks simple.

Not supported in v1: retries, caching, deduplication, auth refresh, cookie abstractions, progress events, XHR, Node/SSR/React Native adapters, proxies or agents, WebSocket/SSE wrappers, OpenAPI or route schemas, framework hooks, runtime validation, and nested query serialization.

## Publishing

GitHub Releases publish the package automatically with pnpm. Before the first release, publish once with `pnpm publish` or temporarily configure the `REGISTRY_TOKEN` repository secret. Then configure npm Trusted Publishing for `Slincnik/SimpleHTTP` using the workflow filename `publish.yml` and remove the temporary secret. Release tags must match `package.json` versions, for example `v1.0.0`; prereleases publish under `next`.
