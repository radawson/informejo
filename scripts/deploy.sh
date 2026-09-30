#!/bin/bash

# Informejo Deployment Script
# Builds the application and runs it as a systemd service.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "🚀 Starting deployment..."

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [[ ! -f .env ]]; then
  echo -e "${RED}❌ Error: .env file not found!${NC}"
  echo "Please create a .env file with the required environment variables."
  exit 1
fi

echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm ci

echo -e "${YELLOW}🔨 Building application...${NC}"
npm run build

echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
npx prisma migrate deploy

echo -e "${YELLOW}🧹 Cleaning up dev dependencies...${NC}"
npm prune --omit=dev

if command -v pm2 >/dev/null 2>&1; then
  echo -e "${YELLOW}🛑 Removing leftover PM2 process (if any)...${NC}"
  pm2 delete informejo >/dev/null 2>&1 || true
  pm2 save >/dev/null 2>&1 || true
fi

echo -e "${YELLOW}⚙️  Installing systemd service...${NC}"
chmod +x "$ROOT/scripts/install-systemd-unit.sh" "$ROOT/deploy/start.sh"
sudo systemctl disable --now informejo-dev >/dev/null 2>&1 || true
"$ROOT/scripts/install-systemd-unit.sh" informejo production
sudo systemctl enable --now informejo
sudo systemctl restart informejo

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Useful commands:"
echo "  systemctl status informejo          - Check application status"
echo "  journalctl -u informejo -f          - Follow application logs"
echo "  sudo systemctl restart informejo    - Restart the application"
echo "  sudo systemctl stop informejo       - Stop the application"
