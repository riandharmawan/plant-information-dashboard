-- DataHub (DHM) link for Company, Site, Plant.
-- Pull, review, apply. Same model as Jetty Planning System.

BEGIN;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS hub_code TEXT,
  ADD COLUMN IF NOT EXISTS hub_record_id TEXT,
  ADD COLUMN IF NOT EXISTS hub_version INT,
  ADD COLUMN IF NOT EXISTS hub_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS short_name TEXT,
  ADD COLUMN IF NOT EXISTS company_code_sap TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS datahub_last_apply_source TEXT,
  ADD COLUMN IF NOT EXISTS datahub_last_apply_run_id BIGINT;

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS hub_code TEXT,
  ADD COLUMN IF NOT EXISTS hub_record_id TEXT,
  ADD COLUMN IF NOT EXISTS hub_version INT,
  ADD COLUMN IF NOT EXISTS hub_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS datahub_last_apply_source TEXT,
  ADD COLUMN IF NOT EXISTS datahub_last_apply_run_id BIGINT;

ALTER TABLE plants
  ADD COLUMN IF NOT EXISTS hub_code TEXT,
  ADD COLUMN IF NOT EXISTS hub_record_id TEXT,
  ADD COLUMN IF NOT EXISTS hub_version INT,
  ADD COLUMN IF NOT EXISTS hub_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS datahub_last_apply_source TEXT,
  ADD COLUMN IF NOT EXISTS datahub_last_apply_run_id BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS companies_hub_code_key ON companies (hub_code) WHERE hub_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sites_hub_code_key ON sites (hub_code) WHERE hub_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS plants_hub_code_key ON plants (hub_code) WHERE hub_code IS NOT NULL;

COMMENT ON COLUMN sites.timezone IS 'Local only. DataHub has no timezone field. New synced sites start at Asia/Jakarta.';

-- One row. The private key is stored encrypted.
CREATE TABLE IF NOT EXISTS datahub_config (
  id INT PRIMARY KEY CHECK (id = 1),
  base_url TEXT,
  public_key TEXT,
  private_key_encrypted TEXT,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_sync_at TIMESTAMPTZ,
  last_sync_ok BOOLEAN,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL
);
INSERT INTO datahub_config (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS datahub_sync_runs (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('company', 'site', 'plant')),
  status TEXT NOT NULL DEFAULT 'staged' CHECK (status IN ('staged', 'applied', 'discarded', 'failed')),
  hub_record_count INT NOT NULL DEFAULT 0,
  new_count INT NOT NULL DEFAULT 0,
  changed_count INT NOT NULL DEFAULT 0,
  unchanged_count INT NOT NULL DEFAULT 0,
  applied_count INT NOT NULL DEFAULT 0,
  error TEXT,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS datahub_sync_items (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES datahub_sync_runs(id) ON DELETE CASCADE,
  local_id TEXT,
  hub_code TEXT,
  label TEXT NOT NULL,
  diff_kind TEXT NOT NULL CHECK (diff_kind IN ('new', 'changed', 'unchanged')),
  decision TEXT NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending', 'approved', 'rejected')),
  field_diff JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied_at TIMESTAMPTZ,
  apply_error TEXT
);
CREATE INDEX IF NOT EXISTS datahub_sync_items_run_idx ON datahub_sync_items (run_id);

-- Page right for the admin screen. Administrator gets full access.
INSERT INTO permissions (resource_type, resource_key, can_view, can_edit, can_delete)
SELECT 'page', 'admin-datahub', FALSE, FALSE, FALSE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE resource_key = 'admin-datahub');

INSERT INTO role_permissions (role_id, permission_id, can_view, can_edit, can_delete)
SELECT r.id, p.id, TRUE, TRUE, TRUE
FROM roles r
JOIN permissions p ON p.resource_key = 'admin-datahub'
WHERE r.name = 'Administrator' AND r.is_system_role = TRUE
  AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

COMMIT;
