const events = [
  {
    id: 1,
    title: "Tech Conference 2026",
    date: "September 30, 2026",
    location: "Astana",
    price: 5000,
  },
  {
    id: 2,
    title: "Jazz Night",
    date: "October 5, 2026",
    location: "Almaty",
    price: 8000,
  },
  {
    id: 3,
    title: "Football Championship",
    date: "October 10, 2026",
    location: "Astana",
    price: 10000,
  },
]

function EventCatalog() {
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

            <p>📅 {event.date}</p>

            <p>📍 {event.location}</p>

            <p>
              <strong>{event.price.toLocaleString()} ₸</strong>
            </p>

            <button
              style={{
                backgroundColor: "#111827",
                color: "white",
                border: "none",
                padding: "10px 16px",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              View Event
            </button>
          </div>
        ))}
      </div>
    </main>
  )
}

export default EventCatalog
