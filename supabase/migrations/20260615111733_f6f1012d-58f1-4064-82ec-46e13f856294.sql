
-- 1. Tighten storage.objects SELECT for client-files: must have access to the client
DROP POLICY IF EXISTS client_files_storage_select ON storage.objects;
CREATE POLICY client_files_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-files'
    AND EXISTS (
      SELECT 1
      FROM public.client_files cf
      JOIN public.clients c ON c.id = cf.client_id
      WHERE cf.storage_path = storage.objects.name
        AND public.can_access_client(c.responsible_user_id, c.created_by)
    )
  );

-- Also tighten update/delete on storage.objects to mirror access scope
DROP POLICY IF EXISTS client_files_storage_delete ON storage.objects;
CREATE POLICY client_files_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-files'
    AND (
      public.has_role(auth.uid(), 'master')
      OR EXISTS (
        SELECT 1
        FROM public.client_files cf
        JOIN public.clients c ON c.id = cf.client_id
        WHERE cf.storage_path = storage.objects.name
          AND public.can_access_client(c.responsible_user_id, c.created_by)
          AND (cf.uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'advogado'))
      )
    )
  );

DROP POLICY IF EXISTS client_files_storage_update ON storage.objects;
CREATE POLICY client_files_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'client-files'
    AND (
      public.has_role(auth.uid(), 'master')
      OR EXISTS (
        SELECT 1
        FROM public.client_files cf
        JOIN public.clients c ON c.id = cf.client_id
        WHERE cf.storage_path = storage.objects.name
          AND public.can_access_client(c.responsible_user_id, c.created_by)
          AND (cf.uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'advogado'))
      )
    )
  );

-- 2. Audit log: remove direct insert capability. Triggers run as SECURITY DEFINER
-- and bypass RLS, so legitimate audit writes still succeed.
DROP POLICY IF EXISTS audit_insert_any ON public.audit_log;

-- 3. Appointments SELECT: require an assigned role before any branch.
DROP POLICY IF EXISTS appointments_select ON public.appointments;
CREATE POLICY appointments_select ON public.appointments
  FOR SELECT TO authenticated
  USING (
    public.get_user_role(auth.uid()) IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'master')
      OR created_by = auth.uid()
      OR assigned_to = auth.uid()
      OR (
        (public.has_role(auth.uid(), 'assistente') OR public.has_role(auth.uid(), 'visualizador'))
        AND (
          assigned_to = public.get_supervisor(auth.uid())
          OR created_by = public.get_supervisor(auth.uid())
          OR (
            client_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.clients c
              WHERE c.id = appointments.client_id
                AND c.responsible_user_id = public.get_supervisor(auth.uid())
            )
          )
        )
      )
      OR (
        client_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = appointments.client_id
            AND public.can_access_client(c.responsible_user_id, c.created_by)
        )
      )
    )
  );
