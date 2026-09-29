# Informejo Deployment Guide

This guide explains how to deploy Informejo to production with systemd.

## Prerequisites

- Node.js >= 20.19
- PostgreSQL database
- systemd
- sudo access to install a system service
- Docker (optional, for running PostgreSQL locally)

## Environment Setup

1. Create a `.env` file in the project root with the following variables:

```bash
# Database
DATABASE_URL="postgresql://username:password@host:port/database"

# NextAuth
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-secret-key"  # Generate with: openssl rand -base64 32

# Keycloak (optional)
KEYCLOAK_CLIENT_ID="your-client-id"
KEYCLOAK_CLIENT_SECRET="your-client-secret"
KEYCLOAK_ISSUER="https://your-keycloak-server.com/realms/your-realm"

# Email (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM="your-email@gmail.com"

# Application
APP_URL="https://your-domain.com"
```

## Production Deployment

### Option 1: Quick Deploy

Simply run the deployment script:

```bash
./scripts/deploy.sh
```

This script will:

1. Install dependencies
2. Build the application
3. Run database migrations
4. Remove a leftover PM2 process named `informejo`, if PM2 is still installed
5. Install and start the `informejo` systemd service

`informejo` and `informejo-dev` listen on the same port. The production script stops the dev service first.

### Option 2: Manual Deployment

```bash
npm ci
npm run build
npx prisma migrate deploy
chmod +x scripts/install-systemd-unit.sh deploy/start.sh
./scripts/install-systemd-unit.sh informejo production
sudo systemctl enable --now informejo
sudo systemctl restart informejo
```

## Development Deployment

To run a long-lived development process under systemd:

```bash
./scripts/deploy-dev.sh
```

This starts Docker when `docker-compose.yml` is present, installs dependencies, and enables `informejo-dev.service` with `NODE_ENV=development`.

For day-to-day work, `npm run dev` does not install a service.

## Service Management

```bash
systemctl status informejo
journalctl -u informejo -f
sudo systemctl restart informejo
sudo systemctl stop informejo
```

The app listens on port 3003 unless `PORT` is set in `.env`. `deploy/start.sh` loads `.env` before it starts `server.js`.

## Nginx Configuration (Recommended)

For production, it's recommended to use Nginx as a reverse proxy:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support for Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## SSL/HTTPS Setup

Use Certbot for free SSL certificates:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Database Migrations

### Run Migrations

```bash
npx prisma migrate deploy
```

### Create New Migration (Development)

```bash
npx prisma migrate dev --name migration_name
```

## Troubleshooting

### Check Logs

```bash
journalctl -u informejo -f
```

### Database Connection Issues

1. Check DATABASE_URL in `.env`
2. Ensure PostgreSQL is running
3. Verify database credentials
4. Check firewall settings

### Build Failures

1. Clear Next.js cache: `rm -rf .next`
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Check Node.js version: `node --version` (should be ^20.19, ^22.12, or >= 24)

### Port Already in Use

```bash
# Find process using port 3003
lsof -i :3003

# Kill process
kill -9 <PID>
```

## Performance

The systemd unit is a single process because Socket.IO and the schedule runner share that process. `MemoryMax=1G` stops the service if it exceeds 1GB, and `Restart=on-failure` starts it again.

## Backup

### Database Backup

```bash
pg_dump -U username -d quicket > backup_$(date +%Y%m%d).sql
```

### Restore Database

```bash
psql -U username -d quicket < backup_20250111.sql
```

## Updates

To update the application:

```bash
git pull
./scripts/deploy.sh
```

## Rollback

```bash
# Revert to previous commit
git reset --hard HEAD~1

# Redeploy
./scripts/deploy.sh
```

## Support

For issues, check:
- Application logs: `journalctl -u informejo`
- Database logs: Check PostgreSQL logs
