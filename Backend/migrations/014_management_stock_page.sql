-- Page right for the management Stock Overview. It is view-only and not tied to a site module.
-- Administrator gets it. A "Management Viewer" role holds just this right, so granting it is one click.
BEGIN;

INSERT INTO permissions (resource_type, resource_key, can_view, can_edit, can_delete)
SELECT 'page', 'management-stock', FALSE, FALSE, FALSE
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE resource_key = 'management-stock');

INSERT INTO role_permissions (role_id, permission_id, can_view, can_edit, can_delete)
SELECT r.id, p.id, TRUE, FALSE, FALSE
FROM roles r
JOIN permissions p ON p.resource_key = 'management-stock'
WHERE r.name = 'Administrator' AND r.is_system_role = TRUE
  AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

INSERT INTO roles (name, description, is_system_role)
SELECT 'Management Viewer', 'Sees the management Stock Overview for the sites they hold.', FALSE
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Management Viewer');

INSERT INTO role_permissions (role_id, permission_id, can_view, can_edit, can_delete)
SELECT r.id, p.id, TRUE, FALSE, FALSE
FROM roles r
JOIN permissions p ON p.resource_key = 'management-stock'
WHERE r.name = 'Management Viewer'
  AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

COMMIT;
