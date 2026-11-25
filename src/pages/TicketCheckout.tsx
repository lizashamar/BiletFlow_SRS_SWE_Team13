import { useCallback, useEffect, useState } from "react"
import type { FormEvent } from "react"
import { api, dateTime, errorText, money } from "../api"
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
    String(initialEvent.ticketTypes.find((t) => t.remainingQuantity > 0)?.id ?? "")
  )
  const [quantity, setQuantity] = useState(1)
  const [attendeeNames, setAttendeeNames] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const refreshEvent = useCallback(async () => {
    try {
      setEvent(await api<Event>(`/events/${initialEvent.id}`))
    } catch {
      // keep the last known data
    }
  }, [initialEvent.id])

  useEffect(() => {
    void refreshEvent()
  }, [refreshEvent])

  const selectedType = event.ticketTypes.find((t) => t.id === Number(ticketTypeId))
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
    <main className="page-container narrow">
      <button className="secondary-button" onClick={onBack}>← Back to events</button>

      <h1>Ticket Checkout</h1>
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>{event.title}</h2>
        <p>📅 {dateTime(event.startTime)}</p>
        <p>📍 {event.venueName}, {event.venueAddress}</p>
        {event.description && <p className="muted">{event.description}</p>}
      </section>

      {!canBuy && (
        <p className="error-box">Only attendee accounts can buy tickets. Sign in as an attendee to continue.</p>
      )}

      <form className="panel" onSubmit={submitOrder}>
        <label htmlFor="ticketType">Ticket type</label>
        <select id="ticketType" value={ticketTypeId} onChange={(e) => setTicketTypeId(e.target.value)} required>
          {event.ticketTypes.map((t) => (
            <option key={t.id} value={t.id} disabled={t.remainingQuantity < 1}>
              {t.name} — {t.price > 0 ? money(t.price) : "Free"} ({t.remainingQuantity} left)
            </option>
          ))}
        </select>

        <label htmlFor="quantity">Number of tickets (max 10)</label>
        <input
          id="quantity"
          type="number"
          min={1}
          max={10}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
          required
        />

        <label htmlFor="names">Attendee names (optional, one per line)</label>
        <textarea
          id="names"
          rows={3}
          value={attendeeNames}
          onChange={(e) => setAttendeeNames(e.target.value)}
          placeholder={user ? user.name : "Attendee 1"}
        />

        <div className="order-total">
          <span>Total</span>
          <strong>{money(total)}</strong>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>Payment is simulated in this version: no real card is charged.</p>

        {error && <p role="alert" className="error-box">{error}</p>}
        {success && (
          <div role="status" className="success-box">
            <p style={{ margin: 0 }}>{success}</p>
            <button type="button" className="link-button" onClick={onViewTickets}>
              View my tickets →
            </button>
          </div>
        )}

        <button type="submit" className="primary-button" disabled={loading || !canBuy || !selectedType}>
          {loading ? "Placing order..." : "Place Order"}
        </button>
      </form>
    </main>
  )
}

export default TicketCheckout
