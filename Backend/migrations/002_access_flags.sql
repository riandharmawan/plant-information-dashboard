ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS can_view BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS can_edit BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS can_delete BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE role_permissions rp
SET can_view = p.can_view,
    can_edit = p.can_edit,
    can_delete = p.can_delete
FROM permissions p
WHERE p.id = rp.permission_id;

UPDATE role_permissions rp
SET can_edit = FALSE,
    can_delete = FALSE
FROM roles r
WHERE r.id = rp.role_id
  AND r.name = 'Viewer';
