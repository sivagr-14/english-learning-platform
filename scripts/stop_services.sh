#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if command -v docker >/dev/null 2>&1; then
  COMPOSE_CMD="$(command -v docker) compose"
else
  COMPOSE_CMD="$(command -v docker-compose)"
fi

cd "$REPO_ROOT"
# shellcheck disable=SC2086
$COMPOSE_CMD down --remove-orphans
