# Smoke-test docker-compose.backend-api-only.yml against local Postgres on 127.0.0.1:5437.
# Does not replace ECS deploy; validates the API image and compose file.

$ErrorActionPreference = "Stop"
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $root

$envFile = Join-Path $root "Backend\.env.staging.smoke"
@"
APP_ENV=testing
NODE_ENV=production
PORT=3010
DB_HOST=host.docker.internal
DB_PORT=5437
POSTGRES_USER=pid_user
POSTGRES_PASSWORD=pid_dev_password
POSTGRES_DB=pid_db
JWT_SECRET=smoke-test-jwt
CORS_ORIGIN=http://127.0.0.1:3090
COOKIE_SECURE=false
"@ | Set-Content -Encoding utf8 $envFile

docker compose --env-file $envFile -f docker-compose.backend-api-only.yml up -d --build
Start-Sleep -Seconds 5
curl.exe -s http://127.0.0.1:3010/api/v1/health
Write-Host ""
docker compose --env-file $envFile -f docker-compose.backend-api-only.yml ps
