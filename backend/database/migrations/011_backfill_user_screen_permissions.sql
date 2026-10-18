UPDATE public.users
SET screen_permissions = '[
  "dashboard",
  "clients",
  "projects",
  "subdivisions",
  "tasks",
  "schedule",
  "materials",
  "suppliers",
  "maps",
  "concrete",
  "finance"
]'::jsonb
WHERE role NOT IN ('admin', 'super_admin')
  AND screen_permissions = '[]'::jsonb;
