
-- Enums
CREATE TYPE public.app_role AS ENUM ('master', 'advogado', 'assistente', 'visualizador');
CREATE TYPE public.person_type AS ENUM ('PF', 'PJ');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'master' THEN 1 WHEN 'advogado' THEN 2
    WHEN 'assistente' THEN 3 WHEN 'visualizador' THEN 4 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_write_clients(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('master','advogado')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_upload_files(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('master','advogado','assistente')
  );
$$;

-- Clients
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_type public.person_type NOT NULL,
  document TEXT NOT NULL UNIQUE, -- CPF or CNPJ (digits only)
  name TEXT NOT NULL, -- Nome ou razão social
  trade_name TEXT, -- Nome fantasia (PJ)
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  case_number TEXT,
  case_status TEXT,
  court TEXT,
  responsible_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes_summary TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX clients_name_idx ON public.clients USING gin (to_tsvector('portuguese', name));
CREATE INDEX clients_document_idx ON public.clients (document);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Client notes
CREATE TABLE public.client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX client_notes_client_idx ON public.client_notes (client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_notes TO authenticated;
GRANT ALL ON public.client_notes TO service_role;
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

-- Client files (storage metadata)
CREATE TABLE public.client_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  category TEXT, -- foto, video, documento, planilha, outro
  description TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX client_files_client_idx ON public.client_files (client_id);
CREATE INDEX client_files_name_idx ON public.client_files USING gin (to_tsvector('portuguese', file_name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_files TO authenticated;
GRANT ALL ON public.client_files TO service_role;
ALTER TABLE public.client_files ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER client_notes_updated_at BEFORE UPDATE ON public.client_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies
-- Profiles: any authenticated user can read all profiles (needed to display names); user can update own; master can update any
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_master" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'master'));
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_delete_master" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'master'));

-- user_roles: authenticated can read all (needed for UI); only master writes
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_master_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'master'))
  WITH CHECK (public.has_role(auth.uid(),'master'));

-- clients: all authenticated read; write requires advogado/master; delete master/advogado
CREATE POLICY "clients_select" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients_insert" ON public.clients FOR INSERT TO authenticated WITH CHECK (public.can_write_clients(auth.uid()));
CREATE POLICY "clients_update" ON public.clients FOR UPDATE TO authenticated USING (public.can_write_clients(auth.uid()));
CREATE POLICY "clients_delete" ON public.clients FOR DELETE TO authenticated USING (public.can_write_clients(auth.uid()));

-- client_notes: all read; assistente+ can write; only writer or master can delete/update
CREATE POLICY "notes_select" ON public.client_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "notes_insert" ON public.client_notes FOR INSERT TO authenticated WITH CHECK (public.can_upload_files(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "notes_update" ON public.client_notes FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'advogado'));
CREATE POLICY "notes_delete" ON public.client_notes FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'advogado'));

-- client_files: all read; assistente+ can upload; uploader/master/advogado can delete
CREATE POLICY "files_select" ON public.client_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "files_insert" ON public.client_files FOR INSERT TO authenticated WITH CHECK (public.can_upload_files(auth.uid()) AND uploaded_by = auth.uid());
CREATE POLICY "files_update" ON public.client_files FOR UPDATE TO authenticated USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'advogado'));
CREATE POLICY "files_delete" ON public.client_files FOR DELETE TO authenticated USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'advogado'));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('client-files','client-files', false);

CREATE POLICY "client_files_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-files');
CREATE POLICY "client_files_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-files' AND public.can_upload_files(auth.uid()));
CREATE POLICY "client_files_storage_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'client-files' AND (owner = auth.uid() OR public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'advogado')));
CREATE POLICY "client_files_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-files' AND (owner = auth.uid() OR public.has_role(auth.uid(),'master') OR public.has_role(auth.uid(),'advogado')));
