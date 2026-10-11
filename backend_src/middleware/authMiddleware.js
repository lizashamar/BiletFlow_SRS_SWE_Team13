const jwt = require('jsonwebtoken');

const ROLES = Object.freeze({
  ATTENDEE: 'ATTENDEE',
  ORGANIZER: 'ORGANIZER',
  EVENT_ADMIN: 'EVENT_ADMIN',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
});

// 1) Аутентификация: проверяет JWT из заголовка "Authorization: Bearer <token>"
//    и кладёт { id, email, role } в req.user
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
    req.user = { id: payload.id, email: payload.email, role: payload.role };
    return next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ error: msg });
  }
}

// 2) Авторизация (RBAC): authorize(ROLES.ORGANIZER, ROLES.EVENT_ADMIN)
//    PLATFORM_ADMIN имеет доступ ко всему.
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

module.exports = { authenticate, authorize, ROLES };
