const { pool } = require('../config/db');

async function getAll(req, res) {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.cnpj, c.status, c.created_at,
             COUNT(u.id)::int AS user_count
      FROM companies c
      LEFT JOIN users u ON u.company_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC, c.name ASC
    `);
    return res.json({ ok: true, data: result.rows });
  } catch (error) {
    console.error('Falha ao listar empresas:', error.code || error.message);
    return res.status(500).json({ ok: false, message: 'Não foi possível carregar as empresas.' });
  }
}

async function create(req, res) {
  const { name, cnpj = '' } = req.body;
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ ok: false, message: 'O nome da empresa é obrigatório.' });
  }
  if (typeof cnpj !== 'string' || cnpj.length > 18) {
    return res.status(400).json({ ok: false, message: 'Informe um CNPJ válido.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO companies (name, cnpj, status)
       VALUES ($1, $2, 'active')
       RETURNING id, name, cnpj, status, created_at`,
      [name.trim(), cnpj.trim() || null]
    );
    return res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    console.error('Falha ao cadastrar empresa:', error.code || error.message);
    return res.status(500).json({ ok: false, message: 'Não foi possível cadastrar a empresa.' });
  }
}

async function update(req, res) {
  const { name, cnpj, status } = req.body;
  const parsedName = typeof name === 'string' ? name.trim() : '';
  const parsedCnpj = typeof cnpj === 'string' ? cnpj.trim() : '';
  if (!parsedName || parsedCnpj.length > 18 || !['active', 'inactive'].includes(status)) {
    return res.status(400).json({ ok: false, message: 'Informe nome, CNPJ e situação válidos para a empresa.' });
  }

  try {
    const result = await pool.query(
      `UPDATE companies
       SET name = $1, cnpj = $2, status = $3
       WHERE id = $4
       RETURNING id, name, cnpj, status, created_at`,
      [parsedName, parsedCnpj || null, status, req.params.id]
    );
    if (!result.rowCount) {
      return res.status(404).json({ ok: false, message: 'Empresa não encontrada.' });
    }
    return res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    console.error('Falha ao atualizar empresa:', error.code || error.message);
    return res.status(500).json({ ok: false, message: 'Não foi possível atualizar a empresa.' });
  }
}

module.exports = { getAll, create, update };
