import { createClient, type RequestMethod } from '@slincnik/simplehttp'

interface User {
  id: number
  name: string
}

const api = createClient({ baseURL: '/api' })
const input: User = { id: 1, name: 'Danya' }

const user: Promise<User> = api.get<User>('/users/1')
const text: Promise<string> = api.get('/readme', { responseType: 'text' })
const blob: Promise<Blob> = api.get('/file', { responseType: 'blob' })
const bytes: Promise<ArrayBuffer> = api.get('/file', { responseType: 'arrayBuffer' })
const empty: Promise<undefined> = api.head('/users')
const method: RequestMethod = api.post

void api.post<User>('/users', { body: input })
void [user, text, blob, bytes, empty, method]
