class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Единый обработчик ошибок для контроллеров
function handleError(res, err) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}

module.exports = { HttpError, handleError };
