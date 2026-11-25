import { useState } from "react"
import EventCatalog from "./pages/EventCatalog"
import CreateEvent from "./pages/CreateEvent"
import TicketCheckout from "./pages/TicketCheckout"
import OrganizerDashboard from "./pages/OrganizerDashboard"
import TicketPass from "./pages/TicketPass"
import CheckIn from "./pages/CheckIn"
import Login from "./pages/Login"
import { clearSession, getStoredUser } from "./api"
import type { Event, Role, User } from "./api"

type Page = "events" | "create" | "checkout" | "dashboard" | "ticket" | "checkin" | "login"

const NAV: { page: Page; label: string; roles: Role[] | null }[] = [
  { page: "events", label: "Events", roles: null },
  { page: "ticket", label: "My Tickets", roles: ["ATTENDEE"] },
  { page: "create", label: "Create Event", roles: ["ORGANIZER"] },
  { page: "dashboard", label: "Organizer Dashboard", roles: ["ORGANIZER", "PLATFORM_ADMIN"] },
  { page: "checkin", label: "Check-in", roles: ["ORGANIZER", "EVENT_ADMIN", "PLATFORM_ADMIN"] },
]

function App() {
  const [user, setUser] = useState<User | null>(getStoredUser)
  const [page, setPage] = useState<Page>("events")
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)

  const openCheckout = (event: Event) => {
    setSelectedEvent(event)
    setPage(user ? "checkout" : "login")
  }

  const handleLoggedIn = (u: User) => {
    setUser(u)
    if (selectedEvent && u.role === "ATTENDEE") setPage("checkout")
    else if (u.role === "ORGANIZER") setPage("dashboard")
    else if (u.role === "EVENT_ADMIN") setPage("checkin")
    else setPage("events")
  }

  const logout = () => {
    clearSession()
    setUser(null)
    setSelectedEvent(null)
    setPage("events")
  }

  const visibleNav = NAV.filter((n) => n.roles === null || (user && n.roles.includes(user.role)))

  return (
    <div>
      <nav className="app-nav">
        <h2 style={{ color: "white", margin: 0, cursor: "pointer" }} onClick={() => setPage("events")}>
          BiletFlow
        </h2>

        <div className="nav-links">
          {visibleNav.map((n) => (
            <button key={n.page} className={page === n.page ? "active" : ""} onClick={() => setPage(n.page)}>
              {n.label}
            </button>
          ))}
          {user ? (
            <>
              <span className="nav-user">
                {user.name} · {user.role.replace("_", " ").toLowerCase()}
              </span>
              <button onClick={logout}>Log out</button>
            </>
          ) : (
            <button className={page === "login" ? "active" : ""} onClick={() => setPage("login")}>
              Sign in
            </button>
          )}
        </div>
      </nav>

      {page === "events" && <EventCatalog onSelectEvent={openCheckout} />}
      {page === "login" && <Login onLoggedIn={handleLoggedIn} />}
      {page === "create" && <CreateEvent onCreated={() => setPage("dashboard")} />}
      {page === "checkout" && selectedEvent && (
        <TicketCheckout
          event={selectedEvent}
          user={user}
          onBack={() => setPage("events")}
          onViewTickets={() => setPage("ticket")}
        />
      )}
      {page === "dashboard" && <OrganizerDashboard />}
      {page === "ticket" && <TicketPass />}
      {page === "checkin" && <CheckIn />}
    </div>
  )
}

export default App
