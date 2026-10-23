#!/usr/bin/env bash
# Restore pid_staging.dump into ApsaraDB. Run on API server (or any host with RDS network access).
#
#   export RDS_HOST='pgm-….rds.aliyuncs.com'
#   export RDS_USER='pid_user'
#   export RDS_DB='pid_db'
#   export PGPASSWORD='…'
#   bash Backend/scripts/staging-pg-restore-rds.sh [path/to/pid_staging.dump]
#
# Compare counts to Backend/backups/staging-local-dump-baseline.txt after restore.

set -euo pipefail

DUMP="${1:-pid_staging.dump}"

: "${RDS_HOST:?Set RDS_HOST}"
: "${RDS_USER:?Set RDS_USER}"
: "${RDS_DB:?Set RDS_DB}"
: "${PGPASSWORD:?Set PGPASSWORD}"

echo "=== pg_isready ==="
pg_isready -h "$RDS_HOST" -p 5432 -U "$RDS_USER" -d "$RDS_DB"

echo "=== pg_restore ==="
pg_restore -h "$RDS_HOST" -U "$RDS_USER" -d "$RDS_DB" --clean --if-exists --no-owner --no-acl "$DUMP" || {
  echo "Retry without --clean (empty database)…"
  pg_restore -h "$RDS_HOST" -U "$RDS_USER" -d "$RDS_DB" --no-owner --no-acl "$DUMP"
}

echo "=== Verification ==="
psql -h "$RDS_HOST" -U "$RDS_USER" -d "$RDS_DB" -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'soundings' AS rel, COUNT(*)::text AS n FROM soundings
UNION ALL SELECT 'schema_migrations', COUNT(*)::text FROM schema_migrations
UNION ALL SELECT 'users', COUNT(*)::text FROM users;
SQL

echo "Restore complete."
