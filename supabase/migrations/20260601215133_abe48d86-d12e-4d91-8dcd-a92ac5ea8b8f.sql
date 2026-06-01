
-- 1. WIPE
TRUNCATE public.client_files, public.client_notes, public.clients, public.user_roles, public.profiles RESTART IDENTITY CASCADE;
DELETE FROM auth.users;

-- 2. APPOINTMENTS
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'compromisso',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  location text,
  client_id uuid,
  assigned_to uuid,
  created_by uuid,
  status text NOT NULL DEFAULT 'agendado',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY appointments_select ON public.appointments FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'master') OR created_by = auth.uid() OR assigned_to = auth.uid()
         OR has_role(auth.uid(),'advogado') OR has_role(auth.uid(),'assistente') OR has_role(auth.uid(),'visualizador'));
CREATE POLICY appointments_insert ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (can_upload_files(auth.uid()) AND created_by = auth.uid());
CREATE POLICY appointments_update ON public.appointments FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'master') OR created_by = auth.uid() OR assigned_to = auth.uid());
CREATE POLICY appointments_delete ON public.appointments FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'master') OR created_by = auth.uid());
CREATE TRIGGER appointments_updated_at BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_appointments_starts_at ON public.appointments(starts_at);
CREATE INDEX idx_appointments_assigned ON public.appointments(assigned_to);
CREATE INDEX idx_appointments_client ON public.appointments(client_id);

-- 3. REMINDERS
CREATE TABLE public.appointment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  minutes_before integer NOT NULL CHECK (minutes_before > 0),
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_reminders TO authenticated;
GRANT ALL ON public.appointment_reminders TO service_role;
ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY reminders_all ON public.appointment_reminders FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_id
    AND (has_role(auth.uid(),'master') OR a.created_by = auth.uid() OR a.assigned_to = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_id
    AND (has_role(auth.uid(),'master') OR a.created_by = auth.uid() OR a.assigned_to = auth.uid())));

-- 4. AUDIT LOG
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_select_master ON public.audit_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'master'));
CREATE POLICY audit_insert_any ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());
CREATE INDEX idx_audit_created_at ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_entity ON public.audit_log(entity, entity_id);

-- 5. WHATSAPP MESSAGES
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  phone text NOT NULL,
  message text NOT NULL,
  direction text NOT NULL DEFAULT 'outbound',
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_select ON public.whatsapp_messages FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'master') OR has_role(auth.uid(),'advogado')
         OR has_role(auth.uid(),'assistente') OR has_role(auth.uid(),'visualizador'));
CREATE POLICY wa_insert ON public.whatsapp_messages FOR INSERT TO authenticated
  WITH CHECK (can_upload_files(auth.uid()) AND sent_by = auth.uid());
CREATE POLICY wa_delete ON public.whatsapp_messages FOR DELETE TO authenticated
  USING (sent_by = auth.uid() OR has_role(auth.uid(),'master'));
CREATE INDEX idx_wa_client ON public.whatsapp_messages(client_id, created_at DESC);

-- 6. NEW CLIENT OWNERSHIP RULES
DROP POLICY clients_insert ON public.clients;
DROP POLICY clients_update ON public.clients;
DROP POLICY clients_delete ON public.clients;

CREATE POLICY clients_insert ON public.clients FOR INSERT TO authenticated
  WITH CHECK (can_upload_files(auth.uid()) AND created_by = auth.uid());
CREATE POLICY clients_update ON public.clients FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'master') OR created_by = auth.uid() OR responsible_user_id = auth.uid());
CREATE POLICY clients_delete ON public.clients FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'master') OR created_by = auth.uid());

-- 7. AUDIT TRIGGER for clients
CREATE OR REPLACE FUNCTION public.audit_clients()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text;
BEGIN
  SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log(actor_id, actor_email, action, entity, entity_id, details)
    VALUES (auth.uid(), v_email, 'create', 'client', NEW.id,
            jsonb_build_object('name', NEW.name, 'document', NEW.document));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log(actor_id, actor_email, action, entity, entity_id, details)
    VALUES (auth.uid(), v_email,
      CASE WHEN OLD.responsible_user_id IS DISTINCT FROM NEW.responsible_user_id
           THEN 'assign' ELSE 'update' END,
      'client', NEW.id,
      jsonb_build_object('responsible_before', OLD.responsible_user_id,
                         'responsible_after', NEW.responsible_user_id));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log(actor_id, actor_email, action, entity, entity_id, details)
    VALUES (auth.uid(), v_email, 'delete', 'client', OLD.id,
            jsonb_build_object('name', OLD.name));
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER audit_clients_trg
AFTER INSERT OR UPDATE OR DELETE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.audit_clients();

-- 8. AUDIT TRIGGER for user_roles
CREATE OR REPLACE FUNCTION public.audit_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text;
BEGIN
  SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log(actor_id, actor_email, action, entity, entity_id, details)
    VALUES (auth.uid(), v_email, 'role_grant', 'user_role', NEW.user_id,
            jsonb_build_object('role', NEW.role));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log(actor_id, actor_email, action, entity, entity_id, details)
    VALUES (auth.uid(), v_email, 'role_revoke', 'user_role', OLD.user_id,
            jsonb_build_object('role', OLD.role));
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER audit_roles_trg
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_roles();
