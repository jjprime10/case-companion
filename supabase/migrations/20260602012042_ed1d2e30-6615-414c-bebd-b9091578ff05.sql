
-- Remove WhatsApp integration
DROP TABLE IF EXISTS public.whatsapp_messages CASCADE;

-- Expand audit log with triggers for files, notes, and appointments
CREATE OR REPLACE FUNCTION public.audit_files()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text;
BEGIN
  SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log(actor_id, actor_email, action, entity, entity_id, details)
    VALUES (auth.uid(), v_email, 'create', 'file', NEW.id,
      jsonb_build_object('file_name', NEW.file_name, 'client_id', NEW.client_id, 'category', NEW.category));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log(actor_id, actor_email, action, entity, entity_id, details)
    VALUES (auth.uid(), v_email, 'delete', 'file', OLD.id,
      jsonb_build_object('file_name', OLD.file_name, 'client_id', OLD.client_id));
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.audit_notes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text;
BEGIN
  SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log(actor_id, actor_email, action, entity, entity_id, details)
    VALUES (auth.uid(), v_email, 'create', 'note', NEW.id,
      jsonb_build_object('client_id', NEW.client_id, 'preview', left(NEW.content, 80)));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log(actor_id, actor_email, action, entity, entity_id, details)
    VALUES (auth.uid(), v_email, 'update', 'note', NEW.id,
      jsonb_build_object('client_id', NEW.client_id));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log(actor_id, actor_email, action, entity, entity_id, details)
    VALUES (auth.uid(), v_email, 'delete', 'note', OLD.id,
      jsonb_build_object('client_id', OLD.client_id));
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.audit_appointments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text;
BEGIN
  SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log(actor_id, actor_email, action, entity, entity_id, details)
    VALUES (auth.uid(), v_email, 'create', 'appointment', NEW.id,
      jsonb_build_object('title', NEW.title, 'starts_at', NEW.starts_at, 'type', NEW.type));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log(actor_id, actor_email, action, entity, entity_id, details)
    VALUES (auth.uid(), v_email, 'update', 'appointment', NEW.id,
      jsonb_build_object('title', NEW.title, 'status', NEW.status));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log(actor_id, actor_email, action, entity, entity_id, details)
    VALUES (auth.uid(), v_email, 'delete', 'appointment', OLD.id,
      jsonb_build_object('title', OLD.title));
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_audit_clients ON public.clients;
CREATE TRIGGER trg_audit_clients AFTER INSERT OR UPDATE OR DELETE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.audit_clients();

DROP TRIGGER IF EXISTS trg_audit_roles ON public.user_roles;
CREATE TRIGGER trg_audit_roles AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_roles();

DROP TRIGGER IF EXISTS trg_audit_files ON public.client_files;
CREATE TRIGGER trg_audit_files AFTER INSERT OR DELETE ON public.client_files
FOR EACH ROW EXECUTE FUNCTION public.audit_files();

DROP TRIGGER IF EXISTS trg_audit_notes ON public.client_notes;
CREATE TRIGGER trg_audit_notes AFTER INSERT OR UPDATE OR DELETE ON public.client_notes
FOR EACH ROW EXECUTE FUNCTION public.audit_notes();

DROP TRIGGER IF EXISTS trg_audit_appointments ON public.appointments;
CREATE TRIGGER trg_audit_appointments AFTER INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.audit_appointments();
