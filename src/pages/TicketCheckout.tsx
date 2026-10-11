import { useState } from "react"
import type { Event } from "../App"

type Props = {
  event: Event
  onBack: () => void
}

function TicketCheckout({ event, onBack }: Props) {
  const [buyerName, setBuyerName] = useState("")
  const [buyerEmail, setBuyerEmail] = useState("")
  const [ticketType, setTicketType] = useState("Standard")
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const total = event.price * quantity

  const submitOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const response = await fetch("http://localhost:5000/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId: event.id,
          buyerName,
          buyerEmail,
          ticketType,
          quantity,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.error || "Order submission failed. Please try again."
        )
      }

      setSuccess(
        data.message || "Your order was submitted successfully."
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not submit your order."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main
      style={{
        maxWidth: "700px",
        margin: "0 auto",
        padding: "40px 24px",
      }}
    >
      <button onClick={onBack}>← Back to events</button>

      <h1>Ticket Checkout</h1>
      <h2>{event.title}</h2>
      <p>Date: {new Date(event.date).toLocaleDateString()}</p>
      <p>Price per ticket: {event.price.toLocaleString()} ₸</p>

      <form onSubmit={submitOrder}>
        <div style={{ marginBottom: "16px" }}>
          <label htmlFor="buyerName">Full name</label>
          <input
            id="buyerName"
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            required
            style={{ display: "block", width: "100%", padding: "10px" }}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label htmlFor="buyerEmail">Email address</label>
          <input
            id="buyerEmail"
            type="email"
            value={buyerEmail}
            onChange={(e) => setBuyerEmail(e.target.value)}
            required
            style={{ display: "block", width: "100%", padding: "10px" }}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label htmlFor="ticketType">Ticket type</label>
          <select
            id="ticketType"
            value={ticketType}
            onChange={(e) => setTicketType(e.target.value)}
            style={{ display: "block", width: "100%", padding: "10px" }}
          >
            <option value="Standard">Standard</option>
            <option value="VIP">VIP</option>
          </select>
          <p style={{ color: "#666", fontSize: "14px" }}>
            The current event API provides one price per event, so separate
            Standard and VIP prices are not available yet.
          </p>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label htmlFor="quantity">Number of tickets</label>
          <input
            id="quantity"
            type="number"
            min="1"
            max="10"
            value={quantity}
            onChange={(e) =>
              setQuantity(Math.max(1, Math.min(10, Number(e.target.value) || 1)))
            }
            required
            style={{ display: "block", width: "100%", padding: "10px" }}
          />
        </div>

        <h3>Total: {total.toLocaleString()} ₸</h3>

        {error && <p style={{ color: "red" }}>{error}</p>}
        {success && <p style={{ color: "green" }}>{success}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Submitting..." : "Place Order"}
        </button>
      </form>
    </main>
  )
}

export default TicketCheckout
