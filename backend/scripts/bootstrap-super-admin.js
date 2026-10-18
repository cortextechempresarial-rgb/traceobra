require('dotenv').config();

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../src/config/db');

async function bootstrapSuperAdmin() {
  const name = (process.env.INITIAL_SUPER_ADMIN_NAME || '').trim();
  const email = (process.env.INITIAL_SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!name || !email) {
    throw new Error('Defina INITIAL_SUPER_ADMIN_NAME e INITIAL_SUPER_ADMIN_EMAIL para criar a conta global.');
  }

  const password = crypto.randomBytes(24).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `INSERT INTO users (company_id, name, email, role, password_hash)
     VALUES (NULL, $1, $2, 'super_admin', $3)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [name, email, passwordHash]
  );
  if (!result.rowCount) {
    throw new Error('Este email já está cadastrado. Nenhuma senha ou conta foi alterada.');
  }

  console.log(`Super admin criado: ${email}`);
  console.log(`Senha temporária (guarde-a; não será exibida novamente): ${password}`);
}

bootstrapSuperAdmin()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
