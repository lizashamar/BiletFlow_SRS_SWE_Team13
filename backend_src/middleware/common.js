// CORS, простой rate-limit и финальные обработчики ошибок.

function cors(req, res, next) {
  const allowed = (process.env.CORS_ORIGIN || '*').trim();
  res.set('Access-Control-Allow-Origin', allowed);
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
}

// Фиксированное окно, in-memory (достаточно для одного инстанса). Используется для /login.
function rateLimit({ windowMs, max, message = 'Too many requests, try again later' }) {
  const hits = new Map(); // key -> { count, resetAt }
  return (req, res, next) => {
    if (process.env.RATE_LIMIT_DISABLED === '1') return next();
    const now = Date.now();
    const key = req.ip;
    let h = hits.get(key);
    if (!h || h.resetAt <= now) {
      h = { count: 0, resetAt: now + windowMs };
      hits.set(key, h);
    }
    h.count += 1;
    if (h.count > max) {
      res.set('Retry-After', String(Math.ceil((h.resetAt - now) / 1000)));
      return res.status(429).json({ error: message });
    }
    if (hits.size > 10000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    return next();
  };
}

function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Некорректный JSON и т.п. должны давать 400, а не HTML-страницу с 500.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large' });
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}

module.exports = { cors, rateLimit, notFound, errorHandler };
