-- Which companies and sites this application uses.
-- DataHub holds many; only the ones switched on here are offered to users and site lists.
-- The structure stops at the site. Plant rows stay as an internal key for the logsheet data.

BEGIN;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_activated BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS is_activated BOOLEAN NOT NULL DEFAULT FALSE;

-- Rows that already carry data or users keep working: a site with logsheets or assigned users is on,
-- and so is its company.
UPDATE sites s SET is_activated = TRUE
WHERE EXISTS (SELECT 1 FROM logsheet_definitions d WHERE d.site_id = s.id)
   OR EXISTS (SELECT 1 FROM user_sites us WHERE us.site_id = s.id);

UPDATE companies c SET is_activated = TRUE
WHERE EXISTS (SELECT 1 FROM sites s WHERE s.company_id = c.id AND s.is_activated);

COMMIT;
