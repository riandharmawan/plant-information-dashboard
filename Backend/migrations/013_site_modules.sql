-- Which modules each site uses. A site has data for some modules only (Bontang and Tanjung Pura
-- are read from tank gauges, so they have the Tank & Stock Dashboard and nothing else yet).
-- A module is on for a site when a row exists here. Master data and Administration are not site modules.
CREATE TABLE IF NOT EXISTS site_modules (
  site_id    TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (site_id, module_key),
  CONSTRAINT chk_site_modules_key CHECK (module_key IN ('live-ops', 'qc', 'utility', 'daily-production'))
);

-- Existing sites keep what they have today: every module. Gauge-only sites get the tank dashboard.
INSERT INTO site_modules (site_id, module_key)
SELECT s.id, m.key
FROM sites s
CROSS JOIN (VALUES ('live-ops'), ('qc'), ('utility'), ('daily-production')) AS m(key)
WHERE s.id NOT IN ('bontang', 'tanjung-pura')
ON CONFLICT DO NOTHING;

INSERT INTO site_modules (site_id, module_key)
SELECT s.id, 'live-ops' FROM sites s WHERE s.id IN ('bontang', 'tanjung-pura')
ON CONFLICT DO NOTHING;
