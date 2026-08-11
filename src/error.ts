export class HttpError extends Error {
  readonly request: Request
  readonly response: Response
  readonly status: number

  constructor(request: Request, response: Response) {
    super(`HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`)
    this.name = 'HttpError'
    this.request = request
    this.response = response
    this.status = response.status
  }
}
