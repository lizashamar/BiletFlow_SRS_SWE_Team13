import { useEffect, useState } from "react"
import EventCatalog from "./pages/EventCatalog"
import CreateEvent from "./pages/CreateEvent"
import TicketCheckout from "./pages/TicketCheckout"
import OrganizerDashboard from "./pages/OrganizerDashboard"
import TicketPass from "./pages/TicketPass"
import CheckIn from "./pages/CheckIn"
import Login from "./pages/Login"
import Icon from "./components/Icon"
import { clearSession, getStoredUser } from "./api"
import type { Event, Role, User } from "./api"

type Page = "events" | "create" | "checkout" | "dashboard" | "ticket" | "checkin" | "login"

const NAV: { page: Page; label: string; roles: Role[] | null }[] = [
  { page: "events", label: "Discover", roles: null },
  { page: "ticket", label: "My Tickets", roles: ["ATTENDEE"] },
  { page: "dashboard", label: "Dashboard", roles: ["ORGANIZER", "PLATFORM_ADMIN"] },
  { page: "create", label: "Create Event", roles: ["ORGANIZER"] },
  { page: "checkin", label: "Check-in", roles: ["ORGANIZER", "EVENT_ADMIN", "PLATFORM_ADMIN"] },
]

const ROLE_LABEL: Record<Role, string> = {
  ATTENDEE: "attendee",
  ORGANIZER: "organizer",
  EVENT_ADMIN: "gate staff",
  PLATFORM_ADMIN: "admin",
}

function App() {
  const [user, setUser] = useState<User | null>(getStoredUser)
  const [page, setPage] = useState<Page>("events")
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [page])

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
        <button className="brand" onClick={() => setPage("events")}>
          <span className="brand-mark">
            <Icon name="ticket" size={20} />
          </span>
          BiletFlow
        </button>

        <div className="nav-links">
          {visibleNav.map((n) => (
            <button key={n.page} className={`nav-link ${page === n.page ? "active" : ""}`} onClick={() => setPage(n.page)}>
              {n.label}
            </button>
          ))}

          {user ? (
            <div className="nav-user">
              <span className="avatar">{user.name.charAt(0).toUpperCase()}</span>
              <span className="nav-user-text">
                <strong>{user.name}</strong>
                <small>{ROLE_LABEL[user.role]}</small>
              </span>
              <button className="icon-button" onClick={logout} title="Log out" aria-label="Log out">
                <Icon name="logout" />
              </button>
            </div>
          ) : (
            <button className="primary-button small-button" style={{ marginLeft: 8 }} onClick={() => setPage("login")}>
              <Icon name="user" /> Sign in
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
