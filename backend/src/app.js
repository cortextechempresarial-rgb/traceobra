const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { pool } = require('./config/db');

const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS
  || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173,http://127.0.0.1:5173'))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.includes(origin));
  },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    name: 'TraceObra API',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ ok: true, database: 'ready' });
  } catch {
    return res.status(503).json({ ok: false, database: 'unavailable' });
  }
});

app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error('Erro não tratado na API:', err.message);
  res.status(500).json({
    ok: false,
    message: 'Erro interno do servidor',
  });
});

module.exports = app;
