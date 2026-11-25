const crypto = require('crypto');

function generateQrHash() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { generateQrHash };
