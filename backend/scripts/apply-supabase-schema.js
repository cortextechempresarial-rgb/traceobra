require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL não foi encontrado no arquivo .env');
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
    await client.query(schema);

    const tables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );

    const userCheck = await client.query('SELECT id, name, email FROM users LIMIT 5');

    console.log('TABLES:', tables.rows.map((row) => row.table_name).join(', '));
    console.log('USER_COUNT:', userCheck.rowCount);
    console.log('FIRST_USER:', userCheck.rows[0] || 'none');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('DB_ERROR:', error.message);
  process.exit(1);
});
