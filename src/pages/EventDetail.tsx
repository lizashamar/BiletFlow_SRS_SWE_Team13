import { useEffect, useState } from "react"
import Icon from "../components/Icon"
import { api, calendarUrl, categoryOf, coverOf, dateTime, money, priceLabel } from "../api"
import type { Event } from "../api"

type Props = {
  event: Event
  onBack: () => void
  onBuy: (event: Event) => void
}

function EventDetail({ event: initial, onBack, onBuy }: Props) {
  const [event, setEvent] = useState(initial)

  useEffect(() => {
    api<Event>(`/events/${initial.id}`).then(setEvent).catch(() => undefined)
  }, [initial.id])

  const left = event.ticketTypes.reduce((s, t) => s + t.remainingQuantity, 0)
  const durationHours = Math.round((new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / 36e5)

  return (
    <main className="page-container">
      <button className="secondary-button small-button" onClick={onBack}>
        <Icon name="arrow-left" /> Back to events
      </button>

      <section className="detail-hero" style={{ background: coverOf(event.title) }}>
        <div className="cover-pattern" />
        <div>
          <span className="badge">{categoryOf(event.title)}</span>
          {event.status === "ACTIVE" && <span className="badge live-badge">● Live now</span>}
          <h1>{event.title}</h1>
        </div>
      </section>

      <div className="detail-layout">
        <div>
          <section className="panel">
            <h2>About this event</h2>
            <p className="muted" style={{ lineHeight: 1.6 }}>
              {event.description || "The organizer has not added a description yet."}
            </p>
          </section>

          <section className="panel">
            <h2>When &amp; where</h2>
            <div className="info-list">
              <div className="info-item">
                <span className="icon-button"><Icon name="calendar" /></span>
                <div>
                  <strong>{dateTime(event.startTime)}</strong>
                  <small>Ends {dateTime(event.endTime)} · about {durationHours} h</small>
                </div>
              </div>
              <div className="info-item">
                <span className="icon-button"><Icon name="pin" /></span>
                <div>
                  <strong>{event.venueName}</strong>
                  <small>{event.venueAddress}</small>
                </div>
              </div>
            </div>
            <p style={{ marginBottom: 0 }}>
              <a className="calendar-link" href={calendarUrl(event.id)}>
                <Icon name="calendar" /> Add to calendar (.ics)
              </a>
            </p>
          </section>
        </div>

        <aside className="panel" style={{ position: "sticky", top: 90 }}>
          <p className="muted" style={{ margin: 0 }}>Tickets</p>
          <h2 style={{ margin: "4px 0 0" }}>{priceLabel(event)}</h2>
          <div className="price-list">
            {event.ticketTypes.map((t) => (
              <div key={t.id} className="price-row">
                <span>
                  <strong>{t.name}</strong>
                  <small>{t.remainingQuantity > 0 ? `${t.remainingQuantity} of ${t.totalQuantity} left` : "Sold out"}</small>
                </span>
                <strong>{t.price > 0 ? money(t.price) : "Free"}</strong>
              </div>
            ))}
          </div>
          <button className="primary-button block" disabled={left === 0} onClick={() => onBuy(event)}>
            {left > 0 ? "Get Tickets" : "Sold out"}
          </button>
          <p className="muted" style={{ fontSize: 13, textAlign: "center", marginBottom: 0 }}>
            Max 10 tickets per attendee for this event.
          </p>
        </aside>
      </div>
    </main>
  )
}

export default EventDetail
