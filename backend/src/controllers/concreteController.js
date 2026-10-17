const { pool } = require('../config/db');

const checklistKeys = [
  'forms_clean',
  'reinforcement_checked',
  'cover_checked',
  'slump_test_recorded',
  'samples_taken',
  'release_authorized',
];

const transitions = {
  planned: ['pouring'],
  pouring: ['awaiting_inspection'],
  awaiting_inspection: ['awaiting_inspection', 'approved', 'rejected'],
  rejected: [],
  approved: [],
};

async function getAll(req, res) {
  try {
    const result = await pool.query(
      `SELECT cp.*, p.name AS project_name, ml.layer_name
       FROM concrete_pours cp
       JOIN projects p ON p.id = cp.project_id AND p.company_id = cp.company_id
       LEFT JOIN map_layers ml ON ml.id = cp.map_layer_id AND ml.company_id = cp.company_id
       WHERE cp.company_id = $1
       ORDER BY cp.created_at DESC`,
      [req.user.company_id]
    );
    return res.json({ ok: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Erro ao listar concretagens', error: error.message });
  }
}

async function create(req, res) {
  try {
    const {
      project_id,
      map_layer_id,
      element_guid,
      element_name,
      concrete_class,
      volume_m3,
      planned_at,
      responsible,
      notes = '',
    } = req.body;

    if (!project_id || !element_name || !Number.isFinite(Number(volume_m3)) || Number(volume_m3) <= 0) {
      return res.status(400).json({ ok: false, message: 'Obra, elemento e volume positivo são obrigatórios.' });
    }

    const project = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND company_id = $2',
      [project_id, req.user.company_id]
    );
    if (!project.rowCount) {
      return res.status(404).json({ ok: false, message: 'Obra não encontrada nesta empresa.' });
    }

    if (map_layer_id) {
      const layer = await pool.query(
        'SELECT id FROM map_layers WHERE id = $1 AND project_id = $2 AND company_id = $3',
        [map_layer_id, project_id, req.user.company_id]
      );
      if (!layer.rowCount) {
        return res.status(404).json({ ok: false, message: 'Camada não encontrada nesta obra.' });
      }
    }

    const result = await pool.query(
      `INSERT INTO concrete_pours
         (company_id, project_id, map_layer_id, element_guid, element_name, concrete_class,
          volume_m3, planned_at, responsible, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        req.user.company_id,
        project_id,
        map_layer_id || null,
        element_guid || null,
        element_name.trim(),
        concrete_class || null,
        Number(volume_m3),
        planned_at || null,
        responsible || null,
        notes,
        req.user.sub || req.user.id,
      ]
    );
    return res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Erro ao registrar concretagem', error: error.message });
  }
}

async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, inspector, inspection_checklist, notes } = req.body;
    const currentResult = await pool.query(
      'SELECT * FROM concrete_pours WHERE id = $1 AND company_id = $2',
      [id, req.user.company_id]
    );

    if (!currentResult.rowCount) {
      return res.status(404).json({ ok: false, message: 'Registro de concretagem não encontrado.' });
    }

    const current = currentResult.rows[0];
    if (!transitions[current.status]?.includes(status)) {
      return res.status(409).json({ ok: false, message: `Transição inválida: ${current.status} para ${status}.` });
    }

    const checklist = inspection_checklist || current.inspection_checklist;
    if (status === 'approved') {
      const checklistIsValid = checklist && typeof checklist === 'object'
        && !Array.isArray(checklist)
        && checklistKeys.every((key) => typeof checklist[key] === 'boolean');
      const complete = checklistIsValid && checklistKeys.every((key) => checklist[key] === true);
      if (!inspector?.trim() || !complete) {
        return res.status(400).json({ ok: false, message: 'A aprovação exige inspetor e checklist FVS completo.' });
      }
    }
    if (status === 'rejected' && (!inspector?.trim() || !notes?.trim())) {
      return res.status(400).json({ ok: false, message: 'A reprovação exige inspetor e justificativa.' });
    }

    const result = await pool.query(
      `UPDATE concrete_pours
       SET status = $1,
           inspector = COALESCE($2, inspector),
           inspection_checklist = COALESCE($3::jsonb, inspection_checklist),
           notes = COALESCE($4, notes),
           poured_at = CASE WHEN $1 = 'awaiting_inspection' THEN COALESCE(poured_at, NOW()) ELSE poured_at END,
           inspected_at = CASE WHEN $1 IN ('approved', 'rejected') THEN NOW() ELSE inspected_at END,
           updated_at = NOW()
       WHERE id = $5 AND company_id = $6 AND status = $7
       RETURNING *`,
      [
        status,
        inspector?.trim() || null,
        inspection_checklist ? JSON.stringify(checklist) : null,
        notes ?? null,
        id,
        req.user.company_id,
        current.status,
      ]
    );

    if (!result.rowCount) {
      return res.status(409).json({ ok: false, message: 'O registro foi atualizado por outra pessoa. Recarregue e tente novamente.' });
    }
    return res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Erro ao atualizar concretagem', error: error.message });
  }
}

module.exports = { getAll, create, updateStatus };