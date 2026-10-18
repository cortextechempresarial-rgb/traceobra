ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

ALTER TABLE public.users
  ADD CONSTRAINT users_status_valid
  CHECK (status IN ('active', 'inactive')) NOT VALID;
