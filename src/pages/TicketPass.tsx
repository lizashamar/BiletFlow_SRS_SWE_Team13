import { useCallback, useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import EventCover from "../components/EventCover"
import { api, errorText, shortDate } from "../api"

type Ticket = {
  id: number
  status: "VALID" | "CHECKED_IN" | "CANCELLED" | "REFUNDED"
  attendeeName: string
  qrCodeHash: string
  ticketType: { name: string; price: number | string }
  order: {
    id: number
    event: {
      id: number
      title: string
      venueName: string
      venueAddress: string
      startTime: string
    }
  }
}

const STATUS_LABEL: Record<Ticket["status"], string> = {
  VALID: "Valid",
  CHECKED_IN: "Checked in",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
}

function TicketPass() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setTickets(await api<Ticket[]>("/tickets"))
    } catch (err) {
      setError(errorText(err, "Could not load your tickets."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const copy = async (t: Ticket) => {
    await navigator.clipboard?.writeText(t.qrCodeHash).catch(() => undefined)
    setCopied(t.id)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <main className="page-container">
      <style>{`
        @media print {
          .app-nav, .no-print { display: none !important; }
          .ticket-card { box-shadow: none !important; break-inside: avoid; }
        }
      `}</style>

      <div className="no-print page-header">
        <div>
          <p className="eyebrow">Wallet</p>
          <h1>My Tickets</h1>
          <p className="muted" style={{ margin: 0 }}>Show the QR code at the entrance. You can print or save tickets as PDF.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="secondary-button" onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          {tickets.length > 0 && (
            <button className="primary-button" onClick={() => window.print()}>
              Print / Save as PDF
            </button>
          )}
        </div>
      </div>

      {loading && tickets.length === 0 && <p className="muted">Loading your tickets...</p>}
      {error && <p role="alert" className="error-box">{error}</p>}
      {!loading && !error && tickets.length === 0 && (
        <section className="panel">
          <h3>No tickets yet</h3>
          <p className="muted">Buy a ticket on the Discover page and it will appear here with its QR code.</p>
        </section>
      )}

      {tickets.map((t) => (
        <section key={t.id} className="ticket-card">
          <div className="ticket-main">
            <EventCover title={t.order.event.title} height={90} />
            <div className="ticket-info">
              <h2>{t.order.event.title}</h2>
              <div className="ticket-fields">
                <div><small>Attendee</small>{t.attendeeName}</div>
                <div><small>Ticket</small>BF-{t.id} · {t.ticketType.name}</div>
                <div><small>Date</small>{shortDate(t.order.event.startTime)}</div>
                <div><small>Venue</small>{t.order.event.venueName}</div>
                <div>
                  <small>Status</small>
                  <span className={`status-badge status-${t.status.toLowerCase()}`}>{STATUS_LABEL[t.status]}</span>
                </div>
                <div><small>Order</small>#{t.order.id}</div>
              </div>
            </div>
          </div>
          <div className="ticket-qr">
            {t.status === "VALID" || t.status === "CHECKED_IN" ? (
              <QRCodeSVG value={t.qrCodeHash} size={172} bgColor="transparent" />
            ) : (
              <p className="muted">QR disabled</p>
            )}
            <button className="link-button no-print" onClick={() => void copy(t)}>
              {copied === t.id ? "Copied!" : "Copy code"}
            </button>
          </div>
        </section>
      ))}
    </main>
  )
}

export default TicketPass
