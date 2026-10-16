require('dotenv').config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('Configure JWT_SECRET com pelo menos 32 caracteres no arquivo backend/.env.');
}

const app = require('./app');
const { pool } = require('./config/db');

const PORT = Number(process.env.PORT || 4000);

async function startServer() {
  try {
    const result = await pool.query('SELECT 1');
    console.log('Conexão com PostgreSQL ok:', result.rowCount > 0);
  } catch (error) {
    console.error('Falha ao conectar ao PostgreSQL:', error.message);
    if (process.env.NODE_ENV === 'production') {
      await pool.end();
      process.exitCode = 1;
      return;
    }
    console.warn('API iniciada em desenvolvimento; /api/ready continuará indisponível até o banco conectar.');
  }

  app.listen(PORT, () => {
    console.log(`TraceObra API rodando em http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Falha ao iniciar a API:', error.message);
  process.exitCode = 1;
});
