
-- Tighten SELECT policies to role-based access

-- clients: only users with a role can read
DROP POLICY IF EXISTS clients_select ON public.clients;
CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'master')
  OR public.has_role(auth.uid(), 'advogado')
  OR public.has_role(auth.uid(), 'assistente')
  OR public.has_role(auth.uid(), 'visualizador')
);

-- client_notes: same
DROP POLICY IF EXISTS notes_select ON public.client_notes;
CREATE POLICY notes_select ON public.client_notes FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'master')
  OR public.has_role(auth.uid(), 'advogado')
  OR public.has_role(auth.uid(), 'assistente')
  OR public.has_role(auth.uid(), 'visualizador')
);

-- client_files: same
DROP POLICY IF EXISTS files_select ON public.client_files;
CREATE POLICY files_select ON public.client_files FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'master')
  OR public.has_role(auth.uid(), 'advogado')
  OR public.has_role(auth.uid(), 'assistente')
  OR public.has_role(auth.uid(), 'visualizador')
);

-- profiles: own profile, or master can see all
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_self_or_master ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR public.has_role(auth.uid(), 'master'));

-- user_roles: own, or master sees all
DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
CREATE POLICY user_roles_select_self_or_master ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'master'));

-- Storage bucket: require an active role to download
DROP POLICY IF EXISTS client_files_storage_select ON storage.objects;
CREATE POLICY client_files_storage_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'client-files' AND (
    public.has_role(auth.uid(), 'master')
    OR public.has_role(auth.uid(), 'advogado')
    OR public.has_role(auth.uid(), 'assistente')
    OR public.has_role(auth.uid(), 'visualizador')
  )
);

-- Revoke EXECUTE on trigger-only SECURITY DEFINER functions (not used by clients directly)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, PUBLIC;

-- Revoke EXECUTE on role-helper SECURITY DEFINER functions from anon (only RLS needs them, runs as authenticated)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_write_clients(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_upload_files(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, PUBLIC;
