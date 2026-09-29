#!/bin/bash

# Informejo Development Deployment Script
# Starts local dependencies and runs the app under systemd in development mode.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "🚀 Starting development deployment..."

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [[ ! -f .env ]]; then
  echo -e "${RED}❌ Error: .env file not found!${NC}"
  echo "Please create a .env file with the required environment variables."
  exit 1
fi

if [[ -f docker-compose.yml ]]; then
  echo -e "${YELLOW}🐳 Starting Docker containers...${NC}"
  docker compose up -d
fi

echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

if command -v pm2 >/dev/null 2>&1; then
  echo -e "${YELLOW}🛑 Removing leftover PM2 process (if any)...${NC}"
  pm2 delete informejo-dev >/dev/null 2>&1 || true
  pm2 delete informejo >/dev/null 2>&1 || true
  pm2 save >/dev/null 2>&1 || true
fi

echo -e "${YELLOW}⚙️  Installing development systemd service...${NC}"
chmod +x "$ROOT/scripts/install-systemd-unit.sh" "$ROOT/deploy/start.sh"
sudo systemctl disable --now informejo >/dev/null 2>&1 || true
"$ROOT/scripts/install-systemd-unit.sh" informejo-dev development
sudo systemctl enable --now informejo-dev
sudo systemctl restart informejo-dev

echo -e "${GREEN}✅ Development deployment complete!${NC}"
echo ""
echo "Local development without systemd is still: npm run dev"
echo ""
echo "Useful commands:"
echo "  systemctl status informejo-dev       - Check application status"
echo "  journalctl -u informejo-dev -f       - Follow application logs"
echo "  sudo systemctl restart informejo-dev - Restart the application"
echo "  sudo systemctl stop informejo-dev    - Stop the application"
