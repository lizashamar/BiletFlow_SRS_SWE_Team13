const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config');

const ROLES = Object.freeze({
  ATTENDEE: 'ATTENDEE',
  ORGANIZER: 'ORGANIZER',
  EVENT_ADMIN: 'EVENT_ADMIN',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
});

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    req.user = { id: payload.id, email: payload.email, role: payload.role };
    return next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ error: msg });
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.role === ROLES.PLATFORM_ADMIN || allowedRoles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
  };
}

function optionalAuth(req, res, next) {
  if (!req.headers.authorization) return next();
  return authenticate(req, res, next);
}

module.exports = { authenticate, optionalAuth, authorize, ROLES };
