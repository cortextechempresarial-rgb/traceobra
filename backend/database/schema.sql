CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  cnpj VARCHAR(18),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT,
  role VARCHAR(100) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  method VARCHAR(10) NOT NULL,
  resource TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_company_created_idx
  ON audit_logs (company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subdivisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  zoom INTEGER NOT NULL DEFAULT 16,
  polygon JSONB NOT NULL DEFAULT '[]'::jsonb,
  address JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  subdivision_id UUID REFERENCES subdivisions(id),
  name VARCHAR(255) NOT NULL,
  client_id UUID REFERENCES clients(id),
  status VARCHAR(80) DEFAULT 'planning',
  progress INT DEFAULT 0,
  budget NUMERIC(12,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS projects_subdivision_idx
  ON projects (company_id, subdivision_id);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(80) DEFAULT 'pending',
  priority VARCHAR(50) DEFAULT 'medium',
  assignee_id UUID REFERENCES users(id),
  due_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  stock NUMERIC(12,3) DEFAULT 0,
  unit_price NUMERIC(12,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activity_type VARCHAR(20) NOT NULL CHECK (activity_type IN ('creation', 'change')),
  description TEXT NOT NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_material_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES project_activities(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  material_name VARCHAR(255) NOT NULL,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_activities_company_project_created_idx
  ON project_activities (company_id, project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS project_material_usage_activity_idx
  ON project_material_usage (activity_id);

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  contact VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  type VARCHAR(50) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  entry_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  title VARCHAR(255) NOT NULL,
  type VARCHAR(100) DEFAULT 'summary',
  content JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS map_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  project_id UUID REFERENCES projects(id),
  layer_name VARCHAR(255) NOT NULL,
  map_type VARCHAR(20) NOT NULL DEFAULT '2d' CHECK (map_type IN ('2d', '3d')),
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  zoom INTEGER DEFAULT 14,
  altitude NUMERIC(12,2) DEFAULT 0,
  rotation INTEGER DEFAULT 0,
  polygon JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  title VARCHAR(255) NOT NULL,
  phase VARCHAR(80) DEFAULT 'implantação',
  status VARCHAR(80) DEFAULT 'planejado',
  progress INT DEFAULT 0,
  start_date DATE,
  end_date DATE,
  owner VARCHAR(255) DEFAULT 'Equipe',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

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

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_material_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subdivisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concrete_pours ENABLE ROW LEVEL SECURITY;

INSERT INTO companies (id, name, cnpj, status) VALUES
  ('11111111-1111-4111-8111-111111111111', 'TraceObra Demo', '12.345.678/0001-90', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (company_id, name, email, role) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Administrador', 'admin@traceobra.com', 'admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO clients (id, company_id, name, email, phone, status) VALUES
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Construtora Alpha', 'contato@alpha.com', '(11) 99999-0000', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO subdivisions (id, company_id, name, latitude, longitude, zoom, address, metadata) VALUES
  ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'Jardim das Palmeiras', -23.550520, -46.633308, 16, '{"city":"São Paulo","state":"SP"}'::jsonb, '{"source":"demo"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, company_id, subdivision_id, name, client_id, status, progress, budget, start_date, end_date) VALUES
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444', 'Residencial Jardim', '22222222-2222-4222-8222-222222222222', 'construction', 58, 185000.00, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '120 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO map_layers (company_id, project_id, layer_name, map_type, latitude, longitude, zoom, altitude, rotation, polygon, metadata)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    'Mapa 2D - Lote principal',
    '2d',
    -23.550520,
    -46.633308,
    16,
    0,
    0,
    '[{"lat":-23.550310,"lng":-46.633710},{"lat":-23.551180,"lng":-46.632960},{"lat":-23.551840,"lng":-46.634600},{"lat":-23.550960,"lng":-46.635640}]'::jsonb,
    '{"terrain":"lot","status":"live"}'::jsonb
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    'Mapa 3D - Estrutura',
    '3d',
    -23.550520,
    -46.633308,
    14,
    42,
    32,
    '[{"lat":-23.550310,"lng":-46.633710,"alt":12},{"lat":-23.551180,"lng":-46.632960,"alt":18},{"lat":-23.551840,"lng":-46.634600,"alt":24},{"lat":-23.550960,"lng":-46.635640,"alt":16}]'::jsonb,
    '{"terrain":"building","status":"pilot"}'::jsonb
  );

INSERT INTO project_schedule (project_id, title, phase, status, progress, start_date, end_date, owner, notes)
VALUES
  (
    '33333333-3333-4333-8333-333333333333',
    'Fundação e terraplenagem',
    'implantação',
    'em andamento',
    68,
    CURRENT_DATE - INTERVAL '15 days',
    CURRENT_DATE + INTERVAL '12 days',
    'Engenharia',
    'Execução da base do empreendimento e preparação do terreno.'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'Estrutura em concreto',
    'estrutura',
    'planejado',
    25,
    CURRENT_DATE + INTERVAL '10 days',
    CURRENT_DATE + INTERVAL '35 days',
    'Coordenação civil',
    'Planejamento de pilares, vigas e lajes.'
  );
