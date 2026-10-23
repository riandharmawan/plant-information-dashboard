-- F/RFA-004(A) and F/RFA-004(B) projections. Matches Docs/DATABASE-DESIGN.md.

BEGIN;

CREATE TABLE production_days (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL,
  plant_id TEXT NOT NULL,
  process_unit_id BIGINT NOT NULL,
  submission_id BIGINT NOT NULL REFERENCES logsheet_submissions(id),
  production_date DATE NOT NULL,
  UNIQUE (submission_id),
  UNIQUE (process_unit_id, production_date),
  FOREIGN KEY (plant_id, site_id) REFERENCES plants (id, site_id),
  FOREIGN KEY (process_unit_id, plant_id) REFERENCES process_units (id, plant_id)
);

CREATE INDEX production_days_site_date_idx ON production_days (site_id, production_date);

CREATE TABLE production_flows (
  id BIGSERIAL PRIMARY KEY,
  day_id BIGINT NOT NULL REFERENCES production_days(id) ON DELETE CASCADE,
  block TEXT NOT NULL CHECK (block IN ('feed', 'product', 'coproduct')),
  row_index INT NOT NULL,
  shift_text TEXT,
  commodity_text TEXT,
  commodity_id TEXT REFERENCES commodities(id),
  from_tank_text TEXT,
  from_tank_id TEXT,
  started_at TEXT,
  ended_at TEXT,
  flow_start NUMERIC,
  flow_end NUMERIC,
  quantity NUMERIC,
  unit TEXT,
  destination_text TEXT,
  destination_tank_id TEXT,
  UNIQUE (day_id, block, row_index)
);

CREATE TABLE production_materials (
  id BIGSERIAL PRIMARY KEY,
  day_id BIGINT NOT NULL REFERENCES production_days(id) ON DELETE CASCADE,
  shift_text TEXT NOT NULL,
  material TEXT NOT NULL CHECK (material IN ('bleaching_earth', 'phosphoric_acid')),
  slot INT NOT NULL,
  quantity NUMERIC,
  tank_volume NUMERIC,
  total_quantity NUMERIC,
  unit TEXT,
  lot TEXT,
  grade TEXT,
  UNIQUE (day_id, shift_text, material, slot)
);

CREATE TABLE production_utilities (
  id BIGSERIAL PRIMARY KEY,
  day_id BIGINT NOT NULL REFERENCES production_days(id) ON DELETE CASCADE,
  row_index INT NOT NULL,
  shift_text TEXT,
  canonical_code TEXT NOT NULL,
  quantity NUMERIC,
  flow_start NUMERIC,
  flow_end NUMERIC,
  unit TEXT,
  owner BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE NULLS NOT DISTINCT (day_id, shift_text, canonical_code, row_index)
);

CREATE TABLE production_remarks (
  id BIGSERIAL PRIMARY KEY,
  day_id BIGINT NOT NULL REFERENCES production_days(id) ON DELETE CASCADE,
  row_index INT NOT NULL,
  section_text TEXT,
  shift_text TEXT,
  remark TEXT,
  UNIQUE (day_id, row_index)
);

INSERT INTO process_units (plant_id, code, name, yield_rule) VALUES
  ('priscolin-proj-bekasi', 'fractionation400', 'Fractionation 400', 'same-day'),
  ('priscolin-proj-bekasi', 'fractionation500', 'Fractionation 500', 'same-day')
ON CONFLICT (plant_id, code) DO NOTHING;

COMMIT;
