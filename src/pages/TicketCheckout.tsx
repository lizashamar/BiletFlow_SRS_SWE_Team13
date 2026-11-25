import { useCallback, useEffect, useState } from "react"
import type { FormEvent } from "react"
import Icon from "../components/Icon"
import EventCover from "../components/EventCover"
import { api, errorText, money, shortDate } from "../api"
import type { Event, User } from "../api"

type Props = {
  event: Event
  user: User | null
  onBack: () => void
  onViewTickets: () => void
}

type OrderResponse = {
  order: { id: number; totalAmount: string | number; tickets: { id: number }[] }
}

function TicketCheckout({ event: initialEvent, user, onBack, onViewTickets }: Props) {
  const [event, setEvent] = useState(initialEvent)
  const [ticketTypeId, setTicketTypeId] = useState(
    initialEvent.ticketTypes.find((t) => t.remainingQuantity > 0)?.id ?? 0
  )
  const [quantity, setQuantity] = useState(1)
  const [attendeeNames, setAttendeeNames] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const refreshEvent = useCallback(async () => {
    try {
      setEvent(await api<Event>(`/events/${initialEvent.id}`))
    } catch {}
  }, [initialEvent.id])

  useEffect(() => {
    void refreshEvent()
  }, [refreshEvent])

  const selectedType = event.ticketTypes.find((t) => t.id === ticketTypeId)
  const maxQty = Math.min(10, selectedType?.remainingQuantity ?? 10)
  const total = selectedType ? selectedType.price * quantity : 0
  const canBuy = user?.role === "ATTENDEE"

  const submitOrder = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (!selectedType) {
      setError("Choose a ticket type.")
      return
    }

    const names = attendeeNames
      .split("\n")
      .map((n) => n.trim())
      .filter(Boolean)
    if (names.length > 0 && names.length !== quantity) {
      setError(`Enter exactly ${quantity} attendee name(s), one per line, or leave the field empty.`)
      return
    }

    setLoading(true)
    try {
      const data = await api<OrderResponse>("/orders", {
        method: "POST",
        body: {
          eventId: event.id,
          items: [
            {
              ticketTypeId: selectedType.id,
              quantity,
              ...(names.length ? { attendeeNames: names } : {}),
            },
          ],
        },
      })
      setSuccess(
        `Order #${data.order.id} confirmed: ${data.order.tickets.length} ticket(s), ${money(Number(data.order.totalAmount))}.`
      )
      setAttendeeNames("")
    } catch (err) {
      setError(errorText(err, "Could not submit your order."))
    } finally {
      setLoading(false)
      void refreshEvent()
    }
  }

  return (
    <main className="page-container">
      <button className="secondary-button small-button" onClick={onBack}>
        <Icon name="arrow-left" /> Back
      </button>

      <div className="checkout-layout">
        <div>
          <p className="eyebrow" style={{ marginTop: 28 }}>Checkout</p>
          <h1>{event.title}</h1>
          <div className="meta">
            <span><Icon name="calendar" /> {shortDate(event.startTime)}</span>
            <span><Icon name="pin" /> {event.venueName}, {event.venueAddress}</span>
          </div>
          {event.description && <p className="muted">{event.description}</p>}

          {!canBuy && (
            <p className="error-box">Only attendee accounts can buy tickets. Sign in as an attendee to continue.</p>
          )}

          <form className="panel" onSubmit={submitOrder}>
            <h3>1. Choose tickets</h3>
            <div className="type-options">
              {event.ticketTypes.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className={`type-option ${t.id === ticketTypeId ? "selected" : ""}`}
                  disabled={t.remainingQuantity < 1}
                  onClick={() => {
                    setTicketTypeId(t.id)
                    setQuantity(1)
                  }}
                >
                  <span>
                    <strong>{t.name}</strong>
                    <small>{t.remainingQuantity > 0 ? `${t.remainingQuantity} left` : "Sold out"}</small>
                  </span>
                  <strong>{t.price > 0 ? money(t.price) : "Free"}</strong>
                </button>
              ))}
            </div>

            <label>Quantity</label>
            <div className="stepper">
              <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Fewer tickets">−</button>
              <span>{quantity}</span>
              <button type="button" onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} aria-label="More tickets">+</button>
            </div>

            <h3 style={{ marginTop: 28 }}>2. Attendee details</h3>
            <label htmlFor="names">Names on tickets (optional, one per line)</label>
            <textarea
              id="names"
              rows={3}
              value={attendeeNames}
              onChange={(e) => setAttendeeNames(e.target.value)}
              placeholder={user ? user.name : "Attendee 1"}
            />

            {error && <p role="alert" className="error-box">{error}</p>}
            {success && (
              <div role="status" className="success-box">
                <strong>{success}</strong>
                <button type="button" className="link-button" onClick={onViewTickets}>
                  View my tickets →
                </button>
              </div>
            )}

            <button type="submit" className="primary-button block" disabled={loading || !canBuy || !selectedType}>
              {loading ? "Placing order..." : `Pay ${money(total)}`}
            </button>
            <p className="muted" style={{ fontSize: 13, textAlign: "center" }}>
              Payment is simulated in this version: no real card is charged.
            </p>
          </form>
        </div>

        <aside className="summary-card">
          <EventCover title={event.title} height={120} />
          <div className="summary-body">
            <h3 style={{ margin: "0 0 12px" }}>Order summary</h3>
            <div className="summary-row">
              <span>{selectedType?.name ?? "Ticket"} × {quantity}</span>
              <span>{money(total)}</span>
            </div>
            <div className="summary-row">
              <span>Service fee</span>
              <span>{money(0)}</span>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}

export default TicketCheckout
