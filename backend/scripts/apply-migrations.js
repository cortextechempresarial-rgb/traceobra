require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { createPool } = require('../src/config/db');

const migrationsDirectory = path.join(__dirname, '..', 'database', 'migrations');
const lockKey = 'traceobra:database-migrations';
const pool = createPool(process.env.DIRECT_URL || process.env.DATABASE_URL);

async function applyMigrations() {
  let client;
  let lockAcquired = false;

  try {
    client = await pool.connect();
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [lockKey]);
    lockAcquired = true;
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version VARCHAR(20) PRIMARY KEY,
        filename TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrations = fs.readdirSync(migrationsDirectory)
      .filter((filename) => /^\d+_[a-z0-9_-]+\.sql$/i.test(filename))
      .sort();

    for (const filename of migrations) {
      const version = filename.slice(0, filename.indexOf('_'));
      const existing = await client.query(
        'SELECT 1 FROM public.schema_migrations WHERE version = $1',
        [version]
      );
      if (existing.rowCount) {
        console.log(`Migration ${version} já aplicada.`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDirectory, filename), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO public.schema_migrations (version, filename) VALUES ($1, $2)',
          [version, filename]
        );
        await client.query('COMMIT');
        console.log(`Migration ${version} aplicada.`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    if (client && lockAcquired) {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]).catch(() => {});
    }
    client?.release();
    await pool.end();
  }
}

applyMigrations().catch((error) => {
  if (['SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_HAS_EXPIRED'].includes(error.code)) {
    console.error('TLS não confiável. Configure DATABASE_SSL_CA com o CA raiz baixado nas configurações SSL do Supabase.');
  } else {
    console.error('Falha ao aplicar migrations:', error.code || error.message);
  }
  process.exitCode = 1;
});