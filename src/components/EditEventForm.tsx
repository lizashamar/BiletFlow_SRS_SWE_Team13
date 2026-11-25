import { useState } from "react"
import type { FormEvent } from "react"
import { api, errorText } from "../api"

export type EditableEvent = {
  id: number
  title: string
  description?: string | null
  venueName?: string
  venueAddress?: string
  startTime: string
  endTime?: string
  capacity?: number
}

const toLocalInput = (iso?: string) => {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type Props = {
  event: EditableEvent
  onCancel: () => void
  onSaved: () => void
}

function EditEventForm({ event, onCancel, onSaved }: Props) {
  const [title, setTitle] = useState(event.title)
  const [description, setDescription] = useState(event.description ?? "")
  const [venueName, setVenueName] = useState(event.venueName ?? "")
  const [venueAddress, setVenueAddress] = useState(event.venueAddress ?? "")
  const [startTime, setStartTime] = useState(toLocalInput(event.startTime))
  const [endTime, setEndTime] = useState(toLocalInput(event.endTime))
  const [capacity, setCapacity] = useState(String(event.capacity ?? ""))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    if (new Date(endTime) <= new Date(startTime)) {
      setError("The end time must be after the start time.")
      return
    }
    setSaving(true)
    try {
      await api(`/events/${event.id}`, {
        method: "PATCH",
        body: {
          title: title.trim(),
          description: description.trim() || null,
          venueName: venueName.trim(),
          venueAddress: venueAddress.trim(),
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          capacity: Number(capacity),
        },
      })
      onSaved()
    } catch (err) {
      setError(errorText(err, "Could not save the event."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="panel" onSubmit={save} style={{ borderColor: "#0b0b12" }}>
      <h2>Edit “{event.title}”</h2>

      <label htmlFor="edit-title">Title</label>
      <input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={255} />

      <label htmlFor="edit-description">Description</label>
      <textarea id="edit-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />

      <div className="two-columns">
        <div>
          <label htmlFor="edit-venue">Venue</label>
          <input id="edit-venue" value={venueName} onChange={(e) => setVenueName(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="edit-address">Address</label>
          <input id="edit-address" value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="edit-start">Starts</label>
          <input id="edit-start" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="edit-end">Ends</label>
          <input id="edit-end" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
        </div>
      </div>

      <label htmlFor="edit-capacity">Capacity</label>
      <input id="edit-capacity" type="number" min={1} step={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} required />
      <p className="muted" style={{ fontSize: 13 }}>Capacity cannot go below the tickets already allocated. Ticket types are not editable after creation.</p>

      {error && <p role="alert" className="error-box">{error}</p>}

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </button>
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export default EditEventForm
