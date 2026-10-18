const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET;

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ ok: false, message: 'Email e senha são obrigatórios.' });
    }

    const result = await pool.query(
      `SELECT u.id, u.company_id, u.name, u.email, u.role, u.password_hash,
              u.screen_permissions
       FROM users u
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE u.email = $1
         AND u.status = 'active'
         AND (u.role = 'super_admin' OR c.status = 'active')
       LIMIT 1`,
      [email.trim().toLowerCase()]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ ok: false, message: 'Credenciais inválidas.' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash || '');

    if (!isValid) {
      return res.status(401).json({ ok: false, message: 'Credenciais inválidas.' });
    }

    const token = jwt.sign(
      {
        sub: user.id,
        id: user.id,
        company_id: user.company_id,
        email: user.email,
        name: user.name,
        role: user.role,
        screen_permissions: user.screen_permissions || [],
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        company_id: user.company_id,
        name: user.name,
        email: user.email,
        role: user.role,
        screen_permissions: user.screen_permissions || [],
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Erro ao realizar login.', error: error.message });
  }
}

async function register(req, res) {
  try {
    const { name, email, password, role = 'user' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ ok: false, message: 'Nome, email e senha são obrigatórios.' });
    }
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string'
      || !['admin', 'engineer', 'user'].includes(role) || password.length < 12) {
      return res.status(400).json({ ok: false, message: 'Informe nome, email, uma função válida e senha com pelo menos 12 caracteres.' });
    }

    const existing = await pool.query('SELECT 1 FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (existing.rowCount) {
      return res.status(409).json({ ok: false, message: 'Este email já está cadastrado.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (company_id, name, email, role, password_hash)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, company_id, name, email, role`,
      [req.user.company_id, name, email.trim().toLowerCase(), role, passwordHash]
    );

    return res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Erro ao cadastrar usuário.', error: error.message });
  }
}

async function me(req, res) {
  return res.json({ ok: true, user: req.user });
}

module.exports = { login, register, me };
