import { useState } from "react"

function TicketCheckout() {
  const [ticketType, setTicketType] = useState("Standard")
  const [quantity, setQuantity] = useState(1)
  const [buyerName, setBuyerName] = useState("")
  const [buyerEmail, setBuyerEmail] = useState("")

  const ticketPrices: Record<string, number> = {
    Standard: 5000,
    VIP: 12000,
  }

  const total = ticketPrices[ticketType] * quantity

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    alert(
      "Checkout form completed. Order processing will be connected to the backend later."
    )
  }

  return (
    <main className="page-container">
      <h1>Ticket Checkout</h1>
      <p className="muted">
        Choose your tickets and enter your contact details.
      </p>

      <form className="panel" onSubmit={handleSubmit}>
        <label htmlFor="ticketType">Ticket type</label>
        <select
          id="ticketType"
          value={ticketType}
          onChange={(event) => setTicketType(event.target.value)}
        >
          <option value="Standard">Standard — 5,000 ₸</option>
          <option value="VIP">VIP — 12,000 ₸</option>
        </select>

        <label htmlFor="quantity">Quantity</label>
        <input
          id="quantity"
          type="number"
          min="1"
          max="10"
          value={quantity}
          onChange={(event) =>
            setQuantity(
              Math.max(1, Math.min(10, Number(event.target.value) || 1))
            )
          }
        />

        <label htmlFor="buyerName">Full name</label>
        <input
          id="buyerName"
          value={buyerName}
          onChange={(event) => setBuyerName(event.target.value)}
          placeholder="Enter your full name"
          required
        />

        <label htmlFor="buyerEmail">Email address</label>
        <input
          id="buyerEmail"
          type="email"
          value={buyerEmail}
          onChange={(event) => setBuyerEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />

        <div className="order-total">
          <span>Total</span>
          <strong>{total.toLocaleString()} ₸</strong>
        </div>

        <button className="primary-button" type="submit">
          Place Order
        </button>
      </form>
    </main>
  )
}

export default TicketCheckout
