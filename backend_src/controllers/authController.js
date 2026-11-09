const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { getJwtSecret } = require('../config');
const { HttpError, handleError } = require('../utils/httpError');
const { audit } = require('../utils/audit');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Самостоятельно регистрироваться можно только как attendee / organizer.
// EVENT_ADMIN и PLATFORM_ADMIN выдаются только вручную.
const SELF_REGISTER_ROLES = ['ATTENDEE', 'ORGANIZER'];

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, getJwtSecret(), { expiresIn: '24h' });
}

const publicUser = (u) => ({ id: u.id, name: u.fullName, email: u.email, role: u.role });

// POST /api/auth/login { email, password }
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      throw new HttpError(400, 'email and password are required');
    }

    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    // Один и тот же ответ для «нет пользователя» и «неверный пароль» — не раскрываем наличие аккаунта.
    const ok = user ? await bcrypt.compare(password, user.passwordHash).catch(() => false) : false;
    if (!ok) throw new HttpError(401, 'Invalid email or password');

    return res.json({ message: 'Login successful', token: signToken(user), user: publicUser(user) });
  } catch (err) {
    return handleError(res, err);
  }
};

// POST /api/auth/register { email, password, fullName, role? }
exports.register = async (req, res) => {
  try {
    const { email, password, fullName, role = 'ATTENDEE' } = req.body || {};
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.length > 255) {
      throw new HttpError(400, 'A valid email is required');
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
      throw new HttpError(400, 'Password must be 8-72 characters long');
    }
    if (typeof fullName !== 'string' || !fullName.trim() || fullName.length > 255) {
      throw new HttpError(400, 'fullName is required');
    }
    if (!SELF_REGISTER_ROLES.includes(role)) {
      throw new HttpError(400, `role must be one of: ${SELF_REGISTER_ROLES.join(', ')}`);
    }

    const normalized = email.trim().toLowerCase();
    if (await prisma.user.findUnique({ where: { email: normalized } })) {
      throw new HttpError(409, 'Email already registered');
    }
    const user = await prisma.user.create({
      data: { email: normalized, passwordHash: await bcrypt.hash(password, 10), fullName: fullName.trim(), role },
    });
    audit('user.register', user, { userId: user.id });
    return res.status(201).json({ message: 'Registered', token: signToken(user), user: publicUser(user) });
  } catch (err) {
    // гонка двух регистраций с одним email -> unique violation
    if (err && err.code === 'P2002') return handleError(res, new HttpError(409, 'Email already registered'));
    return handleError(res, err);
  }
};

// GET /api/auth/me
exports.me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) throw new HttpError(401, 'User no longer exists');
    return res.json({ user: publicUser(user) });
  } catch (err) {
    return handleError(res, err);
  }
};
