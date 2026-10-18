const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET;

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ ok: false, message: 'Token de autenticação obrigatório.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query(
      `SELECT u.id, u.company_id, u.name, u.email, u.role, u.screen_permissions, u.status,
              c.status AS company_status
       FROM users u
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE u.id = $1
       LIMIT 1`,
      [decoded.sub || decoded.id]
    );
    if (!result.rowCount) {
      return res.status(401).json({ ok: false, message: 'Conta não encontrada ou desativada.' });
    }
    const currentUser = result.rows[0];
    if (currentUser.status !== 'active') {
      return res.status(401).json({ ok: false, message: 'Conta não encontrada ou desativada.' });
    }
    if (currentUser.role === 'super_admin' && currentUser.company_id) {
      return res.status(403).json({ ok: false, message: 'Conta super admin deve ser global e não pode estar vinculada a uma empresa.' });
    }
    if (currentUser.role !== 'super_admin' && !currentUser.company_id) {
      return res.status(403).json({ ok: false, message: 'Conta sem empresa vinculada.' });
    }
    if (currentUser.company_id && currentUser.company_status !== 'active') {
      return res.status(403).json({ ok: false, message: 'A empresa desta conta está inativa.' });
    }
    req.user = {
      sub: currentUser.id,
      id: currentUser.id,
      company_id: currentUser.company_id,
      name: currentUser.name,
      email: currentUser.email,
      role: currentUser.role,
      screen_permissions: currentUser.screen_permissions || [],
    };
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ ok: false, message: 'Token inválido ou expirado.' });
    }
    console.error('Falha ao validar conta autenticada:', error.code || error.message);
    return res.status(500).json({ ok: false, message: 'Não foi possível validar a sessão.' });
  }
}

const validScreens = new Set([
  'dashboard',
  'clients',
  'projects',
  'subdivisions',
  'tasks',
  'schedule',
  'materials',
  'suppliers',
  'maps',
  'concrete',
  'finance',
]);

function requireScreen(...screens) {
  return (req, res, next) => {
    if (screens.some((screen) => !validScreens.has(screen))) {
      return res.status(500).json({ ok: false, message: 'Permissão de tela inválida na configuração da API.' });
    }
    if (req.user?.role === 'admin' || screens.some((screen) => req.user?.screen_permissions?.includes(screen))) {
      return next();
    }
    return res.status(403).json({ ok: false, message: 'Seu usuário não tem acesso a esta tela.' });
  };
}

function requireCompany(req, res, next) {
  if (!req.user?.company_id || req.user.role === 'super_admin') {
    return res.status(403).json({ ok: false, message: 'Esta área exige uma conta vinculada a uma empresa.' });
  }
  return next();
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

module.exports = { requireAuth, requireCompany, requireRole, requireScreen, auditMutations };
