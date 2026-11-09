import { useCallback, useEffect, useMemo, useState } from "react"

type OrganizerEvent = {
  id: number
  title: string
  startTime: string
  endTime?: string
  status?: string
  venueName?: string
}
type EventStats = {
  event: { id: number; title: string; status: string }
  capacity: { eventCapacity: number; ticketCapacity: number; sold: number; remaining: number; percentSold: number }
  revenue: { grossSales: number; refunds: number; netRevenue: number; currency: string; simulated: boolean }
  byTicketType: { id: number; name: string; price: number; total: number; remaining: number; sold: number; revenue: number }[]
  salesOverTime: { date: string; orders: number; revenue: number }[]
  attendance: { checkedIn: number; absent: number; checkInPercent: number }
}
type Attendee = {
  ticketId: number
  attendeeName: string
  ticketType: string
  status: string
  buyerEmail: string
  registeredAt: string
  eventTitle: string
}
type EventAnalytics = { event: OrganizerEvent; stats: EventStats; attendees: Attendee[] }
type DailySales = { date: string; orders: number; revenue: number }

const API_BASE = "http://localhost:5000/api"

async function apiGet<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || body.message || `Request failed (${response.status})`)
  return body as T
}
const money = (value: number) =>
  `${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} ₸`
const dateLabel = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

function OrganizerDashboard() {
  const [analytics, setAnalytics] = useState<EventAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [period, setPeriod] = useState<"week" | "all">("week")
  const [selectedEvent, setSelectedEvent] = useState("all")

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError("")
    const token = localStorage.getItem("token")
    if (!token) {
      setAnalytics([])
      setError("You are not logged in. Please log in with an organizer account and open the dashboard again.")
      setLoading(false)
      return
    }
    try {
      const events = await apiGet<OrganizerEvent[]>("/events/mine", token)
      const result = await Promise.all(events.map(async (event) => {
        const stats = await apiGet<EventStats>(`/events/${event.id}/stats`, token)
        let attendees: Attendee[] = []
        try {
          const response = await apiGet<{ attendees: Omit<Attendee, "eventTitle">[] }>(
            `/events/${event.id}/attendees`, token
          )
          attendees = (response.attendees || []).map((a) => ({ ...a, eventTitle: event.title }))
        } catch (attendeeError) {
          console.warn(`Could not load attendees for event ${event.id}`, attendeeError)
        }
        return { event, stats, attendees }
      }))
      setAnalytics(result)
    } catch (loadError) {
      setAnalytics([])
      setError(loadError instanceof Error ? loadError.message : "Could not load organizer analytics.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadDashboard() }, [loadDashboard])

  const visible = useMemo(
    () => selectedEvent === "all" ? analytics : analytics.filter(x => String(x.event.id) === selectedEvent),
    [analytics, selectedEvent]
  )
  const totals = useMemo(() => visible.reduce((a, x) => ({
    events: a.events + 1,
    tickets: a.tickets + x.stats.capacity.sold,
    revenue: a.revenue + x.stats.revenue.netRevenue,
    checkedIn: a.checkedIn + x.stats.attendance.checkedIn,
  }), { events: 0, tickets: 0, revenue: 0, checkedIn: 0 }), [visible])

  const dailySales = useMemo(() => {
    const combined = new Map<string, DailySales>()
    visible.forEach(({ stats }) => stats.salesOverTime.forEach(day => {
      const current = combined.get(day.date) || { date: day.date, orders: 0, revenue: 0 }
      current.orders += day.orders
      current.revenue += day.revenue
      combined.set(day.date, current)
    }))
    const all = [...combined.values()].sort((a, b) => a.date.localeCompare(b.date))
    if (period === "all") return all
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const first = new Date(today)
    first.setDate(today.getDate() - 6)
    return all.filter(day => {
      const d = new Date(`${day.date}T00:00:00`)
      return d >= first && d <= today
    })
  }, [visible, period])

  const maxRevenue = Math.max(1, ...dailySales.map(x => x.revenue))
  const attendees = visible.flatMap(x => x.attendees)

  return (
    <main style={page}>
      <div style={header}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Organizer Dashboard</h1>
          <p style={{ color: "#64748b", marginTop: 0 }}>Track your events, ticket sales, revenue and attendees.</p>
        </div>
        <button onClick={() => void loadDashboard()} disabled={loading} style={button}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {loading && <p>Loading your event analytics...</p>}
      {error && <p role="alert" style={errorBox}>{error}</p>}
      {!loading && !error && analytics.length === 0 && (
        <section style={panel}><h2>No events yet</h2><p>Your event statistics will appear here after you create an event and receive orders.</p></section>
      )}

      {!loading && !error && analytics.length > 0 && <>
        <div style={filterRow}>
          <label htmlFor="event-filter">Show statistics for</label>
          <select id="event-filter" value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} style={select}>
            <option value="all">All my events</option>
            {analytics.map(({ event }) => <option key={event.id} value={String(event.id)}>{event.title}</option>)}
          </select>
        </div>

        <section style={cards}>
          <div style={card}><p style={label}>My Events</p><h2 style={number}>{totals.events}</h2></div>
          <div style={card}><p style={label}>Tickets Sold</p><h2 style={number}>{totals.tickets.toLocaleString()}</h2></div>
          <div style={card}><p style={label}>Net Sales</p><h2 style={number}>{money(totals.revenue)}</h2></div>
          <div style={card}><p style={label}>Checked In</p><h2 style={number}>{totals.checkedIn.toLocaleString()}</h2></div>
        </section>

        <section style={panel}>
          <div style={header}>
            <div><h2 style={{ margin: 0 }}>Sales Overview</h2><p style={{ color: "#64748b" }}>Daily order revenue</p></div>
            <select value={period} onChange={e => setPeriod(e.target.value as "week" | "all")} style={select} aria-label="Sales chart period">
              <option value="week">Last 7 days</option><option value="all">All available data</option>
            </select>
          </div>
          {dailySales.length === 0 ? <p>No sales activity for this period yet.</p> : (
            <div style={chart}>
              {dailySales.map(day => <div key={day.date} style={barColumn}>
                <span style={barValue}>{money(day.revenue)}</span>
                <div title={`${day.orders} orders · ${money(day.revenue)}`} style={{ ...bar, height: `${Math.max(4, day.revenue / maxRevenue * 180)}px` }} />
                <span style={dayText}>{dateLabel(day.date)}</span><span style={small}>{day.orders} orders</span>
              </div>)}
            </div>
          )}
          <p style={small}>Revenue is reported in KZT. The backend currently marks payment totals as simulated.</p>
        </section>

        <section style={panel}>
          <h2>My Events</h2><div style={{ overflowX: "auto" }}>
            <table style={table}><thead><tr>
              {["Event", "Date", "Tickets sold", "Capacity", "Net sales", "Check-in"].map(x => <th key={x} style={cell}>{x}</th>)}
            </tr></thead><tbody>
              {visible.map(({ event, stats }) => <tr key={event.id}>
                <td style={cell}><strong>{event.title}</strong><div style={small}>{event.venueName || ""}</div></td>
                <td style={cell}>{dateLabel(event.startTime)}</td><td style={cell}>{stats.capacity.sold}</td>
                <td style={cell}>{stats.capacity.ticketCapacity}</td><td style={cell}>{money(stats.revenue.netRevenue)}</td>
                <td style={cell}>{stats.attendance.checkedIn} ({stats.attendance.checkInPercent}%)</td>
              </tr>)}
            </tbody></table>
          </div>
        </section>

        <section style={panel}>
          <h2>Ticket Type Performance</h2>
          {visible.map(({ event, stats }) => <div key={event.id} style={{ marginBottom: 20 }}>
            <h3>{event.title}</h3>
            {stats.byTicketType.length === 0 ? <p>No ticket types available.</p> : <div style={{ overflowX: "auto" }}>
              <table style={table}><thead><tr>
                {["Ticket type", "Price", "Sold", "Remaining", "Revenue"].map(x => <th key={x} style={cell}>{x}</th>)}
              </tr></thead><tbody>
                {stats.byTicketType.map(t => <tr key={t.id}>
                  <td style={cell}>{t.name}</td><td style={cell}>{money(t.price)}</td><td style={cell}>{t.sold}</td>
                  <td style={cell}>{t.remaining}</td><td style={cell}>{money(t.revenue)}</td>
                </tr>)}
              </tbody></table>
            </div>}
          </div>)}
        </section>

        <section style={panel}>
          <h2>Attendee List</h2>
          {attendees.length === 0 ? <p>No attendee records are available for these events yet.</p> : <div style={{ overflowX: "auto" }}>
            <table style={table}><thead><tr>
              {["Name", "Email", "Event", "Ticket type", "Status", "Registered"].map(x => <th key={x} style={cell}>{x}</th>)}
            </tr></thead><tbody>
              {attendees.map(a => <tr key={a.ticketId}>
                <td style={cell}>{a.attendeeName}</td><td style={cell}>{a.buyerEmail}</td><td style={cell}>{a.eventTitle}</td>
                <td style={cell}>{a.ticketType}</td><td style={cell}>{a.status}</td><td style={cell}>{dateLabel(a.registeredAt)}</td>
              </tr>)}
            </tbody></table>
          </div>}
        </section>
      </>}
    </main>
  )
}

const page = { maxWidth: "1200px", margin: "0 auto", padding: "32px 24px", fontFamily: "Arial, sans-serif", color: "#111827" }
const header = { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: "16px" }
const filterRow = { display: "flex", alignItems: "center", gap: "10px", marginTop: "20px" }
const cards = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "16px", margin: "24px 0" }
const card = { background: "#fff", padding: "22px", borderRadius: "12px", border: "1px solid #e2e8f0" }
const panel = { background: "#fff", padding: "24px", marginTop: "24px", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" as const }
const label = { color: "#64748b", margin: 0 }
const number = { fontSize: "26px", marginBottom: 0 }
const chart = { display: "flex", alignItems: "flex-end", gap: "12px", minHeight: "250px", padding: "24px 8px 8px", overflowX: "auto" as const, borderBottom: "1px solid #e2e8f0" }
const barColumn = { display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "flex-end", flex: "1 0 90px", gap: "7px", height: "230px" }
const bar = { width: "min(42px, 85%)", background: "#2563eb", borderRadius: "6px 6px 0 0", minHeight: "4px", transition: "height 0.25s ease" }
const barValue = { fontSize: "11px", color: "#475569", whiteSpace: "nowrap" as const }
const dayText = { fontSize: "12px", color: "#64748b", whiteSpace: "nowrap" as const }
const small = { color: "#64748b", fontSize: "12px" }
const button = { padding: "10px 16px", border: 0, borderRadius: "8px", background: "#2563eb", color: "white", cursor: "pointer" }
const select = { padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "white" }
const errorBox = { padding: "12px 16px", borderRadius: "8px", background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }
const table = { width: "100%", borderCollapse: "collapse" as const, textAlign: "left" as const }
const cell = { padding: "12px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" as const }

export default OrganizerDashboard
