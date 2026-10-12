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
