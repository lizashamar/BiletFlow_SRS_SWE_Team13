import { useState } from "react"
import type { FormEvent } from "react"
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

  const submitOrder = async (e: FormEvent<HTMLFormElement>) => {
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
import { useState, type FormEvent } from "react";
import type { Event } from "../App";

const API_URL = "http://localhost:5000/api";

type Props = {
  event: Event;
  onBack: () => void;
};

export default function TicketCheckout({ event, onBack }: Props) {
  const ticketTypes = event.ticketTypes ?? [];
  const [ticketTypeId, setTicketTypeId] = useState(
    ticketTypes[0]?.id.toString() ?? ""
  );
  const [quantity, setQuantity] = useState("1");
  const [attendeeNames, setAttendeeNames] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedType = ticketTypes.find(
    (type) => type.id === Number(ticketTypeId)
  );

  const total = selectedType
    ? Number(selectedType.price) * Number(quantity)
    : 0;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");

    const token = localStorage.getItem("token");

    if (!token) {
      setError("Please log in as an attendee before placing an order.");
      return;
    }

    if (!selectedType) {
      setError(
        "Ticket types and their IDs are not available from the current events API. Checkout cannot safely submit an order yet."
      );
      return;
    }

    const count = Number(quantity);

    if (!Number.isInteger(count) || count < 1 || count > 10) {
      setError("Choose a quantity between 1 and 10.");
      return;
    }

    if (count > selectedType.remainingQuantity) {
      setError("There are not enough tickets remaining for this selection.");
      return;
    }

    const names = attendeeNames
      .split("\n")
      .map((name) => name.trim())
      .filter(Boolean);

    if (names.length > 0 && names.length !== count) {
      setError(
        "Enter one attendee name per ticket, or leave the names field empty."
      );
      return;
    }

    setLoading(true);

    try {
      const item: {
        ticketTypeId: number;
        quantity: number;
        attendeeNames?: string[];
      } = {
        ticketTypeId: selectedType.id,
        quantity: count,
      };

      if (names.length === count) {
        item.attendeeNames = names;
      }

      const response = await fetch(`${API_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          eventId: event.id,
          items: [item],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Order failed.");
      }

      setMessage("Order submitted successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not submit the order."
      );
    } finally {
      setLoading(false);
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
    <main style={{ maxWidth: "650px", margin: "32px auto", padding: "24px" }}>
      <button onClick={onBack}>← Back to events</button>
      <h1>Ticket Checkout</h1>
      <h2>{event.title}</h2>

      {ticketTypes.length === 0 ? (
        <div>
          <p>
            Ticket selection is temporarily unavailable because the current
            events API doesn't return ticket types.
          </p>
          <p>
            The backend needs to provide each ticket type's ID, name, price,
            and remaining quantity before a real order can be submitted.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <label>
            Ticket type
            <select
              value={ticketTypeId}
              onChange={(e) => setTicketTypeId(e.target.value)}
              style={{ display: "block", padding: "10px", margin: "8px 0 16px", width: "100%" }}
              required
            >
              {ticketTypes.map((type) => (
                <option
                  key={type.id}
                  value={type.id}
                  disabled={type.remainingQuantity < 1}
                >
                  {type.name} — {Number(type.price).toLocaleString()} ₸
                  {" "}({type.remainingQuantity} left)
                </option>
              ))}
            </select>
          </label>

          <label>
            Quantity (maximum 10)
            <input
              type="number"
              min="1"
              max="10"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              style={{ display: "block", padding: "10px", margin: "8px 0 16px", width: "100%" }}
              required
            />
          </label>

          <label>
            Attendee names (one per line, optional)
            <textarea
              value={attendeeNames}
              onChange={(e) => setAttendeeNames(e.target.value)}
              rows={3}
              placeholder={"Attendee 1\nAttendee 2"}
              style={{ display: "block", padding: "10px", margin: "8px 0 16px", width: "100%" }}
            />
          </label>

          <h3>Total: {total.toLocaleString()} ₸</h3>
          <p>Payment processing depends on the backend's current implementation.</p>

          <button type="submit" disabled={loading || !selectedType}>
            {loading ? "Submitting order..." : "Place Order"}
          </button>
        </form>
      )}

      {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
      {message && <p role="status">{message}</p>}
    </main>
  );
}
