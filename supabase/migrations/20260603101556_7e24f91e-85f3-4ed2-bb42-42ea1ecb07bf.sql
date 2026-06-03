-- Add supervisor (advogado) link for assistentes/visualizadores
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_supervisor ON public.profiles(supervisor_id);

-- Helper: get supervisor for a user
CREATE OR REPLACE FUNCTION public.get_supervisor(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT supervisor_id FROM public.profiles WHERE id = _user_id $$;

-- Helper: can current user access a given client (responsible lawyer)?
CREATE OR REPLACE FUNCTION public.can_access_client(_responsible uuid, _created_by uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'master')
    OR _responsible = auth.uid()
    OR _created_by = auth.uid()
    OR (
      (public.has_role(auth.uid(), 'assistente') OR public.has_role(auth.uid(), 'visualizador'))
      AND _responsible IS NOT NULL
      AND public.get_supervisor(auth.uid()) = _responsible
    );
$$;

-- Replace clients RLS
DROP POLICY IF EXISTS clients_select ON public.clients;
DROP POLICY IF EXISTS clients_update ON public.clients;
DROP POLICY IF EXISTS clients_delete ON public.clients;

CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated
USING (public.can_access_client(responsible_user_id, created_by));

CREATE POLICY clients_update ON public.clients FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'master')
  OR responsible_user_id = auth.uid()
  OR created_by = auth.uid()
);

CREATE POLICY clients_delete ON public.clients FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'master') OR created_by = auth.uid());

-- Notes RLS now scoped via parent client access
DROP POLICY IF EXISTS notes_select ON public.client_notes;
DROP POLICY IF EXISTS notes_update ON public.client_notes;
DROP POLICY IF EXISTS notes_delete ON public.client_notes;

CREATE POLICY notes_select ON public.client_notes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_notes.client_id
  AND public.can_access_client(c.responsible_user_id, c.created_by)));

CREATE POLICY notes_update ON public.client_notes FOR UPDATE TO authenticated
USING (
  (created_by = auth.uid() OR public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'advogado'))
  AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_notes.client_id
    AND public.can_access_client(c.responsible_user_id, c.created_by))
);

CREATE POLICY notes_delete ON public.client_notes FOR DELETE TO authenticated
USING (
  (created_by = auth.uid() OR public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'advogado'))
  AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_notes.client_id
    AND public.can_access_client(c.responsible_user_id, c.created_by))
);

-- Files RLS scoped via parent client access
DROP POLICY IF EXISTS files_select ON public.client_files;
DROP POLICY IF EXISTS files_update ON public.client_files;
DROP POLICY IF EXISTS files_delete ON public.client_files;

CREATE POLICY files_select ON public.client_files FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_files.client_id
  AND public.can_access_client(c.responsible_user_id, c.created_by)));

CREATE POLICY files_update ON public.client_files FOR UPDATE TO authenticated
USING (
  (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'advogado'))
  AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_files.client_id
    AND public.can_access_client(c.responsible_user_id, c.created_by))
);

CREATE POLICY files_delete ON public.client_files FOR DELETE TO authenticated
USING (
  (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'advogado'))
  AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_files.client_id
    AND public.can_access_client(c.responsible_user_id, c.created_by))
);

-- Appointments: restrict select to master, creator, assignee, or supervised lawyer's appointments
DROP POLICY IF EXISTS appointments_select ON public.appointments;
CREATE POLICY appointments_select ON public.appointments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'master')
  OR created_by = auth.uid()
  OR assigned_to = auth.uid()
  OR (
    (public.has_role(auth.uid(), 'assistente') OR public.has_role(auth.uid(), 'visualizador'))
    AND (
      assigned_to = public.get_supervisor(auth.uid())
      OR created_by = public.get_supervisor(auth.uid())
      OR (client_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.clients c WHERE c.id = appointments.client_id
          AND c.responsible_user_id = public.get_supervisor(auth.uid())
      ))
    )
  )
  OR (client_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = appointments.client_id
      AND public.can_access_client(c.responsible_user_id, c.created_by)
  ))
);

-- Allow master to update profiles.supervisor_id (already covered by profiles_update_master).
-- Allow assistente/visualizador to read their supervisor's profile name
DROP POLICY IF EXISTS profiles_select_supervisor ON public.profiles;
CREATE POLICY profiles_select_supervisor ON public.profiles FOR SELECT TO authenticated
USING (id = public.get_supervisor(auth.uid()));
