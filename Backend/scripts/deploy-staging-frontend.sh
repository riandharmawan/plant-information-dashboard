#!/usr/bin/env bash
# Staging frontend deploy — App server only.
#
# Usage (on App server):
#   export DEPLOY_BRANCH=sit
#   bash Backend/scripts/deploy-staging-frontend.sh deploy
#
# Rollback:
#   bash Backend/scripts/deploy-staging-frontend.sh rollback

set -euo pipefail

REPO_DIR="${PID_REPO_DIR:-/opt/plant-information-dashboard}"
ROLLBACK_SHA_FILE="${PID_APP_ROLLBACK_SHA_FILE:-/root/pid-staging-app-rollback-sha.txt}"
ROLLBACK_LOG_FILE="${PID_APP_ROLLBACK_LOG_FILE:-/root/pid-staging-app-rollback-log.txt}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-sit}"
DEPLOY_COMMIT="${DEPLOY_COMMIT:-}"
ENV_FILE="${PID_APP_ENV_FILE:-.env}"
COMPOSE_FILE="${PID_APP_COMPOSE:-docker-compose.app.yml}"
FE_PORT="${PID_FE_PORT:-3090}"

cd "$REPO_DIR"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

require_env_file() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing $ENV_FILE — copy .env.staging.example to .env on the app host." >&2
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

rebuild_app() {
  require_env_file
  compose build --no-cache pid-web
  compose up -d
  compose ps
  curl -sS -o /dev/null -w "SPA HTTP %{http_code}\n" "http://127.0.0.1:${FE_PORT}/"
  curl -sS "http://127.0.0.1:${FE_PORT}/api/v1/health"
  echo
}

cmd_deploy() {
  echo "=== 1/3 Save rollback point (App server) ==="
  save_rollback_point
  echo "=== 2/3 Checkout ${DEPLOY_BRANCH}${DEPLOY_COMMIT:+ @ ${DEPLOY_COMMIT}} ==="
  checkout_deploy_ref
  echo "=== 3/3 Rebuild frontend (pid-web) ==="
  rebuild_app
  echo "Deploy complete. Open http://<APP_PUBLIC>:${FE_PORT}"
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
  echo "Rolling back App to $sha"
  git fetch origin
  git checkout "$sha"
  git log -1 --oneline
  rebuild_app
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
