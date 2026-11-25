import { categoryOf, coverOf } from "../api"

function EventCover({ title, height, live }: { title: string; height?: number; live?: boolean }) {
  return (
    <div className="event-cover" style={{ background: coverOf(title), height }}>
      <div className="cover-pattern" />
      <span className="badge">{categoryOf(title)}</span>
      {live && <span className="badge live-badge cover-live">● Live now</span>}
      <span className="cover-initial">{title.charAt(0)}</span>
    </div>
  )
}

export default EventCover
