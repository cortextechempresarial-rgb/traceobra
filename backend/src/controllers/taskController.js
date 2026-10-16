const { pool } = require('../config/db');

async function getAll(req, res) {
  try {
    const result = await pool.query(`
      SELECT t.*, p.name AS project_name, u.name AS assignee_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE p.company_id = $1
      ORDER BY t.created_at DESC
    `, [req.user.company_id]);
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Erro ao listar tarefas', error: error.message });
  }
}

async function create(req, res) {
  try {
    const { project_id, title, description, status = 'pending', priority = 'medium', assignee_id, due_date } = req.body;

    if (!title || !project_id) {
      return res.status(400).json({ ok: false, message: 'Título e obra da tarefa são obrigatórios' });
    }

    const project = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND company_id = $2',
      [project_id, req.user.company_id]
    );
    if (!project.rowCount) {
      return res.status(404).json({ ok: false, message: 'Obra não encontrada nesta empresa' });
    }

    if (assignee_id) {
      const assignee = await pool.query(
        'SELECT id FROM users WHERE id = $1 AND company_id = $2',
        [assignee_id, req.user.company_id]
      );
      if (!assignee.rowCount) {
        return res.status(404).json({ ok: false, message: 'Responsável não encontrado nesta empresa' });
      }
    }

    const result = await pool.query(
      `INSERT INTO tasks (project_id, title, description, status, priority, assignee_id, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [project_id || null, title, description || '', status, priority, assignee_id || null, due_date || null]
    );

    res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Erro ao criar tarefa', error: error.message });
  }
}

module.exports = { getAll, create };
