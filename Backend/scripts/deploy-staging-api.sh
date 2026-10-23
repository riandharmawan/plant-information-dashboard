#!/usr/bin/env bash
# Staging API deploy — API server only (ApsaraDB RDS; no pid-db container).
#
# Usage (on API server):
#   export DEPLOY_BRANCH=sit
#   export RUN_MIGRATE=1
#   bash Backend/scripts/deploy-staging-api.sh deploy
#
# Rollback (does not reverse migrations):
#   bash Backend/scripts/deploy-staging-api.sh rollback

set -euo pipefail

REPO_DIR="${PID_REPO_DIR:-/opt/plant-information-dashboard}"
ROLLBACK_SHA_FILE="${PID_API_ROLLBACK_SHA_FILE:-/root/pid-staging-api-rollback-sha.txt}"
ROLLBACK_LOG_FILE="${PID_API_ROLLBACK_LOG_FILE:-/root/pid-staging-api-rollback-log.txt}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-sit}"
DEPLOY_COMMIT="${DEPLOY_COMMIT:-}"
RUN_MIGRATE="${RUN_MIGRATE:-}"
ENV_FILE="${PID_API_ENV_FILE:-Backend/.env}"
COMPOSE_FILE="${PID_API_COMPOSE:-docker-compose.backend-api-only.yml}"

cd "$REPO_DIR"

port_from_env() {
  local key="$1"
  local fallback="$2"
  local value="${!key:-}"
  if [[ -z "$value" && -f "$ENV_FILE" ]]; then
    value="$(awk -F= -v k="$key" '$1==k {print $2}' "$ENV_FILE" | tail -1 | tr -d '\r')"
  fi
  echo "${value:-$fallback}"
}

# SIT publishes 3011 on the shared API host; container listen port stays 3010.
API_PORT="$(port_from_env PID_API_PORT 3011)"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

require_env_file() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing $ENV_FILE — copy Backend/.env.staging.example and fill secrets (see Docs/Guide/STAGING-3-SERVER-DEPLOY-RUNBOOK.md)." >&2
    exit 1
  fi
}

save_rollback_point() {
  git fetch origin
  git rev-parse HEAD | tee "$ROLLBACK_SHA_FILE"
  git log -1 --oneline | tee "$ROLLBACK_LOG_FILE"
  echo "Rollback point saved:"
  cat "$ROLLBACK_SHA_FILE"
  cat "$ROLLBACK_LOG_FILE"
}

checkout_deploy_ref() {
  git fetch origin
  git checkout "$DEPLOY_BRANCH"
  git pull origin "$DEPLOY_BRANCH"
  if [[ -n "$DEPLOY_COMMIT" ]]; then
    git checkout "$DEPLOY_COMMIT"
  fi
  git log -1 --oneline
}

rebuild_api() {
  require_env_file
  compose build --no-cache pid-api
  compose up -d pid-api
  compose ps
  compose logs --tail=25 pid-api
  curl -sS "http://127.0.0.1:${API_PORT}/api/v1/health"
  echo
  if [[ "$RUN_MIGRATE" == "1" ]]; then
    echo "=== Running migrations (RUN_MIGRATE=1) ==="
    compose exec -T pid-api npm run migrate
  else
    echo "Migrations skipped (set RUN_MIGRATE=1 to apply Backend/migrations)."
  fi
}

cmd_deploy() {
  echo "=== 1/3 Save rollback point (API server) ==="
  save_rollback_point
  echo "=== 2/3 Checkout ${DEPLOY_BRANCH}${DEPLOY_COMMIT:+ @ ${DEPLOY_COMMIT}} ==="
  checkout_deploy_ref
  echo "=== 3/3 Rebuild API (pid-api) ==="
  rebuild_api
  echo "Deploy complete. curl http://127.0.0.1:${API_PORT}/api/v1/health"
}

cmd_rollback() {
  local sha="${ROLLBACK_SHA:-}"
  if [[ -z "$sha" ]]; then
    if [[ ! -f "$ROLLBACK_SHA_FILE" ]]; then
      echo "Missing $ROLLBACK_SHA_FILE — set SHA manually: export ROLLBACK_SHA=<sha>" >&2
      exit 1
    fi
    sha="$(cat "$ROLLBACK_SHA_FILE")"
  fi
  echo "Rolling back API to $sha (migrations are not reversed)"
  git fetch origin
  git checkout "$sha"
  git log -1 --oneline
  RUN_MIGRATE=""
  rebuild_api
  echo "Rollback complete."
}

case "${1:-}" in
  deploy) cmd_deploy ;;
  rollback) cmd_rollback ;;
  *)
    echo "Usage: $0 deploy|rollback" >&2
    exit 1
    ;;
esac
