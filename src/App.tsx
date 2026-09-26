import { useState } from "react"
import EventCatalog from "./pages/EventCatalog"
import CreateEvent from "./pages/CreateEvent"

function App() {
  const [page, setPage] = useState<"events" | "create">("events")

  return (
    <div>
      <nav
        style={{
          backgroundColor: "#111827",
          padding: "16px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2 style={{ color: "white", margin: 0 }}>BiletFlow</h2>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setPage("events")}
            style={{
              padding: "10px 16px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Events
          </button>

          <button
            onClick={() => setPage("create")}
            style={{
              padding: "10px 16px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Create Event
          </button>
        </div>
      </nav>

      {page === "events" && <EventCatalog />}
      {page === "create" && <CreateEvent />}
    </div>
  )
}

export default App
