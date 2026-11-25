export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:5000/api"

export type Role = "ATTENDEE" | "ORGANIZER" | "EVENT_ADMIN" | "PLATFORM_ADMIN"

export type User = {
  id: number
  name: string
  email: string
  role: Role
}

export type TicketType = {
  id: number
  name: string
  price: number
  isPaid: boolean
  totalQuantity: number
  remainingQuantity: number
}

export type Event = {
  id: number
  title: string
  description?: string | null
  venueName: string
  venueAddress: string
  startTime: string
  endTime: string
  capacity: number
  isPublished: boolean
  paidSalesActive: boolean
  status: "UPCOMING" | "ACTIVE" | "COMPLETED"
  price: number
  ticketTypes: TicketType[]
}

const TOKEN_KEY = "token"
const USER_KEY = "user"

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function saveSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export class ApiError extends Error {
  status: number
  body: Record<string, unknown>

  constructor(status: number, message: string, body: Record<string, unknown>) {
    super(message)
    this.status = status
    this.body = body
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body !== undefined) headers["Content-Type"] = "application/json"

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new ApiError(0, "Cannot reach the server. Is the backend running on port 5000?", {})
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && token) clearSession()
    throw new ApiError(response.status, data.error || data.message || `Request failed (${response.status})`, data)
  }
  return data as T
}

export const money = (value: number) =>
  `${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} ₸`

export const dateTime = (value: string) => {
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export const errorText = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback
