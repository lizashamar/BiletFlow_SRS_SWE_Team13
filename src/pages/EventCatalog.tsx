import { useEffect, useState } from "react"
import { api, dateTime, errorText, money } from "../api"
import type { Event } from "../api"

type Props = {
  onSelectEvent: (event: Event) => void
}

function EventCatalog({ onSelectEvent }: Props) {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")

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

  return (
    <main className="page-container">
      <h1>Discover Events</h1>
      <p className="muted">Find your next event on BiletFlow.</p>

      <input
        className="search-input"
        placeholder="Search events by title..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search events"
      />

      {loading && <p>Loading events...</p>}
      {error && <p role="alert" className="error-box">{error}</p>}
      {!loading && !error && events.length === 0 && <p>No upcoming events right now.</p>}

      {!loading && !error && events.length > 0 && (
        <div className="event-grid">
          {events.map((event) => {
            const left = event.ticketTypes.reduce((s, t) => s + t.remainingQuantity, 0)
            return (
              <article key={event.id} className="event-card">
                <h2>{event.title}</h2>
                <p>📅 {dateTime(event.startTime)}</p>
                <p>📍 {event.venueName}</p>
                <p>
                  <strong>{event.price > 0 ? `from ${money(event.price)}` : "Free"}</strong>
                </p>
                <p className="muted">{left > 0 ? `${left} tickets left` : "Sold out"}</p>
                <button className="primary-button" disabled={left === 0} onClick={() => onSelectEvent(event)}>
                  {left > 0 ? "Get tickets" : "Sold out"}
                </button>
              </article>
            )
          })}
        </div>
      )}
    </main>
  )
}

export default EventCatalog
