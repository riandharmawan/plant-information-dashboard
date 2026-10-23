-- F/TNF-003 and F/QCO-001 projections. Matches Docs/DATABASE-DESIGN.md.
-- 001_foundation.sql is already applied, so these are alterations.

BEGIN;

ALTER TABLE soundings
  ADD COLUMN commodity_id TEXT REFERENCES commodities(id);

ALTER TABLE soundings
  ALTER COLUMN recorded_on SET NOT NULL;

CREATE INDEX soundings_site_recorded_idx ON soundings (site_id, recorded_on);

ALTER TABLE soundings
  ADD CONSTRAINT soundings_plant_site_fk
  FOREIGN KEY (plant_id, site_id) REFERENCES plants (id, site_id);

ALTER TABLE soundings
  ADD CONSTRAINT soundings_tank_plant_fk
  FOREIGN KEY (tank_id, plant_id) REFERENCES tanks (id, plant_id);

ALTER TABLE storage_certificates
  ADD COLUMN commodity_id TEXT REFERENCES commodities(id);

ALTER TABLE storage_certificates
  ADD CONSTRAINT storage_certificates_plant_site_fk
  FOREIGN KEY (plant_id, site_id) REFERENCES plants (id, site_id);

ALTER TABLE storage_certificates
  ADD CONSTRAINT storage_certificates_tank_plant_fk
  FOREIGN KEY (tank_id, plant_id) REFERENCES tanks (id, plant_id);

CREATE TABLE certificate_parameters (
  id BIGSERIAL PRIMARY KEY,
  certificate_id BIGINT NOT NULL REFERENCES storage_certificates(id) ON DELETE CASCADE,
  canonical_code TEXT NOT NULL,
  numeric_value NUMERIC,
  text_value TEXT,
  UNIQUE (certificate_id, canonical_code),
  CHECK ((numeric_value IS NOT NULL) <> (text_value IS NOT NULL))
);

COMMIT;
