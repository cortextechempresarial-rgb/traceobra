CREATE TABLE IF NOT EXISTS public.subdivisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  name VARCHAR(255) NOT NULL,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  zoom INTEGER NOT NULL DEFAULT 16,
  polygon JSONB NOT NULL DEFAULT '[]'::jsonb,
  address JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS subdivision_id UUID REFERENCES public.subdivisions(id);

CREATE INDEX IF NOT EXISTS projects_subdivision_idx
  ON public.projects (company_id, subdivision_id);

ALTER TABLE public.subdivisions ENABLE ROW LEVEL SECURITY;

INSERT INTO public.subdivisions
  (id, company_id, name, latitude, longitude, zoom, polygon, address, metadata, created_at)
SELECT
  id,
  company_id,
  layer_name,
  latitude,
  longitude,
  COALESCE(zoom, 16),
  COALESCE(polygon, '[]'::jsonb),
  COALESCE(metadata->'address', '{}'::jsonb),
  metadata,
  COALESCE(created_at, NOW())
FROM public.map_layers
WHERE metadata->>'subdivision' = 'true'
ON CONFLICT (id) DO NOTHING;

UPDATE public.projects AS project
SET subdivision_id = (
  SELECT layer.id
  FROM public.map_layers AS layer
  WHERE layer.project_id = project.id
    AND layer.company_id = project.company_id
    AND layer.metadata->>'subdivision' = 'true'
  ORDER BY layer.created_at, layer.id
  LIMIT 1
)
WHERE project.subdivision_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.map_layers AS layer
    WHERE layer.project_id = project.id
      AND layer.company_id = project.company_id
      AND layer.metadata->>'subdivision' = 'true'
  );

DELETE FROM public.map_layers
WHERE metadata->>'subdivision' = 'true';
