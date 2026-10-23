-- Utility logsheets. Matches Docs/DATABASE-DESIGN.md.
-- utility_measures and checklist_results stay unused.

BEGIN;

CREATE TABLE utility_days (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL,
  plant_id TEXT NOT NULL,
  asset_id BIGINT REFERENCES utility_assets(id),
  submission_id BIGINT NOT NULL REFERENCES logsheet_submissions(id),
  recorded_on DATE NOT NULL,
  place_text TEXT,
  shift_banner TEXT,
  UNIQUE (submission_id),
  FOREIGN KEY (plant_id, site_id) REFERENCES plants (id, site_id)
);

CREATE INDEX utility_days_site_recorded_idx ON utility_days (site_id, recorded_on);

CREATE TABLE utility_readings (
  id BIGSERIAL PRIMARY KEY,
  day_id BIGINT NOT NULL REFERENCES utility_days(id) ON DELETE CASCADE,
  row_index INT NOT NULL,
  observed_time TEXT,
  shift_text TEXT,
  group_text TEXT,
  tag_text TEXT,
  numeric_value NUMERIC,
  text_value TEXT,
  unit TEXT,
  remark TEXT,
  canonical_code TEXT,
  owner BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (day_id, row_index),
  CHECK (
    ((numeric_value IS NOT NULL)::int + (text_value IS NOT NULL)::int) = 1
    OR (numeric_value IS NULL AND text_value IS NULL AND remark IS NOT NULL)
  )
);

CREATE TABLE utility_material_uses (
  id BIGSERIAL PRIMARY KEY,
  day_id BIGINT NOT NULL REFERENCES utility_days(id) ON DELETE CASCADE,
  row_index INT NOT NULL,
  group_text TEXT,
  material_text TEXT,
  lot TEXT,
  received_qty NUMERIC,
  used_qty NUMERIC,
  remaining_qty NUMERIC,
  unit TEXT,
  operator TEXT,
  remark TEXT,
  UNIQUE (day_id, row_index)
);

CREATE TABLE utility_loader_runs (
  id BIGSERIAL PRIMARY KEY,
  day_id BIGINT NOT NULL REFERENCES utility_days(id) ON DELETE CASCADE,
  row_index INT NOT NULL,
  shift_text TEXT,
  hour_start NUMERIC,
  hour_end NUMERIC,
  hours_total NUMERIC,
  fuel_liters NUMERIC,
  oil_liters NUMERIC,
  remark TEXT,
  UNIQUE (day_id, row_index)
);

CREATE TABLE utility_checks (
  id BIGSERIAL PRIMARY KEY,
  day_id BIGINT NOT NULL REFERENCES utility_days(id) ON DELETE CASCADE,
  row_index INT NOT NULL,
  item_text TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('yes', 'no')),
  UNIQUE (day_id, row_index)
);

CREATE TABLE utility_jobs (
  id BIGSERIAL PRIMARY KEY,
  day_id BIGINT NOT NULL REFERENCES utility_days(id) ON DELETE CASCADE,
  row_index INT NOT NULL,
  period_text TEXT,
  performed_on DATE,
  done_by TEXT,
  UNIQUE (day_id, row_index)
);

CREATE TABLE utility_job_checks (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES utility_jobs(id) ON DELETE CASCADE,
  item_text TEXT NOT NULL,
  result TEXT CHECK (result IN ('yes', 'no'))
);

INSERT INTO utility_assets (site_id, plant_id, code, name, kind) VALUES
  ('bekasi', 'priscolin-proj-bekasi', 'taihu-15tph', 'Taihu 15 TPH', 'boiler'),
  ('bekasi', 'priscolin-proj-bekasi', 'wuxi-15tph', 'Wuxi 15 TPH', 'boiler'),
  ('bekasi', 'priscolin-proj-bekasi', 'wheel-loader', 'Wheel loader', 'loader'),
  ('bekasi', 'priscolin-proj-bekasi', 'wwtp', 'WWTP', 'effluent')
ON CONFLICT (site_id, code) DO NOTHING;

COMMIT;
