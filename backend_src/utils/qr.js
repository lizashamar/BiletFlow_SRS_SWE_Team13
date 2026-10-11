const crypto = require('crypto');

// Криптостойкий уникальный токен для QR-кода билета (64 hex-символа, 256 бит).
// Именно это значение хранится в tickets.qr_code_hash (UNIQUE) и кодируется в QR.
function generateQrHash() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { generateQrHash };
