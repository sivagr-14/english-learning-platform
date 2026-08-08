#!/usr/bin/env bash
set -euo pipefail

# Start the application's docker-compose services and wait for health endpoints.
# Logs are written to ~/Library/Logs/english_mastery/start_services.log

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$HOME/Library/Logs/english_mastery"
LOG_FILE="$LOG_DIR/start_services.log"

mkdir -p "$LOG_DIR"

echo "=== Starting services at $(date -u +%FT%TZ) ===" >> "$LOG_FILE"

# Prefer `docker` + `compose` if available, otherwise fallback to docker-compose
if command -v docker >/dev/null 2>&1; then
  DOCKER_CMD="$(command -v docker)"
  COMPOSE_CMD="$DOCKER_CMD compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="$(command -v docker-compose)"
else
  echo "docker or docker-compose not found" | tee -a "$LOG_FILE"
  exit 1
fi

cd "$REPO_ROOT"

# Bring up containers
echo "Running: $COMPOSE_CMD up -d --remove-orphans" >> "$LOG_FILE"
# shellcheck disable=SC2086
$COMPOSE_CMD up -d --remove-orphans >> "$LOG_FILE" 2>&1

# Helper: wait for HTTP endpoint
wait_for_url() {
  url="$1"
  timeout=${2:-60}
  interval=2
  elapsed=0
  echo "Waiting for $url (timeout ${timeout}s)" >> "$LOG_FILE"
  while true; do
    if curl -sSf --max-time 5 "$url" >/dev/null 2>&1; then
      echo "$url is healthy" >> "$LOG_FILE"
      return 0
    fi
    sleep $interval
    elapsed=$((elapsed + interval))
    if [ $elapsed -ge $timeout ]; then
      echo "Timeout waiting for $url" >> "$LOG_FILE"
      return 1
    fi
  done
}

# The backend health endpoint includes generation-worker readiness. A 200
# therefore proves backend, Redis and the BullMQ worker are all available.
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://localhost:5001/health}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"

if ! wait_for_url "$BACKEND_HEALTH_URL" 60; then
  echo "Backend failed to become healthy" | tee -a "$LOG_FILE"
fi

# Frontend (Next) - main page
if ! wait_for_url "$FRONTEND_URL" 60; then
  echo "Frontend failed to become healthy" | tee -a "$LOG_FILE"
fi

echo "=== Services started at $(date -u +%FT%TZ) ===" >> "$LOG_FILE"

exit 0
