const { pool } = require('../config/db');

async function getAll(req, res) {
  try {
    const result = await pool.query(
      'SELECT * FROM financial_entries WHERE company_id = $1 ORDER BY entry_date DESC, created_at DESC',
      [req.user.company_id]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Erro ao listar financeiro', error: error.message });
  }
}

async function create(req, res) {
  try {
    const { type, category = 'geral', description, amount, entry_date } = req.body;

    if (!type || !amount) {
      return res.status(400).json({ ok: false, message: 'Tipo e valor são obrigatórios' });
    }

    const result = await pool.query(
      `INSERT INTO financial_entries (company_id, type, category, description, amount, entry_date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.company_id, type, category, description || '', Number(amount), entry_date || new Date().toISOString().slice(0, 10)]
    );

    res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Erro ao registrar financeiro', error: error.message });
  }
}

module.exports = { getAll, create };
