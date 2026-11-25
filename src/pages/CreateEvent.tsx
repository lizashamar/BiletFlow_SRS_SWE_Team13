import { useState } from "react"
import type { FormEvent } from "react"
import { api, errorText } from "../api"
import type { Event } from "../api"

type Props = {
  onCreated: () => void
}

type TicketTypeDraft = { name: string; price: string; totalQuantity: string }

function CreateEvent({ onCreated }: Props) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [venue, setVenue] = useState("")
  const [address, setAddress] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [capacity, setCapacity] = useState("100")
  const [ticketTypes, setTicketTypes] = useState<TicketTypeDraft[]>([
    { name: "Standard", price: "5000", totalQuantity: "100" },
  ])
  const [publishNow, setPublishNow] = useState(true)
  const [payoutAccount, setPayoutAccount] = useState("")
  const [acceptTerms, setAcceptTerms] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const hasPaid = ticketTypes.some((t) => Number(t.price) > 0)

  const updateType = (i: number, field: keyof TicketTypeDraft, value: string) =>
    setTicketTypes((list) => list.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)))

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setMessage("")

    if (!startTime || !endTime || new Date(endTime) <= new Date(startTime)) {
      setError("The end time must be after the start time.")
      return
    }
    const totalTickets = ticketTypes.reduce((s, t) => s + (Number(t.totalQuantity) || 0), 0)
    if (totalTickets > Number(capacity)) {
      setError(`Ticket quantities (${totalTickets}) exceed the event capacity (${capacity}).`)
      return
    }
    if (publishNow && hasPaid && (!acceptTerms || payoutAccount.trim().length < 8)) {
      setError("To sell paid tickets, enter a payout account (8+ characters) and accept the terms.")
      return
    }

    setLoading(true)
    try {
      const created = await api<{ event: Event }>("/events", {
        method: "POST",
        body: {
          title: title.trim(),
          description: description.trim() || undefined,
          venueName: venue.trim(),
          venueAddress: address.trim(),
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          capacity: Number(capacity),
          ticketTypes: ticketTypes.map((t) => ({
            name: t.name.trim(),
            price: Number(t.price) || 0,
            totalQuantity: Number(t.totalQuantity),
          })),
        },
      })
      const id = created.event.id

      if (publishNow) {
        if (hasPaid) {
          await api(`/events/${id}/activate-paid-sales`, {
            method: "POST",
            body: { acceptTerms, payoutAccount: payoutAccount.trim() },
          })
        }
        await api(`/events/${id}`, { method: "PATCH", body: { isPublished: true } })
        setMessage(`Event #${id} created and published. It is now visible in the catalog.`)
      } else {
        setMessage(`Event #${id} saved as a draft. Publish it from the dashboard when ready.`)
      }
      setTimeout(onCreated, 1500)
    } catch (err) {
      setError(errorText(err, "Could not create the event."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page-container narrow">
      <h1>Create an Event</h1>
      <p className="muted">Enter the details for your next event.</p>

      <form className="panel" onSubmit={handleSubmit}>
        <label htmlFor="title">Event title</label>
        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={255} />

        <label htmlFor="description">Description</label>
        <textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />

        <label htmlFor="venue">Venue name</label>
        <input id="venue" value={venue} onChange={(e) => setVenue(e.target.value)} required />

        <label htmlFor="address">Venue address</label>
        <input id="address" value={address} onChange={(e) => setAddress(e.target.value)} required />

        <div className="two-columns">
          <div>
            <label htmlFor="start">Starts</label>
            <input id="start" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="end">Ends</label>
            <input id="end" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
          </div>
        </div>

        <label htmlFor="capacity">Capacity</label>
        <input id="capacity" type="number" min={1} step={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} required />

        <h3>Ticket types</h3>
        {ticketTypes.map((t, i) => (
          <div key={i} className="ticket-type-row">
            <input aria-label="Ticket name" placeholder="Name" value={t.name} onChange={(e) => updateType(i, "name", e.target.value)} required />
            <input aria-label="Price" type="number" min={0} step="0.01" placeholder="Price ₸" value={t.price} onChange={(e) => updateType(i, "price", e.target.value)} required />
            <input aria-label="Quantity" type="number" min={1} step={1} placeholder="Qty" value={t.totalQuantity} onChange={(e) => updateType(i, "totalQuantity", e.target.value)} required />
            {ticketTypes.length > 1 && (
              <button type="button" className="secondary-button" onClick={() => setTicketTypes((l) => l.filter((_, idx) => idx !== i))}>
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="secondary-button"
          onClick={() => setTicketTypes((l) => [...l, { name: "", price: "0", totalQuantity: "10" }])}
        >
          + Add ticket type
        </button>

        <label className="checkbox-label">
          <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
          Publish immediately
        </label>

        {publishNow && hasPaid && (
          <div className="sub-panel">
            <p className="muted" style={{ marginTop: 0 }}>
              Paid sales activation (simulated — no real payment provider is connected).
            </p>
            <label htmlFor="payout">Payout account</label>
            <input id="payout" value={payoutAccount} onChange={(e) => setPayoutAccount(e.target.value)} placeholder="e.g. KZ00 DEMO 0000 0000" />
            <label className="checkbox-label">
              <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
              I accept the organizer terms
            </label>
          </div>
        )}

        {error && <p role="alert" className="error-box">{error}</p>}
        {message && <p role="status" className="success-box">{message}</p>}

        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? "Saving..." : "Create Event"}
        </button>
      </form>
    </main>
  )
}

export default CreateEvent
