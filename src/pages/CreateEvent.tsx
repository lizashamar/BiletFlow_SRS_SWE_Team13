import { useState } from "react"

function CreateEvent() {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [venue, setVenue] = useState("")
  const [address, setAddress] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [capacity, setCapacity] = useState("")

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    console.log({
      title,
      description,
      venue,
      address,
      startTime,
      endTime,
      capacity,
    })

    alert("Event information submitted!")
  }

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
        <label>Event Title</label>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter event title"
          required
          style={{
            width: "100%",
            padding: "12px",
            marginTop: "8px",
            marginBottom: "20px",
          }}
        />

        <label>Description</label>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your event"
          rows={5}
          style={{
            width: "100%",
            padding: "12px",
            marginTop: "8px",
            marginBottom: "20px",
          }}
        />

        <label>Venue Name</label>

        <input
          type="text"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="Example: Nazarbayev University"
          required
          style={{
            width: "100%",
            padding: "12px",
            marginTop: "8px",
            marginBottom: "20px",
          }}
        />

        <label>Venue Address</label>

        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter venue address"
          required
          style={{
            width: "100%",
            padding: "12px",
            marginTop: "8px",
            marginBottom: "20px",
          }}
        />

        <label>Start Time</label>

        <input
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          required
          style={{
            width: "100%",
            padding: "12px",
            marginTop: "8px",
            marginBottom: "20px",
          }}
        />

        <label>End Time</label>

        <input
          type="datetime-local"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          required
          style={{
            width: "100%",
            padding: "12px",
            marginTop: "8px",
            marginBottom: "20px",
          }}
        />

        <label>Capacity</label>

        <input
          type="number"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder="Example: 500"
          min="1"
          required
          style={{
            width: "100%",
            padding: "12px",
            marginTop: "8px",
            marginBottom: "20px",
          }}
        />

        <button
          type="submit"
          style={{
            backgroundColor: "#111827",
            color: "white",
            border: "none",
            padding: "12px 24px",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Create Event
        </button>
      </form>
    </main>
  )
}

export default CreateEvent
