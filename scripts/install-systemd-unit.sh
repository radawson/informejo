#!/usr/bin/env bash
# Install or replace an Informejo systemd unit.
# Usage: ./scripts/install-systemd-unit.sh <unit-name> <NODE_ENV>
set -euo pipefail

NAME="${1:?unit name required}"
NODE_ENV="${2:?NODE_ENV required}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_USER="${INFORMEJO_SERVICE_USER:-${SUDO_USER:-$USER}}"
NODE_BIN="${INFORMEJO_NODE_BIN:-$(command -v node)}"

if [[ -z "$NODE_BIN" ]]; then
  echo "node was not found on PATH" >&2
  exit 1
fi

UNIT_PATH="/etc/systemd/system/${NAME}.service"
TMP_UNIT="$(mktemp)"

cat > "$TMP_UNIT" <<EOF
[Unit]
Description=Informejo (${NODE_ENV})
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${ROOT}
Environment=NODE_ENV=${NODE_ENV}
Environment=INFORMEJO_NODE_BIN=${NODE_BIN}
ExecStart=/bin/bash ${ROOT}/deploy/start.sh
Restart=on-failure
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=15
MemoryMax=1G

[Install]
WantedBy=multi-user.target
EOF

chmod +x "${ROOT}/deploy/start.sh"
sudo cp "$TMP_UNIT" "$UNIT_PATH"
rm -f "$TMP_UNIT"
sudo systemctl daemon-reload
echo "Installed ${UNIT_PATH}"
