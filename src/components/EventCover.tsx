import { categoryOf, coverOf } from "../api"

function EventCover({ title, height }: { title: string; height?: number }) {
  return (
    <div className="event-cover" style={{ background: coverOf(title), height }}>
      <div className="cover-pattern" />
      <span className="badge">{categoryOf(title)}</span>
      <span className="cover-initial">{title.charAt(0)}</span>
    </div>
  )
}

export default EventCover
