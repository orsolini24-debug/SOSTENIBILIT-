-- SustainChain Initial Schema - May 2026

-- Organizations & Projects
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    vat_number TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    year INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', -- draft, in_progress, completed, archived
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users & Roles
CREATE TABLE roles (
    id TEXT PRIMARY KEY, -- e.g. 'admin', 'editor', 'viewer'
    name TEXT NOT NULL,
    permissions JSONB DEFAULT '{}'::jsonb
);

INSERT INTO roles (id, name, permissions) VALUES 
('admin', 'Administrator', '{"all": true}'),
('editor', 'Editor', '{"read": true, "write": true}'),
('viewer', 'Viewer', '{"read": true}');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Linked to Auth.users
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    organization_id UUID REFERENCES organizations(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE project_users (
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id TEXT REFERENCES roles(id),
    PRIMARY KEY (project_id, user_id)
);

-- Documents
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT, -- e.g. 'bolletta_elettrica', 'registro_rifiuti', 'report_hr'
    storage_path TEXT NOT NULL,
    hash TEXT, -- For deduplication
    metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending', -- pending, processing, completed, error
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Datapoints Registry (Normative level)
CREATE TABLE datapoints (
    id TEXT PRIMARY KEY, -- e.g. 'VSME-B1', 'VSME-B2'
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    unit TEXT,
    module TEXT, -- B, N, BP
    sector_relevance JSONB DEFAULT '{}'::jsonb, -- e.g. {"meccanica": "high"}
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Datapoint Values (Client level)
CREATE TABLE datapoint_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    datapoint_id TEXT REFERENCES datapoints(id),
    value TEXT, -- Stored as text, can be cast to numeric if needed
    status TEXT NOT NULL DEFAULT 'stimato', -- stimato, dichiarato, documentato, verificato, escluso, non_applicabile
    confidence TEXT NOT NULL DEFAULT 'bassa', -- alta, media, bassa, non_determinabile
    source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    evidence_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, datapoint_id)
);

-- Audit Trail
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL, -- e.g. 'datapoint_value', 'document'
    entity_id UUID NOT NULL,
    action TEXT NOT NULL, -- create, update, delete, approve
    old_value JSONB,
    new_value JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extraction Engine
CREATE TABLE extraction_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    prompt_version TEXT,
    status TEXT DEFAULT 'pending',
    result JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE extracted_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    extraction_run_id UUID REFERENCES extraction_runs(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    value TEXT,
    confidence NUMERIC(4,3),
    page_reference INTEGER,
    source_snippet TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_datapoint_values_updated_at BEFORE UPDATE ON datapoint_values FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
