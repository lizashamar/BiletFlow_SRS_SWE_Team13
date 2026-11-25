import { useCallback, useEffect, useState } from "react"
import type { FormEvent } from "react"
import { ApiError, api, dateTime, errorText } from "../api"

type ScannerEvent = { id: number; title: string; venueName: string; startTime: string }
type Stats = { registered: number; checkedIn: number; remaining: number; checkInPercent: number }
type Result = {
  kind: "ok" | "duplicate" | "error"
  title: string
  detail?: string
}

function CheckIn() {
  const [events, setEvents] = useState<ScannerEvent[]>([])
  const [eventId, setEventId] = useState("")
  const [code, setCode] = useState("")
  const [stats, setStats] = useState<Stats | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    api<ScannerEvent[]>("/checkin/events")
      .then((list) => {
        setEvents(list)
        if (list.length) setEventId(String(list[0].id))
      })
      .catch((err) => setError(errorText(err, "Could not load events.")))
  }, [])

  const loadStats = useCallback(async () => {
    if (!eventId) return
    try {
      setStats(await api<Stats>(`/checkin/stats/${eventId}`))
    } catch {
      setStats(null)
    }
  }, [eventId])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const verify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setResult(null)
    setLoading(true)
    try {
      const data = await api<{ ticket: { id: number; attendeeName: string; ticketType: string }; checkedInAt: string }>(
        "/checkin/verify",
        { method: "POST", body: { qrCodeHash: code.trim(), eventId: Number(eventId) } }
      )
      setResult({
        kind: "ok",
        title: "Admitted",
        detail: `${data.ticket.attendeeName} · ${data.ticket.ticketType} · BF-${data.ticket.id}`,
      })
      setCode("")
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const ticket = err.body.ticket as { attendeeName?: string; id?: number } | undefined
        setResult({
          kind: "duplicate",
          title: "Already checked in — entry rejected",
          detail: `${ticket?.attendeeName ?? ""} · first scanned ${dateTime(String(err.body.checkedInAt))}`,
        })
      } else {
        setResult({ kind: "error", title: "Rejected", detail: errorText(err, "Verification failed.") })
      }
    } finally {
      setLoading(false)
      void loadStats()
    }
  }

  return (
    <main className="page-container narrow">
      <h1>Ticket Check-in</h1>
      <p className="muted">Paste or type the code from the attendee's ticket. The mobile app scans the same code with the camera.</p>

      {error && <p role="alert" className="error-box">{error}</p>}

      <form className="panel" onSubmit={verify}>
        <label htmlFor="event">Event</label>
        <select id="event" value={eventId} onChange={(e) => setEventId(e.target.value)} required>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.title} — {dateTime(ev.startTime)}
            </option>
          ))}
        </select>

        <label htmlFor="code">Ticket code</label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="QR code value"
          autoComplete="off"
          required
        />

        <button type="submit" className="primary-button" disabled={loading || !eventId}>
          {loading ? "Checking..." : "Verify & check in"}
        </button>
      </form>

      {result && (
        <div role="status" className={`scan-result scan-${result.kind}`}>
          <strong>{result.kind === "ok" ? "✔" : "✖"} {result.title}</strong>
          {result.detail && <p style={{ margin: "6px 0 0" }}>{result.detail}</p>}
        </div>
      )}

      {stats && (
        <section className="stats-grid" style={{ marginTop: 20 }}>
          <div className="panel stat"><span className="muted">Registered</span><strong>{stats.registered}</strong></div>
          <div className="panel stat"><span className="muted">Checked in</span><strong>{stats.checkedIn}</strong></div>
          <div className="panel stat"><span className="muted">Not yet arrived</span><strong>{stats.remaining}</strong></div>
        </section>
      )}
    </main>
  )
}

export default CheckIn
