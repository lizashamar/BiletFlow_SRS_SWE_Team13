// Минимальный генератор iCalendar (RFC 5545) для SRS 4.11.
const esc = (s) => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const stamp = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// строки >75 октетов переносятся (CRLF + пробел)
function fold(line) {
  const out = [];
  let cur = '';
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch) > 74) {
      out.push(cur);
      cur = ' ' + ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n');
}

function buildEventIcs(event, { baseUrl = '' } = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BiletFlow//Event Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    // стабильный UID: обновлённый файл заменяет прежнюю запись в календаре
    `UID:event-${event.id}@biletflow.kz`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(event.startTime)}`,
    `DTEND:${stamp(event.endTime)}`,
    `SUMMARY:${esc(event.title)}`,
    `DESCRIPTION:${esc(event.description || '')}`,
    `LOCATION:${esc(`${event.venueName}, ${event.venueAddress}`)}`,
    baseUrl ? `URL:${baseUrl.replace(/\/$/, '')}/events/${event.id}` : null,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.map(fold).join('\r\n') + '\r\n';
}

module.exports = { buildEventIcs };
