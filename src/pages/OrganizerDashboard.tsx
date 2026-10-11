import { useEffect, useState } from "react"

type OrganizerEvent = {
  id: number
  title: string
  date: string
}

type Attendee = {
  name: string
  email: string
  eventTitle: string
}

type DashboardData = {
  events: OrganizerEvent[]
  attendees: Attendee[]
  ticketsSold: number
  totalSales: number
}

function OrganizerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/organizer/dashboard"
        )

        if (!response.ok) {
          throw new Error(
            "The organizer dashboard API is not available yet."
          )
        }

        const result: DashboardData = await response.json()
        setData(result)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not load dashboard information."
        )
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [])

  return (
    <main
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "40px 24px",
      }}
    >
      <h1>Organizer Dashboard</h1>
      <p style={{ color: "#666" }}>
        Manage your events and track ticket sales.
      </p>

      {loading && <p>Loading dashboard...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {data && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "16px",
              margin: "24px 0",
            }}
          >
            <div style={cardStyle}>
              <p>My Events</p>
              <h2>{data.events.length}</h2>
            </div>

            <div style={cardStyle}>
              <p>Tickets Sold</p>
              <h2>{data.ticketsSold}</h2>
            </div>

            <div style={cardStyle}>
              <p>Total Sales</p>
              <h2>{data.totalSales.toLocaleString()} ₸</h2>
            </div>
          </div>

          <h2>My Events</h2>

          {data.events.length === 0 ? (
            <p>You have not created any events yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={cellStyle}>Event</th>
                    <th style={cellStyle}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((event) => (
                    <tr key={event.id}>
                      <td style={cellStyle}>{event.title}</td>
                      <td style={cellStyle}>
                        {new Date(event.date).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 style={{ marginTop: "36px" }}>Attendee List</h2>

          {data.attendees.length === 0 ? (
            <p>No attendee information is available.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={cellStyle}>Name</th>
                    <th style={cellStyle}>Email</th>
                    <th style={cellStyle}>Event</th>
                  </tr>
                </thead>
                <tbody>
                  {data.attendees.map((attendee, index) => (
                    <tr key={`${attendee.email}-${index}`}>
                      <td style={cellStyle}>{attendee.name}</td>
                      <td style={cellStyle}>{attendee.email}</td>
                      <td style={cellStyle}>{attendee.eventTitle}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  )
}

const cardStyle = {
  backgroundColor: "white",
  padding: "20px",
  borderRadius: "10px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
}

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse" as const,
  textAlign: "left" as const,
}

const cellStyle = {
  padding: "12px",
  borderBottom: "1px solid #ddd",
}

export default OrganizerDashboard
