
import { useEffect, useState } from "react"

type Ticket = {
  id: number
  status: string
  attendeeName?: string | null
  ticketType?: { name: string; price: number | string }
  order?: {
    event?: {
      title: string
      venueName?: string | null
      venueAddress?: string | null
      startTime?: string
    }
  }
}

function TicketPass() {
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const token = localStorage.getItem("token")

        if (!token) {
          throw new Error("Log in as an attendee to view your tickets.")
        }

        const response = await fetch("http://localhost:5000/api/tickets", {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) {
          throw new Error("Could not load your tickets.")
        }

        const tickets: Ticket[] = await response.json()

        if (tickets.length === 0) {
          throw new Error("No purchased tickets were found for this account.")
        }

        setTicket(tickets[0])
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Something went wrong while loading your ticket."
        )
      } finally {
        setLoading(false)
      }
    }

    fetchTickets()
  }, [])

  return (
    <main className="ticket-page">
      <style>{`
        @media print {
          .app-nav, .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          .ticket-page {
            margin: 0 !important;
            padding: 0 !important;
          }
          .ticket-card {
            box-shadow: none !important;
            border: 2px solid #111827 !important;
          }
        }
      `}</style>

      <div className="no-print" style={{ marginBottom: 24 }}>
        <h1>My Digital Ticket</h1>
        <p>View your ticket and save a printable copy as a PDF.</p>
      </div>

      {loading && <p>Loading your ticket...</p>}

      {!loading && message && (
        <section>
          <p>{message}</p>
          <p>
            Make sure you have signed in with the attendee account used to
            purchase the ticket.
          </p>
        </section>
      )}

      {ticket && (
        <section
          className="ticket-card"
          style={{
            maxWidth: 650,
            margin: "24px auto",
            padding: 28,
            border: "1px solid #cbd5e1",
            borderRadius: 16,
            background: "white",
            boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
          }}
        >
          <p style={{ color: "#2563eb", fontWeight: 700 }}>BILETFLOW</p>
          <h2>{ticket.order?.event?.title ?? "Event ticket"}</h2>

          <hr />

          <p>
            <strong>Attendee:</strong>{" "}
            {ticket.attendeeName || "Attendee"}
          </p>
          <p>
            <strong>Ticket number:</strong> BF-{ticket.id}
          </p>
          <p>
            <strong>Ticket type:</strong>{" "}
            {ticket.ticketType?.name ?? "Standard"}
          </p>
          <p>
            <strong>Date:</strong>{" "}
            {ticket.order?.event?.startTime
              ? new Date(ticket.order.event.startTime).toLocaleString()
              : "See event details"}
          </p>
          <p>
            <strong>Venue:</strong>{" "}
            {ticket.order?.event?.venueName ?? "See event details"}
          </p>
          {ticket.order?.event?.venueAddress && (
            <p>
              <strong>Address:</strong>{" "}
              {ticket.order.event.venueAddress}
            </p>
          )}

          <p>
            <strong>Status:</strong> {ticket.status}
          </p>

          <p style={{ color: "#64748b", fontSize: 13 }}>
            Keep this ticket available when attending the event.
            Present it to event staff for verification.
          </p>

          <button
            className="no-print"
            onClick={() => window.print()}
            style={{
              marginTop: 16,
              padding: "12px 18px",
              background: "#2563eb",
              color: "white",
              border: 0,
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Print / Save as PDF
          </button>
        </section>
      )}
    </main>
  )
}

export default TicketPass
