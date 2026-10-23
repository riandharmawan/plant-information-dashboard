-- F/TNF-004 projection. Matches Docs/DATABASE-DESIGN.md, Monitor Masuk dan Keluar Minyak.

BEGIN;

CREATE TABLE oil_movement_days (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL,
  plant_id TEXT NOT NULL,
  submission_id BIGINT NOT NULL REFERENCES logsheet_submissions(id),
  movement_date DATE NOT NULL,
  UNIQUE (submission_id),
  UNIQUE (site_id, movement_date),
  FOREIGN KEY (plant_id, site_id) REFERENCES plants (id, site_id)
);

CREATE INDEX oil_movement_days_site_date_idx
  ON oil_movement_days (site_id, movement_date);

CREATE TABLE oil_movements (
  id BIGSERIAL PRIMARY KEY,
  day_id BIGINT NOT NULL REFERENCES oil_movement_days(id) ON DELETE CASCADE,
  row_index INT NOT NULL,
  vehicle TEXT NOT NULL,
  commodity_text TEXT NOT NULL,
  commodity_id TEXT REFERENCES commodities(id),
  time_in TEXT,
  time_out TEXT,
  customer TEXT,
  seal_in TEXT,
  seal_out TEXT,
  operator TEXT,
  remark TEXT,
  tank_text TEXT,
  tank_id TEXT REFERENCES tanks(id),
  UNIQUE (day_id, row_index)
);

COMMIT;
