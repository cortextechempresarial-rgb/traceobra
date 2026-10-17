const { pool } = require('../config/db');
const { supabase } = require('../config/supabase');
const { randomUUID } = require('crypto');

const planBucket = process.env.SUPABASE_PLANS_BUCKET || 'traceobra-plans';

function normalizeMetadata(metadata = {}) {
  return {
    status: metadata.status || 'ativo',
    phase: metadata.phase || 'implantacao',
    responsible: metadata.responsible || 'Engenharia',
    standard: metadata.standard || 'NBR 5410 / ABNT',
    discipline: metadata.discipline || 'Civil',
    area_m2: metadata.area_m2 || 0,
    notes: metadata.notes || '',
    terrain: metadata.terrain || 'terreno',
    ...metadata,
  };
}

async function getAll(req, res) {
  try {
    const result = await pool.query(`
      SELECT m.*, p.name AS project_name
      FROM map_layers m
      LEFT JOIN projects p ON p.id = m.project_id AND p.company_id = m.company_id
      WHERE m.company_id = $1
        AND COALESCE(m.metadata->>'subdivision', 'false') <> 'true'
      ORDER BY m.created_at DESC
    `, [req.user.company_id]);

    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Erro ao listar mapas', error: error.message });
  }
}

async function getSubdivisions(req, res) {
  try {
    const result = await pool.query(`
      SELECT *
      FROM subdivisions
      WHERE company_id = $1
      ORDER BY created_at DESC
    `, [req.user.company_id]);
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Erro ao listar loteamentos', error: error.message });
  }
}

async function getSubdivisionPlan(req, res) {
  try {
    const result = await pool.query(
      `SELECT metadata->'plan_document' AS plan_document
       FROM subdivisions
       WHERE id = $1 AND company_id = $2`,
      [req.params.id, req.user.company_id]
    );
    if (!result.rowCount) {
      return res.status(404).json({ ok: false, message: 'Loteamento não encontrado nesta empresa.' });
    }
    const planDocument = result.rows[0].plan_document;
    if (!planDocument?.bucket || !planDocument?.path) {
      return res.status(404).json({ ok: false, message: 'Este loteamento ainda não tem uma planta PDF cadastrada.' });
    }

    const storedFile = await supabase.storage.from(planDocument.bucket).download(planDocument.path);
    if (storedFile.error) throw storedFile.error;
    const fileBuffer = Buffer.from(await storedFile.data.arrayBuffer());
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(fileBuffer.length),
      'Content-Disposition': `inline; filename="planta-${req.params.id}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.status(200).send(fileBuffer);
  } catch (error) {
    console.error('Falha ao carregar planta do loteamento:', error.code || error.message);
    return res.status(500).json({ ok: false, message: 'Não foi possível carregar o PDF privado do loteamento.' });
  }
}

async function updateSubdivisionPlanLayout(req, res) {
  const { plan_bounds: bounds, plan_page: page } = req.body;
  const values = bounds
    ? [bounds.south, bounds.west, bounds.north, bounds.east].map(Number)
    : null;
  const [south, west, north, east] = values || [];
  const parsedPage = Number(page);
  if ((values && (values.some((value) => !Number.isFinite(value))
    || south < -90 || north > 90 || west < -180 || east > 180
    || south >= north || west >= east))
    || !Number.isInteger(parsedPage) || parsedPage < 1) {
    return res.status(400).json({ ok: false, message: 'Informe limites geográficos válidos e uma página PDF existente.' });
  }

  try {
    const result = await pool.query(
      `UPDATE subdivisions
       SET plan_bounds = COALESCE($1::jsonb, plan_bounds), plan_page = $2
       WHERE id = $3 AND company_id = $4 AND metadata ? 'plan_document'
       RETURNING *`,
      [values ? JSON.stringify({ south, west, north, east }) : null, parsedPage, req.params.id, req.user.company_id]
    );
    if (!result.rowCount) {
      return res.status(404).json({ ok: false, message: 'Loteamento com planta não encontrado nesta empresa.' });
    }
    return res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    console.error('Falha ao salvar posicionamento da planta:', error.code || error.message);
    return res.status(500).json({ ok: false, message: 'Não foi possível salvar o posicionamento geográfico da planta.' });
  }
}

async function updateSubdivisionLocation(req, res) {
  const { latitude, longitude, zoom } = req.body;
  if (latitude === '' || longitude === '' || latitude == null || longitude == null) {
    return res.status(400).json({ ok: false, message: 'Informe coordenadas válidas para o loteamento.' });
  }
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)
    || Math.abs(parsedLatitude) > 90 || Math.abs(parsedLongitude) > 180) {
    return res.status(400).json({ ok: false, message: 'Informe coordenadas válidas para o loteamento.' });
  }

  try {
    const result = await pool.query(
      `UPDATE subdivisions
       SET latitude = $1, longitude = $2, zoom = COALESCE($3, zoom)
       WHERE id = $4 AND company_id = $5
       RETURNING *`,
      [parsedLatitude, parsedLongitude, Number.isInteger(Number(zoom)) ? Number(zoom) : null, req.params.id, req.user.company_id]
    );
    if (!result.rowCount) {
      return res.status(404).json({ ok: false, message: 'Loteamento não encontrado nesta empresa.' });
    }
    res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Erro ao atualizar a localização do loteamento', error: error.message });
  }
}

async function create(req, res) {
  try {
    const {
      layer_name,
      map_type = '2d',
      latitude,
      longitude,
      zoom,
      altitude,
      rotation,
      polygon,
      metadata,
    } = req.body;

    const { project_id } = req.body;
    if (!project_id || !layer_name) {
      return res.status(400).json({ ok: false, message: 'project_id e layer_name são obrigatórios' });
    }

    const project = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND company_id = $2',
      [project_id, req.user.company_id]
    );
    if (!project.rowCount) {
      return res.status(404).json({ ok: false, message: 'Obra não encontrada nesta empresa' });
    }

    const result = await pool.query(
      `INSERT INTO map_layers (company_id, project_id, layer_name, map_type, latitude, longitude, zoom, altitude, rotation, polygon, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        req.user.company_id,
        project_id,
        layer_name,
        map_type,
        latitude ?? null,
        longitude ?? null,
        zoom ?? 14,
        altitude ?? 0,
        rotation ?? 0,
        polygon ? JSON.stringify(polygon) : '[]',
        JSON.stringify(normalizeMetadata(metadata)),
      ]
    );

    res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Erro ao criar camada de mapa', error: error.message });
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const {
      layer_name,
      map_type,
      latitude,
      longitude,
      zoom,
      altitude,
      rotation,
      polygon,
      metadata,
    } = req.body;

    const result = await pool.query(
      `UPDATE map_layers
       SET layer_name = COALESCE($1, layer_name),
           map_type = COALESCE($2, map_type),
           latitude = COALESCE($3, latitude),
           longitude = COALESCE($4, longitude),
           zoom = COALESCE($5, zoom),
           altitude = COALESCE($6, altitude),
           rotation = COALESCE($7, rotation),
           polygon = COALESCE($8::jsonb, polygon),
           metadata = COALESCE($9::jsonb, metadata)
      WHERE id = $10 AND company_id = $11
       RETURNING *`,
      [
        layer_name || null,
        map_type || null,
        latitude ?? null,
        longitude ?? null,
        zoom ?? null,
        altitude ?? null,
        rotation ?? null,
        polygon ? JSON.stringify(polygon) : null,
        metadata ? JSON.stringify(normalizeMetadata(metadata)) : null,
        id,
        req.user.company_id,
      ]
    );

    if (!result.rowCount) {
      return res.status(404).json({ ok: false, message: 'Camada não encontrada' });
    }

    res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Erro ao atualizar mapa', error: error.message });
  }
}

async function createSubdivision(req, res) {
  let uploadedPath;
  let operation = 'validar cadastro';
  try {
    const {
      name,
      cep = '',
      street = '',
      neighborhood = '',
      city = '',
      state = '',
      latitude,
      longitude,
    } = req.body;
    const file = req.file;

    if (typeof name !== 'string' || !name.trim() || !file) {
      return res.status(400).json({ ok: false, message: 'Nome do loteamento e PDF são obrigatórios.' });
    }

    const normalizedCep = String(cep).replace(/\D/g, '');
    const parsedLatitude = latitude === '' || latitude == null ? null : Number(latitude);
    const parsedLongitude = longitude === '' || longitude == null ? null : Number(longitude);
    const hasCoordinates = Number.isFinite(parsedLatitude) && Number.isFinite(parsedLongitude)
      && Math.abs(parsedLatitude) <= 90 && Math.abs(parsedLongitude) <= 180;

    if (!hasCoordinates) {
      return res.status(400).json({ ok: false, message: 'Latitude ou longitude inválida.' });
    }
    if (normalizedCep && normalizedCep.length !== 8) {
      return res.status(400).json({ ok: false, message: 'CEP inválido. Informe 8 dígitos.' });
    }

    operation = 'verificar armazenamento da planta';
    const existingBucket = await supabase.storage.getBucket(planBucket);
    if (existingBucket.error) {
      const missingBucket = String(existingBucket.error.statusCode) === '404'
        || /bucket not found/i.test(existingBucket.error.message || '');
      if (!missingBucket) throw existingBucket.error;

      const createdBucket = await supabase.storage.createBucket(planBucket, {
        public: false,
        fileSizeLimit: '20MB',
        allowedMimeTypes: ['application/pdf'],
      });
      if (createdBucket.error && !/already exists/i.test(createdBucket.error.message)) {
        throw createdBucket.error;
      }
    }

    uploadedPath = `${req.user.company_id}/subdivisions/${randomUUID()}.pdf`;
    operation = 'enviar planta para o armazenamento';
    const storedFile = await supabase.storage.from(planBucket).upload(uploadedPath, file.buffer, {
      contentType: 'application/pdf',
      upsert: false,
    });
    if (storedFile.error) throw storedFile.error;

    operation = 'gravar loteamento no banco';
    const metadata = normalizeMetadata({
      status: 'disponível',
      phase: 'implantação',
      layer_group: 'terreno',
      source: 'PDF + localização',
      subdivision: true,
      location_source: 'coordinates',
      address: {
        cep: normalizedCep || null,
        street: street.trim() || null,
        neighborhood: neighborhood.trim() || null,
        city: city.trim() || null,
        state: state.trim().toUpperCase() || null,
      },
      plan_document: {
        bucket: planBucket,
        path: uploadedPath,
        name: file.originalname,
        size: file.size,
        content_type: 'application/pdf',
      },
    });

    const result = await pool.query(
      `INSERT INTO subdivisions
         (company_id, name, latitude, longitude, zoom, polygon, address, metadata)
       VALUES ($1, $2, $3, $4, 16, '[]'::jsonb, $5::jsonb, $6::jsonb)
       RETURNING *`,
      [
        req.user.company_id,
        name.trim(),
        parsedLatitude,
        parsedLongitude,
        JSON.stringify({
          cep: normalizedCep || null,
          street: street.trim() || null,
          neighborhood: neighborhood.trim() || null,
          city: city.trim() || null,
          state: state.trim().toUpperCase() || null,
        }),
        JSON.stringify(metadata),
      ]
    );

    return res.status(201).json({
      ok: true,
      data: result.rows[0],
    });
  } catch (error) {
    if (uploadedPath) {
      await supabase.storage.from(planBucket).remove([uploadedPath]).catch(() => {});
    }
    console.error(`Falha ao ${operation}:`, error.code || error.message);

    const clientMessage = operation === 'verificar armazenamento da planta'
      ? 'Não foi possível acessar o armazenamento da planta. Confira as credenciais e as permissões do Supabase Storage.'
      : operation === 'enviar planta para o armazenamento'
        ? 'Não foi possível enviar o PDF. Confira as permissões do Supabase Storage e tente novamente.'
        : operation === 'gravar loteamento no banco'
          ? 'A planta foi enviada, mas o loteamento não foi gravado no banco. Confira se as migrations foram aplicadas e tente novamente.'
          : 'Não foi possível cadastrar o loteamento.';
    const message = process.env.NODE_ENV === 'production'
      ? clientMessage
      : `${clientMessage} (${error.code || error.message})`;
    return res.status(500).json({ ok: false, message });
  }
}

module.exports = {
  getAll,
  getSubdivisions,
  getSubdivisionPlan,
  updateSubdivisionPlanLayout,
  updateSubdivisionLocation,
  create,
  update,
  createSubdivision,
};
