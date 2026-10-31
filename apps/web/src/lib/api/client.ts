import { config } from '@/config'
import type { ApiErrorBody, ApiErrorDetail } from './types'

// ---------- Token storage ----------

const TOKEN_KEY = 'subscribby.token'

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* storage unavailable: the session lasts until reload */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
  },
}

// ---------- Errors ----------

/** Every failed call throws this. `code` matches the spec's error table (section 2). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: ApiErrorDetail[]

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  /** Field errors as { field: message }, handy for react-hook-form's setError. */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.details.map((d) => [d.field, d.message]))
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError

/** Session-level errors (expired token, forced password change, disabled account) are broadcast here. */
type SessionErrorListener = (error: ApiError) => void
const sessionListeners = new Set<SessionErrorListener>()
const SESSION_CODES = new Set(['UNAUTHENTICATED', 'PASSWORD_CHANGE_REQUIRED', 'ACCOUNT_DISABLED'])

export function onSessionError(listener: SessionErrorListener) {
  sessionListeners.add(listener)
  return () => {
    sessionListeners.delete(listener)
  }
}

// ---------- Request ----------

export type QueryParams = Record<string, string | number | boolean | null | undefined>

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  query?: QueryParams
  body?: unknown
  signal?: AbortSignal
  /** Return the response body as text (CSV exports). */
  asText?: boolean
}

function buildUrl(path: string, query?: QueryParams) {
  const base = config.apiBaseUrl.replace(/\/$/, '')
  const url = new URL(base + path, window.location.origin)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  }
  return url.toString()
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`

  let body: BodyInit | undefined
  if (options.body instanceof FormData) {
    body = options.body
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body,
      signal: options.signal,
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    throw new ApiError(0, 'NETWORK_ERROR', "Can't reach the server. Is the API running on port 4000?")
  }

  if (response.status === 204) return undefined as T

  const isJson = response.headers.get('content-type')?.includes('application/json') ?? false

  if (!response.ok) {
    const payload = isJson ? ((await response.json().catch(() => null)) as ApiErrorBody | null) : null
    const error = new ApiError(
      response.status,
      payload?.error?.code ?? 'INTERNAL',
      payload?.error?.message ?? `Request failed (${response.status})`,
      payload?.error?.details ?? [],
    )
    if (SESSION_CODES.has(error.code)) sessionListeners.forEach((listener) => listener(error))
    throw error
  }

  if (options.asText || !isJson) return (await response.text()) as T
  return (await response.json()) as T
}

export const http = {
  get: <T>(path: string, query?: QueryParams, signal?: AbortSignal) => request<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown, query?: QueryParams) => request<T>(path, { method: 'POST', body, query }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T = void>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
  text: (path: string, query?: QueryParams) => request<string>(path, { query, asText: true }),
}
