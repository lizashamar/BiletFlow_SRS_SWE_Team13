import { useState } from "react"
import EventCatalog from "./pages/EventCatalog"
import CreateEvent from "./pages/CreateEvent"
import TicketCheckout from "./pages/TicketCheckout"
import OrganizerDashboard from "./pages/OrganizerDashboard"

export type Event = {
  id: number
  title: string
  price: number
  date: string
}

type Page = "events" | "create" | "checkout" | "dashboard"

function App() {
  const [page, setPage] = useState<Page>("events")
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)

  const openCheckout = (event: Event) => {
    setSelectedEvent(event)
    setPage("checkout")
  }

  return (
    <div>
      <nav
        style={{
          backgroundColor: "#111827",
          padding: "16px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <h2 style={{ color: "white", margin: 0 }}>BiletFlow</h2>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={() => setPage("events")}>Events</button>
          <button onClick={() => setPage("create")}>Create Event</button>
          <button onClick={() => setPage("dashboard")}>
            Organizer Dashboard
          </button>
        </div>
      </nav>

      {page === "events" && (
        <EventCatalog onSelectEvent={openCheckout} />
      )}

      {page === "create" && <CreateEvent />}

      {page === "checkout" && selectedEvent && (
        <TicketCheckout
          event={selectedEvent}
          onBack={() => setPage("events")}
        />
      )}

      {page === "dashboard" && <OrganizerDashboard />}
    </div>
  )
}

export default App
