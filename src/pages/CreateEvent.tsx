
import { useState } from "react"
import type { FormEvent } from "react"

function CreateEvent() {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [venue, setVenue] = useState("")
  const [address, setAddress] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [capacity, setCapacity] = useState("")
  const [price, setPrice] = useState("")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setMessage("")

    if (endTime <= startTime) {
      setError("The end time must be after the start time.")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("http://localhost:5000/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          price: Number(price),
          date: startTime,
          description,
          venue,
          address,
          startTime,
          endTime,
          capacity: Number(capacity),
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Could not submit the event.")
      }

      setMessage(
        "The backend accepted the event request. Database saving still needs to be confirmed."
      )
import { useState, type FormEvent } from "react";

const API_URL = "http://localhost:5000/api";

export default function CreateEvent() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  const [address, setAddress] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [capacity, setCapacity] = useState("100");
  const [price, setPrice] = useState("5000");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!title.trim() || !venue.trim() || !address.trim()) {
      setError("Please fill in the event title, venue, and address.");
      return;
    }

    if (!startTime || !endTime || new Date(endTime) <= new Date(startTime)) {
      setError("The end time must be later than the start time.");
      return;
    }

    if (Number(capacity) < 1 || !Number.isInteger(Number(capacity))) {
      setError("Capacity must be a whole number greater than zero.");
      return;
    }

    if (!Number.isFinite(Number(price)) || Number(price) <= 0) {
      setError(
        "Enter a price greater than zero. The current backend rejects a price of 0."
      );
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setError(
        "Please log in as an organizer first. The event creation API requires authentication."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          price: Number(price),
          date: new Date(startTime).toISOString(),
          description,
          venueName: venue,
          venueAddress: address,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          capacity: Number(capacity),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "The event could not be submitted."
        );
      }

      setMessage(
        "The API accepted the request, but the current backend does not save events to the database. Ask the backend team to implement database saving before treating this event as published."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not connect to the backend."
      )
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    display: "block",
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "12px",
    marginTop: "8px",
    marginBottom: "20px",
          : "Something went wrong while submitting the event."
      );
    } finally {
      setLoading(false);
    }
  }

  const fieldStyle = {
    display: "block",
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "10px",
    marginTop: "6px",
    marginBottom: "16px",
  };

  return (
    <main
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "40px 24px",
      }}
    >
      <h1>Create Event</h1>
      <p style={{ color: "#666" }}>
        Create a new event for BiletFlow.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          backgroundColor: "white",
          padding: "30px",
          borderRadius: "12px",
          marginTop: "30px",
        }}
      >
        <label htmlFor="title">Event Title</label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter event title"
          required
          style={inputStyle}
        />

        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your event"
          rows={5}
          style={inputStyle}
        />

        <label htmlFor="venue">Venue Name</label>
        <input
          id="venue"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="Example: Nazarbayev University"
          required
          style={inputStyle}
        />

        <label htmlFor="address">Venue Address</label>
        <input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter venue address"
          required
          style={inputStyle}
        />

        <label htmlFor="startTime">Start Time</label>
        <input
          id="startTime"
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          required
          style={inputStyle}
        />

        <label htmlFor="endTime">End Time</label>
        <input
          id="endTime"
          type="datetime-local"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          min={startTime || undefined}
          required
          style={inputStyle}
        />

        <label htmlFor="capacity">Capacity</label>
        <input
          id="capacity"
          type="number"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder="Example: 500"
          min="1"
          required
          style={inputStyle}
        />

        <label htmlFor="price">Ticket Price (₸)</label>
        <input
          id="price"
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Example: 5000"
          min="0"
          required
          style={inputStyle}
        />

        {error && <p style={{ color: "red" }}>{error}</p>}
        {message && <p style={{ color: "green" }}>{message}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{
            backgroundColor: "#111827",
            color: "white",
            border: "none",
            padding: "12px 24px",
            borderRadius: "6px",
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Submitting..." : "Create Event"}
    <main style={{ maxWidth: "650px", margin: "32px auto", padding: "24px" }}>
      <h1>Create an Event</h1>
      <p>Enter the details for your next event.</p>

      <form onSubmit={handleSubmit}>
        <label>
          Event title
          <input
            style={fieldStyle}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>

        <label>
          Description
          <textarea
            style={fieldStyle}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </label>

        <label>
          Venue name
          <input
            style={fieldStyle}
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            required
          />
        </label>

        <label>
          Venue address
          <input
            style={fieldStyle}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
        </label>

        <label>
          Start date and time
          <input
            style={fieldStyle}
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </label>

        <label>
          End date and time
          <input
            style={fieldStyle}
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </label>

        <label>
          Capacity
          <input
            style={fieldStyle}
            type="number"
            min="1"
            step="1"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            required
          />
        </label>

        <label>
          Ticket price (₸)
          <input
            style={fieldStyle}
            type="number"
            min="0.01"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </label>

        {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
        {message && <p role="status">{message}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Submitting..." : "Submit Event"}
        </button>
      </form>
    </main>
  );
}
