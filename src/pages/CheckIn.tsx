import { useCallback, useEffect, useState } from "react"
import type { FormEvent } from "react"
import Icon from "../components/Icon"
import { ApiError, api, dateTime, errorText } from "../api"

type ScannerEvent = { id: number; title: string; venueName: string; startTime: string }
type Stats = { registered: number; checkedIn: number; remaining: number; checkInPercent: number }
type CheckInTicket = { id: number; attendeeName: string; ticketType: string }
type SearchResult = { ticketId: number; attendeeName: string; ticketType: string; status: string }
type Result = {
  kind: "ok" | "duplicate" | "error"
  title: string
  detail?: string
  ticketId?: number
}

function CheckIn() {
  const [events, setEvents] = useState<ScannerEvent[]>([])
  const [eventId, setEventId] = useState("")
  const [code, setCode] = useState("")
  const [stats, setStats] = useState<Stats | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [matches, setMatches] = useState<SearchResult[] | null>(null)

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

  const search = useCallback(async (q: string) => {
    if (!eventId || q.trim().length < 2) {
      setMatches(null)
      return
    }
    try {
      const r = await api<{ results: SearchResult[] }>(`/checkin/search/${eventId}?q=${encodeURIComponent(q.trim())}`)
      setMatches(r.results)
    } catch (err) {
      setError(errorText(err, "Search failed."))
    }
  }, [eventId])

  useEffect(() => {
    void loadStats()
    setMatches(null)
    setQuery("")
    setResult(null)
  }, [loadStats])

  useEffect(() => {
    const t = setTimeout(() => void search(query), 250)
    return () => clearTimeout(t)
  }, [query, search])

  const refresh = () => {
    void loadStats()
    void search(query)
  }

  const runCheckIn = async (path: string, body: Record<string, unknown>) => {
    setResult(null)
    setError("")
    setLoading(true)
    try {
      const data = await api<{ ticket: CheckInTicket; checkedInAt: string }>(path, { method: "POST", body })
      setResult({
        kind: "ok",
        title: "Admitted",
        detail: `${data.ticket.attendeeName} · ${data.ticket.ticketType} · BF-${data.ticket.id}`,
        ticketId: data.ticket.id,
      })
      setCode("")
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const ticket = err.body.ticket as Partial<CheckInTicket> | undefined
        setResult({
          kind: "duplicate",
          title: "Already checked in — entry rejected",
          detail: `${ticket?.attendeeName ?? ""} · first scanned ${dateTime(String(err.body.checkedInAt))}`,
          ticketId: ticket?.id,
        })
      } else {
        setResult({ kind: "error", title: "Rejected", detail: errorText(err, "Verification failed.") })
      }
    } finally {
      setLoading(false)
      refresh()
    }
  }

  const verify = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    void runCheckIn("/checkin/verify", { qrCodeHash: code.trim(), eventId: Number(eventId) })
  }

  const manual = (ticketId: number) =>
    void runCheckIn("/checkin/manual", { ticketId, eventId: Number(eventId) })

  const undo = async (ticketId: number) => {
    if (!window.confirm(`Undo the check-in for ticket BF-${ticketId}? The ticket becomes valid again.`)) return
    setError("")
    try {
      const r = await api<{ ticket: { attendeeName: string } }>("/checkin/undo", { method: "POST", body: { ticketId } })
      setResult({ kind: "ok", title: "Check-in reversed", detail: `${r.ticket.attendeeName} · BF-${ticketId} is valid again` })
    } catch (err) {
      setResult({ kind: "error", title: "Could not undo", detail: errorText(err, "Undo failed.") })
    } finally {
      refresh()
    }
  }

  return (
    <main className="page-container narrow">
      <p className="eyebrow">Gate</p>
      <h1>Ticket Check-in</h1>
      <p className="muted">
        Paste the code from the attendee's ticket or find them by name. Check-in opens 3 hours before the event starts and closes when it ends.
      </p>

      {error && <p role="alert" className="error-box">{error}</p>}

      <form className="panel" onSubmit={verify}>
        <label htmlFor="event" style={{ marginTop: 0 }}>Event</label>
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

        <button type="submit" className="primary-button block" disabled={loading || !eventId}>
          <Icon name="scan" /> {loading ? "Checking..." : "Verify & check in"}
        </button>
      </form>

      {result && (
        <div role="status" className={`scan-result scan-${result.kind}`}>
          <span className="scan-icon">
            <Icon name={result.kind === "ok" ? "check" : "x"} size={28} />
          </span>
          <div style={{ flex: 1 }}>
            <strong>{result.title}</strong>
            {result.detail && <p style={{ margin: "4px 0 0" }}>{result.detail}</p>}
          </div>
          {result.ticketId && result.kind !== "error" && result.title !== "Check-in reversed" && (
            <button className="secondary-button small-button" onClick={() => void undo(result.ticketId!)}>
              Undo check-in
            </button>
          )}
        </div>
      )}

      {stats && (
        <section className="stats-grid" style={{ marginTop: 20 }}>
          <div className="dashboard-card stat"><span className="muted">Registered</span><strong>{stats.registered}</strong></div>
          <div className="dashboard-card stat"><span className="muted">Checked in</span><strong>{stats.checkedIn}</strong></div>
          <div className="dashboard-card stat"><span className="muted">Not yet arrived</span><strong>{stats.remaining}</strong></div>
        </section>
      )}

      <section className="panel">
        <h3>Find attendee by name</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>For guests without their phone: look them up and check in manually.</p>
        <label className="search-field" style={{ marginTop: 8 }}>
          <Icon name="search" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type at least 2 letters of the name"
            aria-label="Search attendee by name"
            style={{ border: 0, margin: 0, padding: "14px 0" }}
          />
        </label>

        {matches && matches.length === 0 && <p className="muted">No attendees match “{query}”.</p>}
        {matches && matches.length > 0 && (
          <table className="data-table" style={{ marginTop: 12 }}>
            <tbody>
              {matches.map((m) => (
                <tr key={m.ticketId}>
                  <td>
                    <strong>{m.attendeeName}</strong>
                    <div className="muted" style={{ fontSize: 13 }}>BF-{m.ticketId} · {m.ticketType}</div>
                  </td>
                  <td>
                    <span className={`status-badge status-${m.status.toLowerCase()}`}>
                      {m.status === "CHECKED_IN" ? "Checked in" : m.status === "VALID" ? "Valid" : m.status.toLowerCase()}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {m.status === "VALID" && (
                      <button className="primary-button small-button" onClick={() => manual(m.ticketId)} disabled={loading}>
                        Check in
                      </button>
                    )}
                    {m.status === "CHECKED_IN" && (
                      <button className="secondary-button small-button" onClick={() => void undo(m.ticketId)}>
                        Undo
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}

export default CheckIn
