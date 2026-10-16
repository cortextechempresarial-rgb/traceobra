const { pool } = require('../config/db');

async function getAll(req, res) {
  try {
    const result = await pool.query(`
      SELECT s.*, p.name AS project_name
      FROM project_schedule s
      JOIN projects p ON p.id = s.project_id
      WHERE p.company_id = $1
      ORDER BY s.start_date ASC, s.created_at DESC
    `, [req.user.company_id]);

    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Erro ao listar cronograma', error: error.message });
  }
}

async function create(req, res) {
  try {
    const {
      project_id,
      title,
      phase = 'implantação',
      status = 'planejado',
      progress = 0,
      start_date,
      end_date,
      owner = 'Equipe',
      notes = '',
    } = req.body;

    if (!project_id || !title) {
      return res.status(400).json({ ok: false, message: 'project_id e title são obrigatórios' });
    }

    const project = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND company_id = $2',
      [project_id, req.user.company_id]
    );
    if (!project.rowCount) {
      return res.status(404).json({ ok: false, message: 'Obra não encontrada nesta empresa' });
    }

    const result = await pool.query(
      `INSERT INTO project_schedule (project_id, title, phase, status, progress, start_date, end_date, owner, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        project_id,
        title,
        phase,
        status,
        Number(progress),
        start_date || null,
        end_date || null,
        owner,
        notes,
      ]
    );

    res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Erro ao criar atividade do cronograma', error: error.message });
  }
}

module.exports = { getAll, create };
