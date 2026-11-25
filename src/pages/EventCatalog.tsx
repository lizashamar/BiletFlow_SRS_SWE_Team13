import { useEffect, useMemo, useState } from "react"
import Icon from "../components/Icon"
import EventCover from "../components/EventCover"
import { CATEGORIES, api, categoryOf, coverOf, errorText, priceLabel, shortDate } from "../api"
import type { Event } from "../api"

type Props = {
  onSelectEvent: (event: Event) => void
}

const ticketsLeft = (e: Event) => e.ticketTypes.reduce((s, t) => s + t.remainingQuantity, 0)


type DateFilter = "any" | "now" | "today" | "week" | "month"

const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: "any", label: "Any date" },
  { value: "now", label: "Happening now" },
  { value: "today", label: "Today" },
  { value: "week", label: "Next 7 days" },
  { value: "month", label: "Next 30 days" },
]

function matchesDate(e: Event, filter: DateFilter) {
  if (filter === "any") return true
  const now = new Date()
  const start = new Date(e.startTime)
  const end = new Date(e.endTime)
  if (filter === "now") return start <= now && end >= now
  const limit = new Date(now)
  if (filter === "today") limit.setHours(23, 59, 59, 999)
  if (filter === "week") limit.setDate(limit.getDate() + 7)
  if (filter === "month") limit.setDate(limit.getDate() + 30)
  return start <= limit && end >= now
}

function EventCatalog({ onSelectEvent }: Props) {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("All")
  const [dateFilter, setDateFilter] = useState<DateFilter>("any")

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true)
      setError("")
      try {
        const q = query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ""
        setEvents(await api<Event[]>(`/events?upcoming=true${q}`))
      } catch (err) {
        setError(errorText(err, "Could not load events."))
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const visible = useMemo(
    () =>
      events.filter(
        (e) => (category === "All" || categoryOf(e.title) === category) && matchesDate(e, dateFilter)
      ),
    [events, category, dateFilter]
  )
  const presentCategories = CATEGORIES.filter((c) => events.some((e) => categoryOf(e.title) === c))
  const available = visible.filter((e) => ticketsLeft(e) > 0)
  const featured = available.find((e) => e.price > 0) ?? available[0]

  return (
    <main className="page-container">
      <section className="hero">
        <h1>Find events in Kazakhstan</h1>
        <p className="muted">Concerts, conferences, festivals and more — Almaty, Astana, Shymkent and beyond.</p>

        <div className="search-bar">
          <label className="search-field">
            <Icon name="search" />
            <input
              placeholder="Search events by title..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search events"
            />
          </label>
          <label className="search-field date-field">
            <Icon name="calendar" />
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)} aria-label="Filter by date">
              {DATE_FILTERS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="chips">
          {["All", ...presentCategories].map((c) => (
            <button key={c} className={`chip ${category === c ? "active" : ""}`} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
      </section>

      {loading && events.length === 0 && <p className="muted">Loading events...</p>}
      {error && <p role="alert" className="error-box">{error}</p>}
      {!loading && !error && visible.length === 0 && <p className="muted">No events match these filters.</p>}

      {featured && (
        <>
          <h2 className="section-title">Featured Event</h2>
          <article
            className="featured"
            style={{ background: coverOf(featured.title) }}
            onClick={() => onSelectEvent(featured)}
          >
            <div className="cover-pattern" />
            <div>
              <span className="badge">{categoryOf(featured.title)}</span>
              {featured.status === "ACTIVE" && <span className="badge live-badge">● Live now</span>}
              <h2>{featured.title}</h2>
              <div className="meta">
                <span><Icon name="calendar" /> {shortDate(featured.startTime)}</span>
                <span><Icon name="pin" /> {featured.venueName}</span>
                <span><strong>{priceLabel(featured)}</strong></span>
              </div>
            </div>
          </article>
        </>
      )}

      {visible.length > 0 && (
        <>
          <h2 className="section-title">
            Upcoming Events <span>({visible.length})</span>
          </h2>
          <div className="event-grid">
            {visible.map((event) => {
              const left = ticketsLeft(event)
              return (
                <article key={event.id} className="event-card" onClick={() => onSelectEvent(event)}>
                  <EventCover title={event.title} live={event.status === "ACTIVE"} />
                  <div className="event-body">
                    <h3>{event.title}</h3>
                    <div className="meta" style={{ flexDirection: "column" }}>
                      <span><Icon name="calendar" /> {shortDate(event.startTime)}</span>
                      <span><Icon name="pin" /> {event.venueName}</span>
                    </div>
                    <div className="event-footer">
                      <div className="price">
                        <small>{left > 0 ? `${left} tickets left` : "sold out"}</small>
                        <strong>{priceLabel(event)}</strong>
                      </div>
                      <button className="primary-button small-button" disabled={left === 0}>
                        {left > 0 ? "Get Tickets" : "Sold out"}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      )}
    </main>
  )
}

export default EventCatalog
