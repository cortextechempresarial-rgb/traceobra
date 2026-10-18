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

async function me(req, res) {
  return res.json({ ok: true, user: req.user });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ ok: false, message: 'Informe a senha atual e a nova senha.' });
  }
  if (Buffer.byteLength(newPassword, 'utf8') < 8 || Buffer.byteLength(newPassword, 'utf8') > 72) {
    return res.status(400).json({ ok: false, message: 'A nova senha deve ter entre 8 e 72 bytes.' });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ ok: false, message: 'A nova senha deve ser diferente da senha atual.' });
  }

  try {
    const result = await pool.query(
      `SELECT password_hash
       FROM users
       WHERE id = $1 AND status = 'active'
       LIMIT 1`,
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user || !await bcrypt.compare(currentPassword, user.password_hash || '')) {
      return res.status(400).json({ ok: false, message: 'A senha atual está incorreta.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const update = await pool.query(
      `UPDATE users
       SET password_hash = $1
       WHERE id = $2 AND status = 'active' AND password_hash = $3`,
      [passwordHash, req.user.id, user.password_hash]
    );
    if (!update.rowCount) {
      return res.status(409).json({ ok: false, message: 'A senha foi alterada em outra sessão. Entre novamente e tente de novo.' });
    }

    return res.json({ ok: true, message: 'Senha alterada com sucesso.' });
  } catch (error) {
    console.error('Falha ao alterar senha da conta:', error.code || error.message);
    return res.status(500).json({ ok: false, message: 'Não foi possível alterar a senha.' });
  }
}

module.exports = { login, me, changePassword };
