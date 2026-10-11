
import { useState } from "react"
import EventCatalog from "./pages/EventCatalog"
import CreateEvent from "./pages/CreateEvent"
import TicketCheckout from "./pages/TicketCheckout"
import OrganizerDashboard from "./pages/OrganizerDashboard"

type Page = "events" | "create" | "checkout" | "dashboard"

function App() {
  const [page, setPage] = useState<Page>("events")

  const navButtonStyle = {
    padding: "10px 14px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
  }

  return (
    <div>
      <nav
        style={{
          backgroundColor: "#111827",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <h2 style={{ color: "white", margin: 0 }}>BiletFlow</h2>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button style={navButtonStyle} onClick={() => setPage("events")}>
            Events
          </button>

          <button style={navButtonStyle} onClick={() => setPage("create")}>
            Create Event
          </button>

          <button style={navButtonStyle} onClick={() => setPage("checkout")}>
            Checkout
          </button>

          <button style={navButtonStyle} onClick={() => setPage("dashboard")}>
            Organizer Dashboard
          </button>
        </div>
      </nav>

      {page === "events" && <EventCatalog />}
      {page === "create" && <CreateEvent />}
      {page === "checkout" && <TicketCheckout />}
      {page === "dashboard" && <OrganizerDashboard />}
    </div>
  )
}

export default App
