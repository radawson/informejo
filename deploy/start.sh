#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Node parses the env file itself. Sourcing it in the shell would expand
# `$` and command substitutions inside credentials.
export NODE_ENV="${NODE_ENV:-production}"
args=()
if [[ -f .env ]]; then
  args+=(--env-file=.env)
fi

exec "${INFORMEJO_NODE_BIN:-node}" "${args[@]}" server.js
