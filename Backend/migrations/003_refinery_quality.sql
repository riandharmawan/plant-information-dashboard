-- F/QCO-002 projection. Matches Docs/DATABASE-DESIGN.md, Refinery quality.

BEGIN;

ALTER TABLE plants ADD CONSTRAINT plants_id_site_unique UNIQUE (id, site_id);
ALTER TABLE process_units ADD CONSTRAINT process_units_id_plant_unique UNIQUE (id, plant_id);
ALTER TABLE tanks ADD CONSTRAINT tanks_id_plant_unique UNIQUE (id, plant_id);

CREATE TABLE refinery_quality_days (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL,
  plant_id TEXT NOT NULL,
  process_unit_id BIGINT NOT NULL,
  submission_id BIGINT NOT NULL REFERENCES logsheet_submissions(id),
  production_date DATE NOT NULL,
  report_date DATE,
  declared_oils TEXT NOT NULL DEFAULT '',
  UNIQUE (submission_id),
  UNIQUE (process_unit_id, production_date),
  FOREIGN KEY (plant_id, site_id) REFERENCES plants (id, site_id),
  FOREIGN KEY (process_unit_id, plant_id) REFERENCES process_units (id, plant_id)
);

CREATE INDEX refinery_quality_days_site_date_idx
  ON refinery_quality_days (site_id, production_date);

CREATE TABLE refinery_quality_readings (
  id BIGSERIAL PRIMARY KEY,
  day_id BIGINT NOT NULL REFERENCES refinery_quality_days(id) ON DELETE CASCADE,
  row_index INT NOT NULL,
  observed_time TEXT NOT NULL,
  from_tank_text TEXT,
  from_tank_id TEXT,
  flow_rate NUMERIC,
  remark TEXT,
  UNIQUE (day_id, observed_time, row_index)
);

CREATE TABLE refinery_quality_streams (
  id BIGSERIAL PRIMARY KEY,
  reading_id BIGINT NOT NULL REFERENCES refinery_quality_readings(id) ON DELETE CASCADE,
  stream TEXT NOT NULL CHECK (stream IN (
    'raw_material', 'bleaching_oil', 'finished_good', 'by_product', 'spent_earth'
  )),
  commodity_text TEXT,
  commodity_id TEXT REFERENCES commodities(id),
  destination_text TEXT,
  destination_tank_id TEXT,
  UNIQUE (reading_id, stream)
);

CREATE TABLE refinery_quality_parameters (
  id BIGSERIAL PRIMARY KEY,
  stream_id BIGINT NOT NULL REFERENCES refinery_quality_streams(id) ON DELETE CASCADE,
  canonical_code TEXT NOT NULL,
  numeric_value NUMERIC,
  text_value TEXT,
  UNIQUE (stream_id, canonical_code),
  CHECK ((numeric_value IS NOT NULL) <> (text_value IS NOT NULL))
);

COMMIT;
