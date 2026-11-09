// Централизованный доступ к секретам. В production небезопасный дефолт запрещён.
function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  return 'supersecretkey';
}

module.exports = { getJwtSecret };
