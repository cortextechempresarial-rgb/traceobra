const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
const caPath = process.env.DATABASE_SSL_CA?.trim();
const ca = caPath
  ? fs.readFileSync(path.resolve(__dirname, '../..', caPath), 'utf8')
  : undefined;

function createPool(connectionString = databaseUrl) {
  const databaseHost = connectionString ? new URL(connectionString).hostname : '';
  const isSupabaseConnection = /(^|\.)supabase\.(co|com)$/i.test(databaseHost);
  const sslRequired = isSupabaseConnection || process.env.NODE_ENV === 'production';

  return new Pool({
    connectionString,
    ssl: sslRequired
      ? { rejectUnauthorized: true, ...(ca ? { ca } : {}) }
      : false,
  });
}

const pool = createPool();

module.exports = { pool, createPool };
