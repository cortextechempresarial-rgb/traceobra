const { pool } = require('../config/db');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateActivity(description, materials) {
  if (typeof description !== 'string' || !description.trim()) {
    return 'Descreva o serviço executado e os materiais utilizados.';
  }
  if (!Array.isArray(materials) || !materials.length) {
    return 'Informe pelo menos um material utilizado e sua quantidade.';
  }
  if (materials.some((item) => !item || !uuidPattern.test(item.material_id || '')
    || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0
    || Math.abs(Number(item.quantity) * 1000 - Math.round(Number(item.quantity) * 1000)) > 0.000001)) {
    return 'Selecione materiais válidos e informe quantidades maiores que zero.';
  }
  return null;
}

async function recordActivity(client, { companyId, projectId, userId, type, description, materials }) {
  const materialIds = [...new Set(materials.map((item) => item.material_id))];
  const result = await client.query(
    `SELECT id, name, stock, unit, unit_price
     FROM materials
     WHERE company_id = $1 AND id = ANY($2::uuid[])
     ORDER BY id
     FOR UPDATE`,
    [companyId, materialIds]
  );
  if (result.rowCount !== materialIds.length) {
    const error = new Error('Um ou mais materiais não foram encontrados no estoque desta empresa.');
    error.statusCode = 400;
    throw error;
  }

  const materialById = new Map(result.rows.map((material) => [material.id, material]));
  const totals = new Map();
  for (const item of materials) {
    totals.set(item.material_id, (totals.get(item.material_id) || 0) + Number(item.quantity));
  }
  for (const [materialId, quantity] of totals) {
    if (Number(materialById.get(materialId).stock) < quantity) {
      const error = new Error(`Estoque insuficiente para ${materialById.get(materialId).name}.`);
      error.statusCode = 409;
      throw error;
    }
  }

  const activity = await client.query(
    `INSERT INTO project_activities (company_id, project_id, activity_type, description, actor_user_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [companyId, projectId, type, description.trim(), userId || null]
  );
  const activityId = activity.rows[0].id;

  for (const [materialId, quantity] of totals) {
    await client.query(
      'UPDATE materials SET stock = stock - $1, updated_at = NOW() WHERE id = $2 AND company_id = $3',
      [quantity, materialId, companyId]
    );
  }

  for (const item of materials) {
    const material = materialById.get(item.material_id);
    await client.query(
      `INSERT INTO project_material_usage
         (company_id, project_id, activity_id, material_id, material_name, unit, quantity, unit_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [companyId, projectId, activityId, material.id, material.name, material.unit || 'un.', Number(item.quantity), Number(material.unit_price) || 0]
    );
  }
  return activity.rows[0];
}

async function getAll(req, res) {
  try {
    const result = await pool.query(`
      SELECT p.*, c.name AS client_name, s.name AS subdivision_name
      FROM projects p
      LEFT JOIN clients c ON c.id = p.client_id
      LEFT JOIN subdivisions s ON s.id = p.subdivision_id
      WHERE p.company_id = $1
      ORDER BY p.created_at DESC
    `, [req.user.company_id]);
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Erro ao listar obras. Confirme se as migrations do banco foram aplicadas.', error: error.message });
  }
}

async function getActivities(req, res) {
  if (!uuidPattern.test(req.params.id)) {
    return res.status(400).json({ ok: false, message: 'Obra inválida.' });
  }
  try {
    const project = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );
    if (!project.rowCount) {
      return res.status(404).json({ ok: false, message: 'Obra não encontrada nesta empresa.' });
    }

    const result = await pool.query(`
      SELECT activity.id, activity.activity_type, activity.description, activity.created_at,
             COALESCE(
               json_agg(json_build_object(
                 'material_id', usage.material_id,
                 'material_name', usage.material_name,
                 'unit', usage.unit,
                 'quantity', usage.quantity,
                 'unit_price', usage.unit_price
               )) FILTER (WHERE usage.id IS NOT NULL),
               '[]'::json
             ) AS materials
      FROM project_activities activity
      LEFT JOIN project_material_usage usage ON usage.activity_id = activity.id
      WHERE activity.company_id = $1 AND activity.project_id = $2
      GROUP BY activity.id
      ORDER BY activity.created_at DESC
    `, [req.user.company_id, req.params.id]);
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Erro ao carregar o histórico de materiais da obra.', error: error.message });
  }
}

async function create(req, res) {
  const {
    name,
    client_id,
    subdivision_id,
    status = 'planning',
    progress = 0,
    budget = 0,
    start_date,
    end_date,
    activity_description,
    materials_used,
  } = req.body;
  const activityError = validateActivity(activity_description, materials_used);
  if (activityError) {
    return res.status(400).json({ ok: false, message: activityError });
  }

  const parsedProgress = Number(progress);
  const parsedBudget = Number(budget);
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ ok: false, message: 'Nome da obra é obrigatório.' });
  }
  if (!Number.isInteger(parsedProgress) || parsedProgress < 0 || parsedProgress > 100) {
    return res.status(400).json({ ok: false, message: 'O progresso deve ser um número inteiro entre 0 e 100.' });
  }
  if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
    return res.status(400).json({ ok: false, message: 'O orçamento deve ser igual ou maior que zero.' });
  }
  if (!uuidPattern.test(subdivision_id || '')) {
    return res.status(400).json({ ok: false, message: 'Selecione o loteamento onde a obra será executada.' });
  }
  if (client_id && !uuidPattern.test(client_id)) {
    return res.status(400).json({ ok: false, message: 'Selecione um cliente válido da lista.' });
  }

  let client;
  let transactionOpen = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    transactionOpen = true;
    const subdivision = await client.query(
      'SELECT id FROM subdivisions WHERE id = $1 AND company_id = $2',
      [subdivision_id, req.user.company_id]
    );
    if (!subdivision.rowCount) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(404).json({ ok: false, message: 'Loteamento não encontrado nesta empresa.' });
    }
    if (client_id) {
      const customer = await client.query(
        'SELECT id FROM clients WHERE id = $1 AND company_id = $2',
        [client_id, req.user.company_id]
      );
      if (!customer.rowCount) {
        await client.query('ROLLBACK');
        transactionOpen = false;
        return res.status(404).json({ ok: false, message: 'Cliente não encontrado nesta empresa.' });
      }
    }

    const result = await client.query(
      `INSERT INTO projects (company_id, subdivision_id, name, client_id, status, progress, budget, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.user.company_id, subdivision_id, name.trim(), client_id || null, status, parsedProgress, parsedBudget, start_date || null, end_date || null]
    );
    const project = result.rows[0];
    const activity = await recordActivity(client, {
      companyId: req.user.company_id,
      projectId: project.id,
      userId: req.user.sub || req.user.id,
      type: 'creation',
      description: activity_description,
      materials: materials_used,
    });
    await client.query('COMMIT');
    transactionOpen = false;
    res.status(201).json({ ok: true, data: { ...project, activity } });
  } catch (error) {
    if (client && transactionOpen) await client.query('ROLLBACK');
    const status = error.statusCode || (['22P02', '23503', '23514'].includes(error.code) ? 400 : 500);
    res.status(status).json({
      ok: false,
      message: error.statusCode ? error.message : status === 400
        ? 'Confira os dados da obra e os materiais informados.'
        : 'Erro ao criar obra e registrar os materiais utilizados.',
      error: error.message,
    });
  } finally {
    client?.release();
  }
}

async function update(req, res) {
  const { id } = req.params;
  const {
    name,
    client_id,
    subdivision_id,
    status,
    progress,
    budget,
    activity_description,
    materials_used,
  } = req.body;
  const activityError = validateActivity(activity_description, materials_used);
  if (activityError) {
    return res.status(400).json({ ok: false, message: activityError });
  }
  if (!uuidPattern.test(id)) {
    return res.status(400).json({ ok: false, message: 'Obra inválida.' });
  }
  if (!uuidPattern.test(subdivision_id || '')) {
    return res.status(400).json({ ok: false, message: 'Selecione o loteamento da obra.' });
  }
  const parsedProgress = Number(progress);
  const parsedBudget = Number(budget);
  if (typeof name !== 'string' || !name.trim()
    || !Number.isInteger(parsedProgress) || parsedProgress < 0 || parsedProgress > 100
    || !Number.isFinite(parsedBudget) || parsedBudget < 0) {
    return res.status(400).json({ ok: false, message: 'Confira nome, progresso e orçamento da obra.' });
  }
  if (client_id && !uuidPattern.test(client_id)) {
    return res.status(400).json({ ok: false, message: 'Selecione um cliente válido da lista.' });
  }

  let client;
  let transactionOpen = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    transactionOpen = true;
    const project = await client.query(
      'SELECT id FROM projects WHERE id = $1 AND company_id = $2 FOR UPDATE',
      [id, req.user.company_id]
    );
    if (!project.rowCount) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(404).json({ ok: false, message: 'Obra não encontrada nesta empresa.' });
    }
    const subdivision = await client.query(
      'SELECT id FROM subdivisions WHERE id = $1 AND company_id = $2',
      [subdivision_id, req.user.company_id]
    );
    if (!subdivision.rowCount) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(404).json({ ok: false, message: 'Loteamento não encontrado nesta empresa.' });
    }
    if (client_id) {
      const customer = await client.query(
        'SELECT id FROM clients WHERE id = $1 AND company_id = $2',
        [client_id, req.user.company_id]
      );
      if (!customer.rowCount) {
        await client.query('ROLLBACK');
        transactionOpen = false;
        return res.status(404).json({ ok: false, message: 'Cliente não encontrado nesta empresa.' });
      }
    }

    const result = await client.query(
      `UPDATE projects
       SET name = $1, client_id = $2, subdivision_id = $3, status = $4, progress = $5, budget = $6
       WHERE id = $7 AND company_id = $8
       RETURNING *`,
      [name.trim(), client_id || null, subdivision_id, status, parsedProgress, parsedBudget, id, req.user.company_id]
    );
    const activity = await recordActivity(client, {
      companyId: req.user.company_id,
      projectId: id,
      userId: req.user.sub || req.user.id,
      type: 'change',
      description: activity_description,
      materials: materials_used,
    });
    await client.query('COMMIT');
    transactionOpen = false;
    res.json({ ok: true, data: { ...result.rows[0], activity } });
  } catch (error) {
    if (client && transactionOpen) await client.query('ROLLBACK');
    const status = error.statusCode || (['22P02', '23503', '23514'].includes(error.code) ? 400 : 500);
    res.status(status).json({
      ok: false,
      message: error.statusCode ? error.message : status === 400
        ? 'Confira os dados da obra e os materiais informados.'
        : 'Erro ao atualizar a obra e registrar os materiais utilizados.',
      error: error.message,
    });
  } finally {
    client?.release();
  }
}

module.exports = { getAll, getActivities, create, update };
