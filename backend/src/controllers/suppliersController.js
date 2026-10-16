const { pool } = require('../config/db');

async function getAll(req, res) {
  try {
    const result = await pool.query(
      'SELECT * FROM suppliers WHERE company_id = $1 ORDER BY created_at DESC',
      [req.user.company_id]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Erro ao listar fornecedores', error: error.message });
  }
}

async function create(req, res) {
  try {
    const { name, contact = '', email = '', phone = '' } = req.body;

    if (!name) {
      return res.status(400).json({ ok: false, message: 'Nome do fornecedor é obrigatório' });
    }

    const result = await pool.query(
      `INSERT INTO suppliers (company_id, name, contact, email, phone)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.company_id, name, contact, email, phone]
    );

    res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Erro ao criar fornecedor', error: error.message });
  }
}

module.exports = { getAll, create };
