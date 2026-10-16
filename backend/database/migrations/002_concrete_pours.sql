CREATE TABLE IF NOT EXISTS concrete_pours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  map_layer_id UUID REFERENCES map_layers(id) ON DELETE SET NULL,
  element_guid VARCHAR(255),
  element_name VARCHAR(255) NOT NULL,
  concrete_class VARCHAR(80),
  volume_m3 NUMERIC(12,3) NOT NULL CHECK (volume_m3 > 0),
  planned_at TIMESTAMPTZ,
  poured_at TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'pouring', 'awaiting_inspection', 'approved', 'rejected')),
  responsible VARCHAR(255),
  inspector VARCHAR(255),
  inspected_at TIMESTAMPTZ,
  inspection_checklist JSONB NOT NULL DEFAULT '{"forms_clean":false,"reinforcement_checked":false,"cover_checked":false,"slump_test_recorded":false,"samples_taken":false,"release_authorized":false}'::jsonb,
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS concrete_pours_company_project_created_idx
  ON concrete_pours (company_id, project_id, created_at DESC);