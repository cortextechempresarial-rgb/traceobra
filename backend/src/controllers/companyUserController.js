const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../config/db');

const screenKeys = new Set([
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

function validateUserFields({ name, email, role, screenPermissions, status = 'active' }) {
  if (typeof name !== 'string' || !name.trim() || typeof email !== 'string'
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    || !['admin', 'engineer', 'user'].includes(role)
    || !['active', 'inactive'].includes(status)
    || !Array.isArray(screenPermissions)
    || screenPermissions.some((screen) => !screenKeys.has(screen))) {
    return 'Confira o nome, email, função, situação e telas permitidas do usuário.';
  }
  return null;
}

async function getAll(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, company_id, name, email, role, screen_permissions, status, created_at
       FROM users
       WHERE company_id = $1
       ORDER BY created_at DESC`,
      [req.user.company_id]
    );
    return res.json({ ok: true, data: result.rows });
  } catch (error) {
    console.error('Falha ao listar usuários da empresa:', error.code || error.message);
    return res.status(500).json({ ok: false, message: 'Não foi possível carregar os usuários da empresa.' });
  }
}

async function create(req, res) {
  const { name, email, role = 'user', screen_permissions: screenPermissions = [] } = req.body;
  const validationError = validateUserFields({ name, email, role, screenPermissions });
  if (validationError) return res.status(400).json({ ok: false, message: validationError });

  const password = crypto.randomBytes(15).toString('base64url');
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (company_id, name, email, role, password_hash, screen_permissions)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, company_id, name, email, role, screen_permissions, status, created_at`,
      [
        req.user.company_id,
        name.trim(),
        email.trim().toLowerCase(),
        role,
        passwordHash,
        JSON.stringify(screenPermissions),
      ]
    );
    return res.status(201).json({ ok: true, data: result.rows[0], temporary_password: password });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ ok: false, message: 'Este email já está cadastrado.' });
    }
    console.error('Falha ao cadastrar usuário da empresa:', error.code || error.message);
    return res.status(500).json({ ok: false, message: 'Não foi possível cadastrar o usuário.' });
  }
}

async function update(req, res) {
  const userId = req.params.id;
  const { name, email, role, screen_permissions: screenPermissions, status } = req.body;
  const validationError = validateUserFields({ name, email, role, screenPermissions, status });
  if (validationError) return res.status(400).json({ ok: false, message: validationError });
  if (userId === req.user.id && status !== 'active') {
    return res.status(400).json({ ok: false, message: 'Não é permitido desativar a própria conta.' });
  }
  if (userId === req.user.id && role !== 'admin') {
    return res.status(400).json({ ok: false, message: 'Não é permitido remover sua própria função de administrador.' });
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET name = $1, email = $2, role = $3, screen_permissions = $4::jsonb, status = $5
       WHERE id = $6 AND company_id = $7 AND role <> 'super_admin'
       RETURNING id, company_id, name, email, role, screen_permissions, status, created_at`,
      [
        name.trim(),
        email.trim().toLowerCase(),
        role,
        JSON.stringify(screenPermissions),
        status,
        userId,
        req.user.company_id,
      ]
    );
    if (!result.rowCount) {
      return res.status(404).json({ ok: false, message: 'Usuário não encontrado nesta empresa.' });
    }
    return res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ ok: false, message: 'Este email já está cadastrado.' });
    }
    console.error('Falha ao atualizar usuário da empresa:', error.code || error.message);
    return res.status(500).json({ ok: false, message: 'Não foi possível atualizar o usuário.' });
  }
}

module.exports = { getAll, create, update };
