ALTER TABLE public.users
  ADD CONSTRAINT users_company_role_consistency
  CHECK (
    (role = 'super_admin' AND company_id IS NULL)
    OR (role <> 'super_admin' AND company_id IS NOT NULL)
  ) NOT VALID;
