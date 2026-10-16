require('dotenv').config();

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../src/config/db');

async function bootstrapAdmin() {
  const generatedPassword = process.argv.includes('--generate-password');
  const email = (process.env.INITIAL_ADMIN_EMAIL || 'admin@traceobra.com').trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD
    || (generatedPassword ? crypto.randomBytes(24).toString('base64url') : '');

  if (!email || !password || password.length < 12) {
    throw new Error('Defina INITIAL_ADMIN_EMAIL e uma INITIAL_ADMIN_PASSWORD com pelo menos 12 caracteres.');
  }

  const company = await pool.query('SELECT id FROM companies ORDER BY created_at ASC LIMIT 1');
  if (!company.rowCount) {
    throw new Error('Nenhuma empresa cadastrada. Aplique o schema antes do bootstrap.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await pool.query(
    `INSERT INTO users (company_id, name, email, role, password_hash)
     VALUES ($1, 'Administrador', $2, 'admin', $3)
     ON CONFLICT (email) DO UPDATE
       SET company_id = COALESCE(users.company_id, EXCLUDED.company_id),
           password_hash = EXCLUDED.password_hash
       WHERE users.role = 'admin'
     RETURNING id`,
    [company.rows[0].id, email, passwordHash]
  );

  if (!admin.rowCount) {
    throw new Error('O email informado já pertence a um usuário que não é administrador.');
  }

  console.log(`Administrador inicial preparado: ${email}`);
  if (generatedPassword && !process.env.INITIAL_ADMIN_PASSWORD) {
    console.log(`Senha inicial de uso único: ${password}`);
  }
}

bootstrapAdmin()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());