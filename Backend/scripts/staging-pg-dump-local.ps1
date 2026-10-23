# Export local dev Postgres (pid-db) for staging restore. Run from repo root.
# Requires: docker compose dev stack with container pid-db.

$ErrorActionPreference = "Stop"
$dumpName = "pid_staging.dump"
$containerDump = "/tmp/$dumpName"

docker exec pid-db pg_dump -U pid_user -d pid_db -Fc -f $containerDump
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

docker cp "pid-db:${containerDump}" ".\$dumpName"
Write-Host "Wrote $dumpName — transfer to API server and pg_restore to ApsaraDB (see STAGING-3-SERVER-DEPLOY-RUNBOOK.md)."
