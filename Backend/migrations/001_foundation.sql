-- Plant Information Dashboard. Foundation for organisation, access, logsheets, Tank Farm, and QC.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

CREATE TABLE sites (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  timezone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  UNIQUE (company_id, name)
);

CREATE TABLE plants (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  UNIQUE (site_id, name)
);

CREATE TABLE commodities (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  UNIQUE (company_id, code)
);

CREATE TABLE commodity_aliases (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  commodity_id TEXT NOT NULL REFERENCES commodities(id),
  source_text TEXT NOT NULL,
  UNIQUE (site_id, source_text)
);

CREATE TABLE stock_groups (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (site_id, code)
);

CREATE TABLE tanks (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL REFERENCES plants(id),
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  UNIQUE (plant_id, code)
);

CREATE TABLE quality_rules (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  commodity_id TEXT NOT NULL REFERENCES commodities(id),
  scope TEXT NOT NULL CHECK (scope IN ('storage', 'inbound')),
  parameter_code TEXT NOT NULL,
  bound TEXT NOT NULL CHECK (bound IN ('max', 'min')),
  limit_value NUMERIC,
  severity TEXT NOT NULL CHECK (severity IN ('reject', 'watch')),
  UNIQUE (site_id, commodity_id, scope, parameter_code, bound)
);

CREATE TABLE process_units (
  id BIGSERIAL PRIMARY KEY,
  plant_id TEXT NOT NULL REFERENCES plants(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  yield_rule TEXT NOT NULL DEFAULT 'same-day',
  destination_tank_id TEXT REFERENCES tanks(id),
  UNIQUE (plant_id, code)
);

CREATE TABLE utility_assets (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  plant_id TEXT REFERENCES plants(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT,
  UNIQUE (site_id, code)
);

CREATE TABLE supporting_materials (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE (site_id, code)
);

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE roles (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permissions (
  id BIGSERIAL PRIMARY KEY,
  resource_type TEXT NOT NULL DEFAULT 'page',
  resource_key TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (resource_type, resource_key)
);

CREATE TABLE role_permissions (
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE user_sites (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, site_id)
);

CREATE TABLE tank_profiles (
  tank_id TEXT PRIMARY KEY REFERENCES tanks(id),
  capacity NUMERIC,
  capacity_unit TEXT NOT NULL DEFAULT 'kg',
  bottom_stock NUMERIC,
  dip_offset_mm NUMERIC NOT NULL DEFAULT 0,
  table_temp_c NUMERIC,
  ullage_lk_mm NUMERIC,
  ullage_lb_mm NUMERIC,
  density_group TEXT,
  volume_approx BOOLEAN NOT NULL DEFAULT FALSE,
  origin TEXT NOT NULL DEFAULT 'seed'
);

CREATE TABLE tank_volume_points (
  tank_id TEXT NOT NULL REFERENCES tanks(id),
  height_m NUMERIC NOT NULL,
  volume_litre NUMERIC NOT NULL,
  PRIMARY KEY (tank_id, height_m)
);

CREATE TABLE tank_ring_bands (
  id BIGSERIAL PRIMARY KEY,
  tank_id TEXT NOT NULL REFERENCES tanks(id),
  low_mm NUMERIC NOT NULL,
  high_mm NUMERIC NOT NULL,
  offset_mm NUMERIC NOT NULL
);

CREATE TABLE tank_ring_volumes (
  tank_id TEXT NOT NULL REFERENCES tanks(id),
  ring_index INT NOT NULL,
  volume_litre NUMERIC,
  PRIMARY KEY (tank_id, ring_index)
);

CREATE TABLE density_points (
  density_group TEXT NOT NULL,
  temp_c NUMERIC NOT NULL,
  density NUMERIC NOT NULL,
  PRIMARY KEY (density_group, temp_c)
);

CREATE TABLE logsheet_definitions (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  plant_id TEXT REFERENCES plants(id),
  external_id TEXT,
  form_code TEXT NOT NULL,
  name TEXT NOT NULL,
  mapper_key TEXT,
  schedule TEXT,
  UNIQUE (site_id, form_code)
);

CREATE UNIQUE INDEX logsheet_definitions_external
  ON logsheet_definitions (site_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE TABLE field_map_versions (
  id BIGSERIAL PRIMARY KEY,
  definition_id BIGINT NOT NULL REFERENCES logsheet_definitions(id),
  version INT NOT NULL,
  UNIQUE (definition_id, version)
);

CREATE TABLE field_map_rows (
  id BIGSERIAL PRIMARY KEY,
  version_id BIGINT NOT NULL REFERENCES field_map_versions(id),
  source_field TEXT NOT NULL,
  canonical_code TEXT NOT NULL,
  unit TEXT,
  conversion TEXT,
  entity_hint TEXT,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (version_id, source_field)
);

CREATE TABLE logsheet_submissions (
  id BIGSERIAL PRIMARY KEY,
  definition_id BIGINT NOT NULL REFERENCES logsheet_definitions(id),
  map_version_id BIGINT REFERENCES field_map_versions(id),
  business_key TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (definition_id, business_key)
);

CREATE TABLE submission_history (
  id BIGSERIAL PRIMARY KEY,
  submission_id BIGINT NOT NULL REFERENCES logsheet_submissions(id),
  map_version_id BIGINT,
  payload JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ingest_runs (
  id BIGSERIAL PRIMARY KEY,
  definition_id BIGINT REFERENCES logsheet_definitions(id),
  map_version_id BIGINT,
  range_from DATE,
  range_to DATE,
  status TEXT NOT NULL,
  detail JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE soundings (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  plant_id TEXT NOT NULL REFERENCES plants(id),
  tank_id TEXT NOT NULL REFERENCES tanks(id),
  submission_id BIGINT NOT NULL REFERENCES logsheet_submissions(id),
  recorded_on DATE,
  round_index INT NOT NULL,
  product_name TEXT NOT NULL DEFAULT '',
  level_m NUMERIC,
  temperature_c NUMERIC,
  operational_status TEXT NOT NULL DEFAULT '',
  UNIQUE (tank_id, recorded_on, round_index)
);

CREATE TABLE lab_results (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  plant_id TEXT NOT NULL REFERENCES plants(id),
  tank_id TEXT NOT NULL REFERENCES tanks(id),
  submission_id BIGINT NOT NULL REFERENCES logsheet_submissions(id),
  analysis_date DATE,
  snapshot_on DATE,
  revision INT NOT NULL DEFAULT 1,
  product_name TEXT NOT NULL DEFAULT '',
  temperature_c NUMERIC,
  parameters JSONB NOT NULL DEFAULT '[]'::jsonb,
  remark TEXT,
  UNIQUE (tank_id, snapshot_on, revision)
);

CREATE TABLE logistics_events (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  plant_id TEXT REFERENCES plants(id),
  submission_id BIGINT NOT NULL REFERENCES logsheet_submissions(id),
  mode TEXT NOT NULL,
  name TEXT NOT NULL,
  commodity TEXT NOT NULL,
  direction TEXT NOT NULL,
  target_label TEXT,
  ffa NUMERIC,
  moisture NUMERIC,
  sampled_on DATE,
  remark TEXT,
  sample_breach BOOLEAN NOT NULL DEFAULT FALSE,
  detail_lines JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE analytics_movements (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  submission_id BIGINT NOT NULL REFERENCES logsheet_submissions(id),
  commodity TEXT NOT NULL,
  direction TEXT NOT NULL
);

CREATE TABLE storage_certificates (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  plant_id TEXT NOT NULL REFERENCES plants(id),
  tank_id TEXT NOT NULL REFERENCES tanks(id),
  submission_id BIGINT NOT NULL REFERENCES logsheet_submissions(id),
  oil TEXT,
  analysis_date DATE,
  snapshot_on DATE,
  revision INT NOT NULL DEFAULT 1,
  capacity NUMERIC,
  quantity NUMERIC,
  empty_space NUMERIC,
  temperature_c NUMERIC,
  ffa NUMERIC,
  moisture NUMERIC,
  color_r NUMERIC,
  color_y NUMERIC,
  iv NUMERIC,
  pv NUMERIC,
  smp NUMERIC,
  cloud_point NUMERIC,
  anv NUMERIC,
  carotene NUMERIC,
  phosphorus NUMERIC,
  dobi NUMERIC,
  totox NUMERIC,
  odor TEXT,
  remark TEXT,
  UNIQUE (tank_id, snapshot_on, revision)
);

CREATE TABLE vessel_tickets (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  submission_id BIGINT NOT NULL REFERENCES logsheet_submissions(id),
  ship TEXT,
  supplier TEXT,
  commodity TEXT NOT NULL,
  arrival DATE,
  quantity_label TEXT,
  contract_no TEXT,
  ffa_max NUMERIC,
  moisture_max NUMERIC,
  dobi_min NUMERIC,
  release TEXT,
  leader TEXT,
  leader_signed TEXT,
  head TEXT,
  head_signed TEXT,
  composite_ffa NUMERIC,
  composite_iv NUMERIC,
  composite_moisture NUMERIC,
  composite_dobi NUMERIC,
  composite_pv NUMERIC,
  composite_anv NUMERIC,
  composite_triene NUMERIC,
  composite_totox NUMERIC,
  composite_carotene NUMERIC,
  composite_mineral_oil TEXT
);

CREATE TABLE vessel_palka_samples (
  id BIGSERIAL PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES vessel_tickets(id) ON DELETE CASCADE,
  palka TEXT NOT NULL,
  sample_no TEXT,
  ffa NUMERIC,
  iv NUMERIC,
  dobi NUMERIC,
  moisture NUMERIC
);

CREATE TABLE truck_batches (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  submission_id BIGINT NOT NULL REFERENCES logsheet_submissions(id),
  supplier TEXT,
  material TEXT NOT NULL,
  vessel TEXT,
  arrival DATE,
  contract_no TEXT,
  ffa_max NUMERIC,
  moisture_max NUMERIC
);

CREATE TABLE truck_samples (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL REFERENCES truck_batches(id) ON DELETE CASCADE,
  sample_no TEXT,
  sampled_on DATE,
  police_no TEXT NOT NULL,
  ffa NUMERIC,
  moisture NUMERIC,
  iv NUMERIC,
  dobi NUMERIC,
  pv NUMERIC,
  color_r NUMERIC,
  color_y NUMERIC,
  analyst TEXT,
  remark TEXT
);

CREATE TABLE gate_movements (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  submission_id BIGINT NOT NULL REFERENCES logsheet_submissions(id),
  vehicle TEXT NOT NULL,
  commodity TEXT NOT NULL,
  time_in TEXT,
  time_out TEXT,
  customer TEXT,
  seal_in TEXT,
  seal_out TEXT,
  operator TEXT,
  remark TEXT,
  period_start DATE,
  period_end DATE
);

CREATE TABLE production_measures (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  plant_id TEXT REFERENCES plants(id),
  process_unit_id BIGINT REFERENCES process_units(id),
  submission_id BIGINT REFERENCES logsheet_submissions(id),
  recorded_on DATE,
  shift TEXT,
  role TEXT,
  quantity NUMERIC,
  unit TEXT
);

CREATE TABLE utility_measures (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  plant_id TEXT REFERENCES plants(id),
  asset_id BIGINT REFERENCES utility_assets(id),
  submission_id BIGINT REFERENCES logsheet_submissions(id),
  recorded_on DATE,
  canonical_code TEXT,
  quantity NUMERIC,
  unit TEXT,
  owner BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE checklist_results (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  plant_id TEXT REFERENCES plants(id),
  submission_id BIGINT REFERENCES logsheet_submissions(id),
  recorded_on DATE,
  item TEXT,
  result TEXT,
  remark TEXT
);

CREATE INDEX soundings_site_day ON soundings (site_id, recorded_on);
CREATE INDEX lab_results_site_tank ON lab_results (site_id, tank_id);

COMMIT;
