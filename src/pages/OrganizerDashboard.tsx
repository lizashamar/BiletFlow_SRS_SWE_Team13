
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
  salesByDay: { day: string; sales: number }[]
}

const demoData: DashboardData = {
  events: [
    { id: 1, title: "Astana Tech Conference", date: "2026-11-01" },
    { id: 2, title: "Live Music Night", date: "2026-11-08" },
    { id: 3, title: "Digital Art Exhibition", date: "2026-11-15" },
  ],
  attendees: [
    {
      name: "Demo Attendee",
      email: "attendee@example.com",
      eventTitle: "Astana Tech Conference",
    },
  ],
  ticketsSold: 128,
  totalSales: 1920000,
  salesByDay: [
    { day: "Mon", sales: 12 },
    { day: "Tue", sales: 19 },
    { day: "Wed", sales: 15 },
    { day: "Thu", sales: 28 },
    { day: "Fri", sales: 35 },
    { day: "Sat", sales: 24 },
    { day: "Sun", sales: 18 },
  ],
}

function OrganizerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)
  const [filter, setFilter] = useState<"week" | "all">("week")

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const token = localStorage.getItem("token")

        const response = await fetch(
          "http://localhost:5000/api/organizer/dashboard",
          {
            headers: token
              ? { Authorization: `Bearer ${token}` }
              : {},
          }
        )

        if (!response.ok) {
          throw new Error("Organizer analytics API is unavailable")
        }

        const result: DashboardData = await response.json()
        setData(result)
      } catch {
        setData(demoData)
        setUsingDemo(true)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [])

  const chartData =
    filter === "week"
      ? data?.salesByDay ?? []
      : data?.salesByDay ?? []

  const maxSales = Math.max(
    1,
    ...chartData.map((item) => item.sales)
  )

  return (
    <main style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Organizer Dashboard</h1>
          <p style={{ color: "#64748b", marginTop: 0 }}>
            Track event performance and ticket sales.
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          style={buttonStyle}
        >
          Refresh
        </button>
      </div>

      {loading && <p>Loading dashboard...</p>}

      {usingDemo && !loading && (
        <p style={noticeStyle}>
          Demo mode: the organizer analytics API is not available.
          The figures below are sample data, not real sales.
        </p>
      )}

      {data && (
        <>
          <section style={cardsStyle}>
            <div style={cardStyle}>
              <p style={labelStyle}>My Events</p>
              <h2 style={numberStyle}>{data.events.length}</h2>
            </div>

            <div style={cardStyle}>
              <p style={labelStyle}>Tickets Sold</p>
              <h2 style={numberStyle}>
                {data.ticketsSold.toLocaleString()}
              </h2>
            </div>

            <div style={cardStyle}>
              <p style={labelStyle}>Total Sales</p>
              <h2 style={numberStyle}>
                {data.totalSales.toLocaleString()} ₸
              </h2>
            </div>
          </section>

          <section style={panelStyle}>
            <div style={headerStyle}>
              <div>
                <h2 style={{ margin: 0 }}>Sales Overview</h2>
                <p style={{ color: "#64748b" }}>
                  Tickets sold by day
                </p>
              </div>

              <select
                value={filter}
                onChange={(event) =>
                  setFilter(event.target.value as "week" | "all")
                }
                style={selectStyle}
                aria-label="Sales chart period"
              >
                <option value="week">This week</option>
                <option value="all">All available data</option>
              </select>
            </div>

            <div style={chartStyle}>
              {chartData.map((item) => (
                <div key={item.day} style={barColumnStyle}>
                  <span style={barValueStyle}>{item.sales}</span>
                  <div
                    title={`${item.sales} tickets`}
                    style={{
                      ...barStyle,
                      height: `${(item.sales / maxSales) * 180}px`,
                    }}
                  />
                  <span style={dayStyle}>{item.day}</span>
                </div>
              ))}
            </div>

            <p style={{ color: "#64748b", fontSize: 13 }}>
              {usingDemo
                ? "Illustrative sample figures for the dashboard prototype."
                : "Sales figures supplied by the organizer API."}
            </p>
          </section>

          <section style={panelStyle}>
            <h2>My Events</h2>

            {data.events.length === 0 ? (
              <p>No events available.</p>
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
          </section>

          <section style={panelStyle}>
            <h2>Attendee List</h2>

            {data.attendees.length === 0 ? (
              <p>No attendee information available.</p>
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
          </section>
        </>
      )}
    </main>
  )
}

const pageStyle = {
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "32px 24px",
  fontFamily: "Arial, sans-serif",
  color: "#111827",
}

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap" as const,
  gap: "16px",
}

const cardsStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "16px",
  margin: "24px 0",
}

const cardStyle = {
  background: "#ffffff",
  padding: "22px",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
}

const panelStyle = {
  background: "#ffffff",
  padding: "24px",
  marginTop: "24px",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  overflow: "hidden" as const,
}

const labelStyle = { color: "#64748b", margin: 0 }
const numberStyle = { fontSize: "28px", marginBottom: 0 }

const chartStyle = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-around",
  gap: "12px",
  minHeight: "250px",
  padding: "24px 8px 8px",
  borderBottom: "1px solid #e2e8f0",
}

const barColumnStyle = {
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  justifyContent: "flex-end",
  flex: 1,
  gap: "8px",
  height: "230px",
}

const barStyle = {
  width: "min(42px, 85%)",
  background: "#2563eb",
  borderRadius: "6px 6px 0 0",
  minHeight: "4px",
  transition: "height 0.25s ease",
}

const barValueStyle = { fontSize: "12px", color: "#475569" }
const dayStyle = { fontSize: "12px", color: "#64748b" }

const buttonStyle = {
  padding: "10px 16px",
  border: 0,
  borderRadius: "8px",
  background: "#2563eb",
  color: "white",
  cursor: "pointer",
}

const selectStyle = {
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "white",
}

const noticeStyle = {
  padding: "12px 16px",
  borderRadius: "8px",
  background: "#fff7ed",
  color: "#9a3412",
  border: "1px solid #fed7aa",
}

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse" as const,
  textAlign: "left" as const,
}

const cellStyle = {
  padding: "12px",
  borderBottom: "1px solid #e2e8f0",
}

export default OrganizerDashboard
