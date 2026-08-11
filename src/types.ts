export type QueryValue = string | number | boolean | null | undefined
export type Query = Record<string, QueryValue>

export type ResponseType = 'json' | 'text' | 'blob' | 'arrayBuffer'
/** A plain object or array. Plain values are JSON-serialized at runtime. */
export type JsonBody = object
export type RequestBody = BodyInit | JsonBody

export interface RequestContext {
  request: Request
}

export interface ResponseContext extends RequestContext {
  response: Response
}

export interface ErrorContext extends RequestContext {
  response?: Response
  error: unknown
}

export type RequestHook = (context: RequestContext) => void | Promise<void>
export type ResponseHook = (context: ResponseContext) => void | Promise<void>
export type ErrorHook = (context: ErrorContext) => void | Promise<void>

export interface RequestOptions extends Omit<RequestInit, 'body' | 'headers' | 'method'> {
  body?: RequestBody
  headers?: HeadersInit
  query?: Query
  responseType?: ResponseType
  timeout?: number
}

export interface RawRequestOptions extends RequestOptions {
  method?: string
}

export interface ClientOptions extends Omit<RequestInit, 'body' | 'headers' | 'method'> {
  baseURL?: string
  headers?: HeadersInit
  responseType?: ResponseType
  timeout?: number
  onRequest?: RequestHook
  onResponse?: ResponseHook
  onError?: ErrorHook
}

export type URLInput = string | URL

type OptionsFor<T extends ResponseType> = Omit<RequestOptions, 'responseType'> & { responseType: T }

export interface RequestMethod {
  (url: URLInput, options: OptionsFor<'text'>): Promise<string>
  (url: URLInput, options: OptionsFor<'blob'>): Promise<Blob>
  (url: URLInput, options: OptionsFor<'arrayBuffer'>): Promise<ArrayBuffer>
  <T = unknown>(url: URLInput, options?: RequestOptions): Promise<T>
}

export interface Client {
  get: RequestMethod
  post: RequestMethod
  put: RequestMethod
  patch: RequestMethod
  delete: RequestMethod
  head(url: URLInput, options?: RequestOptions): Promise<undefined>
  options: RequestMethod
  raw(url: URLInput, options?: RawRequestOptions): Promise<Response>
}
