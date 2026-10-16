const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET;

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ ok: false, message: 'Token de autenticação obrigatório.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.company_id) {
      return res.status(403).json({ ok: false, message: 'Conta sem empresa vinculada.' });
    }
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ ok: false, message: 'Token inválido ou expirado.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, message: 'Usuário não autenticado.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ ok: false, message: 'Permissão negada para esta ação.' });
    }

    return next();
  };
}

function auditMutations(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  res.once('finish', () => {
    pool.query(
      `INSERT INTO audit_logs
         (company_id, actor_user_id, method, resource, status_code, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req.user.company_id || null,
        req.user.sub || req.user.id,
        req.method,
        req.originalUrl.split('?')[0],
        res.statusCode,
        req.ip,
        req.get('user-agent') || null,
      ]
    ).catch((error) => {
      console.error('Falha ao registrar auditoria:', error.message);
    });
  });

  return next();
}

module.exports = { requireAuth, requireRole, auditMutations };
