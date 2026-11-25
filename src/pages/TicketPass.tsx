import { useCallback, useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { api, dateTime, errorText } from "../api"

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
    <main className="page-container ticket-page">
      <style>{`
        @media print {
          .app-nav, .no-print { display: none !important; }
          body { background: white !important; }
          .ticket-card { box-shadow: none !important; border: 2px solid #111827 !important; break-inside: avoid; }
        }
      `}</style>

      <div className="no-print page-header">
        <div>
          <h1>My Tickets</h1>
          <p className="muted">Show the QR code at the entrance. You can print or save tickets as PDF.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="secondary-button" onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          {tickets.length > 0 && (
            <button className="primary-button" style={{ marginTop: 0 }} onClick={() => window.print()}>
              Print / Save as PDF
            </button>
          )}
        </div>
      </div>

      {loading && tickets.length === 0 && <p>Loading your tickets...</p>}
      {error && <p role="alert" className="error-box">{error}</p>}
      {!loading && !error && tickets.length === 0 && <p>You have no tickets yet. Buy one from the Events page.</p>}

      {tickets.map((t) => (
        <section key={t.id} className="ticket-card">
          <div className="ticket-info">
            <p className="brand">BILETFLOW</p>
            <h2>{t.order.event.title}</h2>
            <p><strong>Attendee:</strong> {t.attendeeName}</p>
            <p><strong>Ticket:</strong> BF-{t.id} · {t.ticketType.name}</p>
            <p><strong>Date:</strong> {dateTime(t.order.event.startTime)}</p>
            <p><strong>Venue:</strong> {t.order.event.venueName}, {t.order.event.venueAddress}</p>
            <p>
              <strong>Status:</strong>{" "}
              <span className={`status-badge status-${t.status.toLowerCase()}`}>{STATUS_LABEL[t.status]}</span>
            </p>
          </div>
          <div className="ticket-qr">
            {t.status === "VALID" || t.status === "CHECKED_IN" ? (
              <QRCodeSVG value={t.qrCodeHash} size={168} />
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
