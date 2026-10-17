ALTER TABLE public.subdivisions
  ADD COLUMN IF NOT EXISTS plan_bounds JSONB,
  ADD COLUMN IF NOT EXISTS plan_page INTEGER NOT NULL DEFAULT 1
    CHECK (plan_page > 0);
