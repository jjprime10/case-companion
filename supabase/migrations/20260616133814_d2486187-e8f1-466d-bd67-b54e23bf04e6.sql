
-- Enums
CREATE TYPE public.case_status AS ENUM (
  'new','under_analysis','awaiting_documents','filed','hearing_scheduled','in_progress','suspended','closed'
);
CREATE TYPE public.task_status AS ENUM ('pending','in_progress','completed');
CREATE TYPE public.task_priority AS ENUM ('low','medium','high','urgent');

-- =================== CASES ===================
CREATE TABLE public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  case_number text,
  court text,
  jurisdiction text,
  case_type text,
  opposing_party text,
  claim_value numeric(14,2),
  opening_date date,
  responsible_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.case_status NOT NULL DEFAULT 'new',
  notes text,
  archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cases TO authenticated;
GRANT ALL ON public.cases TO service_role;

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY cases_select ON public.cases FOR SELECT TO authenticated
USING (
  public.get_user_role(auth.uid()) IS NOT NULL
  AND public.can_access_client(responsible_user_id, created_by)
);

CREATE POLICY cases_insert ON public.cases FOR INSERT TO authenticated
WITH CHECK (
  public.can_write_clients(auth.uid())
  AND (
    public.has_role(auth.uid(),'master')
    OR responsible_user_id = auth.uid()
    OR created_by = auth.uid()
  )
);

CREATE POLICY cases_update ON public.cases FOR UPDATE TO authenticated
USING (public.can_access_client(responsible_user_id, created_by) AND public.can_write_clients(auth.uid()))
WITH CHECK (public.can_access_client(responsible_user_id, created_by) AND public.can_write_clients(auth.uid()));

CREATE POLICY cases_delete ON public.cases FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'master'));

CREATE TRIGGER cases_set_updated_at BEFORE UPDATE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_cases_client ON public.cases(client_id);
CREATE INDEX idx_cases_responsible ON public.cases(responsible_user_id);
CREATE INDEX idx_cases_status ON public.cases(status);

-- Audit for cases
CREATE OR REPLACE FUNCTION public.audit_cases()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_email text;
BEGIN
  SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log(actor_id, actor_email, action, entity, entity_id, details)
    VALUES (auth.uid(), v_email, 'create', 'case', NEW.id,
      jsonb_build_object('case_number', NEW.case_number, 'status', NEW.status, 'client_id', NEW.client_id));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log(actor_id, actor_email, action, entity, entity_id, details)
    VALUES (auth.uid(), v_email,
      CASE WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'status_change' ELSE 'update' END,
      'case', NEW.id,
      jsonb_build_object('status_before', OLD.status, 'status_after', NEW.status, 'archived', NEW.archived));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log(actor_id, actor_email, action, entity, entity_id, details)
    VALUES (auth.uid(), v_email, 'delete', 'case', OLD.id,
      jsonb_build_object('case_number', OLD.case_number));
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER audit_cases_trg
AFTER INSERT OR UPDATE OR DELETE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.audit_cases();

-- =================== TASKS ===================
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  priority public.task_priority NOT NULL DEFAULT 'medium',
  due_date timestamptz,
  status public.task_status NOT NULL DEFAULT 'pending',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'master')
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR (
    (public.has_role(auth.uid(),'assistente') OR public.has_role(auth.uid(),'visualizador'))
    AND assigned_to IS NOT NULL
    AND public.get_supervisor(auth.uid()) = assigned_to
  )
);

CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.get_user_role(auth.uid()) IS NOT NULL
);

CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'master')
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(),'master')
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
);

CREATE POLICY tasks_delete ON public.tasks FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'master') OR created_by = auth.uid());

CREATE TRIGGER tasks_set_updated_at BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_tasks_assigned ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_due ON public.tasks(due_date);

-- Audit for tasks
CREATE OR REPLACE FUNCTION public.audit_tasks()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_email text;
BEGIN
  SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log(actor_id, actor_email, action, entity, entity_id, details)
    VALUES (auth.uid(), v_email, 'create', 'task', NEW.id,
      jsonb_build_object('title', NEW.title, 'assigned_to', NEW.assigned_to, 'priority', NEW.priority));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log(actor_id, actor_email, action, entity, entity_id, details)
    VALUES (auth.uid(), v_email,
      CASE WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'status_change' ELSE 'update' END,
      'task', NEW.id,
      jsonb_build_object('status_before', OLD.status, 'status_after', NEW.status));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log(actor_id, actor_email, action, entity, entity_id, details)
    VALUES (auth.uid(), v_email, 'delete', 'task', OLD.id,
      jsonb_build_object('title', OLD.title));
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER audit_tasks_trg
AFTER INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.audit_tasks();
