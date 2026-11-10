-- Tank gauging (TankVision / NXA ATG) for sites whose tank farm is read from a gauge system.
-- Same tables and columns as Jetty Planning System, scoped by site instead of port.
-- Readings also become daily rounds in soundings, so the existing screens work unchanged.

BEGIN;

-- Tanks created from a gauge system carry a name, an order and where they came from.
ALTER TABLE tanks
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'logsheet';

COMMENT ON COLUMN tanks.source IS 'logsheet = filled from logsheet workbooks. atg = created and read from a gauge system.';

-- A round from a gauge system has no logsheet behind it, and carries mass, density and volume.
ALTER TABLE soundings
  ALTER COLUMN submission_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'logsheet',
  ADD COLUMN IF NOT EXISTS mass_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS density_kg_m3 NUMERIC,
  ADD COLUMN IF NOT EXISTS volume_litre NUMERIC,
  ADD COLUMN IF NOT EXISTS sampled_at TIMESTAMPTZ;

COMMENT ON COLUMN soundings.mass_kg IS 'Total mass reported by the gauge system, in kilograms. Stock uses it directly when present.';

CREATE TABLE IF NOT EXISTS tank_gauging_sources (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  base_url TEXT NOT NULL,
  label TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  auth_type TEXT NOT NULL DEFAULT 'none',
  auth_user TEXT,
  auth_secret_encrypted TEXT,
  last_poll_at TIMESTAMPTZ,
  last_poll_ok BOOLEAN,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT uq_tank_gauging_sources_site_base_url UNIQUE (site_id, base_url),
  CONSTRAINT chk_tank_gauging_sources_auth_type CHECK (auth_type IN ('none', 'basic', 'cookie'))
);

COMMENT ON TABLE tank_gauging_sources IS 'Gauge system hosts per site. Credentials are encrypted at rest.';

-- A tank is identified by host, unit and the tank number inside that unit.
-- Some controllers hold several units that each number their tanks from 1.
CREATE TABLE IF NOT EXISTS tank_gauging_tank_map (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  source_base_url TEXT NOT NULL,
  source_unit_name TEXT NOT NULL DEFAULT '',
  external_tank_id INT NOT NULL CHECK (external_tank_id >= 0),
  tank_id TEXT NOT NULL REFERENCES tanks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tank_gauging_tank_map_key UNIQUE (site_id, source_base_url, source_unit_name, external_tank_id),
  CONSTRAINT uq_tank_gauging_tank_map_tank UNIQUE (tank_id)
);

CREATE INDEX IF NOT EXISTS idx_tank_gauging_tank_map_site ON tank_gauging_tank_map (site_id, source_base_url);

CREATE TABLE IF NOT EXISTS tank_gauging_latest (
  tank_id TEXT PRIMARY KEY REFERENCES tanks(id) ON DELETE CASCADE,
  product_name TEXT,
  tank_comment TEXT,
  level_mm NUMERIC,
  temperature_c NUMERIC,
  observed_density_kg_m3 NUMERIC,
  total_observed_volume NUMERIC,
  total_mass NUMERIC,
  flow_rate_tph NUMERIC,
  status_text TEXT,
  tank_status_code INT,
  level_movement INT,
  gauge_ref_height_mm NUMERIC,
  capacity NUMERIC,
  recorded_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_payload JSONB,
  source TEXT NOT NULL DEFAULT 'tankvision-gwt',
  source_base_url TEXT NOT NULL,
  source_unit_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_tank_gauging_latest_fetched ON tank_gauging_latest (fetched_at DESC);

COMMENT ON COLUMN tank_gauging_latest.total_mass IS 'Total mass in tonnes, as the gauge system reports it.';
COMMENT ON COLUMN tank_gauging_latest.total_observed_volume IS 'Observed volume in litres.';

CREATE TABLE IF NOT EXISTS tank_gauging_samples (
  id BIGSERIAL PRIMARY KEY,
  tank_id TEXT NOT NULL REFERENCES tanks(id) ON DELETE CASCADE,
  source_base_url TEXT NOT NULL,
  product_name TEXT,
  tank_comment TEXT,
  total_mass NUMERIC,
  flow_rate_tph NUMERIC,
  level_mm NUMERIC,
  temperature_c NUMERIC,
  observed_density_kg_m3 NUMERIC,
  total_observed_volume NUMERIC,
  status_text TEXT,
  sampled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_payload JSONB,
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tank_gauging_samples_tank_sampled ON tank_gauging_samples (tank_id, sampled_at DESC);
CREATE INDEX IF NOT EXISTS idx_tank_gauging_samples_sampled ON tank_gauging_samples (sampled_at DESC);
CREATE INDEX IF NOT EXISTS idx_tank_gauging_samples_archived ON tank_gauging_samples (archived_at) WHERE archived_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS tank_gauging_purge_log (
  id BIGSERIAL PRIMARY KEY,
  batch_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('archive', 'delete')),
  sample_id BIGINT,
  tank_id TEXT,
  source_base_url TEXT,
  sampled_at TIMESTAMPTZ,
  total_mass NUMERIC,
  flow_rate_tph NUMERIC,
  level_mm NUMERIC,
  temperature_c NUMERIC,
  status_text TEXT,
  acted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tank_gauging_purge_log_acted ON tank_gauging_purge_log (acted_at DESC);

-- Times of day, in the site's timezone, at which a gauge reading becomes a round in soundings.
CREATE TABLE IF NOT EXISTS tank_gauging_settings (
  site_id TEXT PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  round_times TEXT NOT NULL DEFAULT '06:30,14:30',
  round_tolerance_min INT NOT NULL DEFAULT 30 CHECK (round_tolerance_min BETWEEN 1 AND 240),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL
);

COMMIT;
