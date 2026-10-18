ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS screen_permissions JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.users
  ADD CONSTRAINT users_screen_permissions_array
  CHECK (jsonb_typeof(screen_permissions) = 'array') NOT VALID;
