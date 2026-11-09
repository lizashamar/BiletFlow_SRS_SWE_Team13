import { useEffect, useState } from "react"
import type { Event } from "../App"

type Props = {
  onSelectEvent: (event: Event) => void
}

function EventCatalog({ onSelectEvent }: Props) {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/events")

        if (!response.ok) {
          throw new Error("The server could not load events.")
        }

        const data: Event[] = await response.json()
        setEvents(data)
      } catch {
        setError(
          "Could not load events. Check that the backend is running."
        )
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [])

  const buttonStyle = {
    backgroundColor: "#111827",
    color: "white",
    border: "none",
    padding: "10px 16px",
    borderRadius: "6px",
    cursor: "pointer",
  }

  return (
    <main
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "40px 24px",
      }}
    >
      <h1>Discover Events</h1>
      <p style={{ color: "#666" }}>
        Find your next event on BiletFlow.
      </p>

      {loading && <p>Loading events...</p>}

      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && events.length === 0 && (
        <p>No events are available right now.</p>
      )}

      {!loading && !error && events.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "24px",
            marginTop: "30px",
          }}
        >
          {events.map((event) => (
            <div
              key={event.id}
              style={{
                backgroundColor: "white",
                padding: "24px",
                borderRadius: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
            >
              <h2>{event.title}</h2>
              <p>📅 {new Date(event.date).toLocaleDateString()}</p>
              <p>
                <strong>{event.price.toLocaleString()} ₸</strong>
              </p>

              <button
                style={buttonStyle}
                onClick={() => onSelectEvent(event)}
              >
                Select Event
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

export default EventCatalog
