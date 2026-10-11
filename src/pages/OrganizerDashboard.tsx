const events = [
  {
    id: 1,
    title: "Tech Conference 2026",
    date: "September 30, 2026",
    ticketsSold: 120,
    revenue: 600000,
  },
  {
    id: 2,
    title: "Jazz Night",
    date: "October 5, 2026",
    ticketsSold: 75,
    revenue: 600000,
  },
]

function OrganizerDashboard() {
  const totalTickets = events.reduce(
    (sum, event) => sum + event.ticketsSold,
    0
  )

  const totalRevenue = events.reduce(
    (sum, event) => sum + event.revenue,
    0
  )

  return (
    <main className="page-container">
      <h1>Organizer Dashboard</h1>
      <p className="muted">
        Manage your events and track ticket sales.
      </p>

      <section className="stats-grid">
        <div className="panel">
          <p className="muted">Total Events</p>
          <h2>{events.length}</h2>
        </div>

        <div className="panel">
          <p className="muted">Tickets Sold</p>
          <h2>{totalTickets}</h2>
        </div>

        <div className="panel">
          <p className="muted">Total Revenue</p>
          <h2>{totalRevenue.toLocaleString()} ₸</h2>
        </div>
      </section>

      <section className="panel">
        <h2>Your Events</h2>

        {events.map((event) => (
          <article className="event-row" key={event.id}>
            <div>
              <h3>{event.title}</h3>
              <p className="muted">{event.date}</p>
              <p>Tickets sold: {event.ticketsSold}</p>
              <p>Revenue: {event.revenue.toLocaleString()} ₸</p>
            </div>
          </article>
        ))}
      </section>

      <section className="panel">
        <h2>Attendee List</h2>
        <p className="muted">
          Attendee information will appear here after the backend
          attendee endpoint is connected.
        </p>
      </section>
    </main>
  )
}

export default OrganizerDashboard
