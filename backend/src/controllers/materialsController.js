const { pool } = require('../config/db');

async function getAll(req, res) {
  try {
    const result = await pool.query(
      'SELECT * FROM materials WHERE company_id = $1 ORDER BY updated_at DESC, created_at DESC',
      [req.user.company_id]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Erro ao listar materiais', error: error.message });
  }
}

async function create(req, res) {
  try {
    const { name, category = 'geral', stock = 0, unit_price = 0 } = req.body;

    if (!name) {
      return res.status(400).json({ ok: false, message: 'Nome do material é obrigatório' });
    }

    const result = await pool.query(
      `INSERT INTO materials (company_id, name, category, stock, unit_price)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.company_id, name, category, Number(stock), Number(unit_price)]
    );

    res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Erro ao criar material', error: error.message });
  }
}

module.exports = { getAll, create };
