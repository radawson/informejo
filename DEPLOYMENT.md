# Deployment Guide - IT Ticket System

This guide covers deploying the IT ticket system on Ubuntu with nginx.

## Prerequisites

- Ubuntu 20.04+ server
- Node.js 18+ and npm
- PostgreSQL 14+
- nginx
- Domain name (optional, can use IP)

## 1. Server Setup

### Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install nginx
sudo apt install -y nginx

# Install PM2 for process management
sudo npm install -g pm2
```

### Setup PostgreSQL

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL shell:
CREATE DATABASE ticketdb;
CREATE USER ticketuser WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE ticketdb TO ticketuser;
\q
```

## 2. Application Setup

### Clone and Install

```bash
# Create application directory
sudo mkdir -p /var/www/tickets
sudo chown $USER:$USER /var/www/tickets

# Copy your application files to /var/www/tickets
cd /var/www/tickets

# Install dependencies
npm install

# Create uploads directory
mkdir -p uploads
chmod 755 uploads
```

### Environment Configuration

Create `/var/www/tickets/.env`:

```bash
# Database
DATABASE_URL="postgresql://ticketuser:your_secure_password@localhost:5432/ticketdb?schema=public"

# NextAuth
NEXTAUTH_URL="https://your-domain.com"  # or http://your-ip:3000
NEXTAUTH_SECRET="generate_with_openssl_rand_base64_32"

# Keycloak OIDC (for IT Admins)
KEYCLOAK_ID="your-keycloak-client-id"
KEYCLOAK_SECRET="your-keycloak-client-secret"
KEYCLOAK_ISSUER="https://your-keycloak-server/realms/your-realm"

# Email (SMTP)
SMTP_HOST="localhost"  # or your SMTP server
SMTP_PORT="587"
SMTP_USER="your-email@example.com"
SMTP_PASSWORD="your-smtp-password"
SMTP_FROM="IT Support <support@example.com>"

# App
NEXT_PUBLIC_APP_URL="https://your-domain.com"  # or http://your-ip:3000
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE="10485760"
```

Generate NextAuth secret:
```bash
openssl rand -base64 32
```

### Database Migration

```bash
# Run Prisma migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### Build Application

```bash
npm run build
```

## 3. SMTP Setup (Optional - Local Postfix)

If you want to use local SMTP:

```bash
# Install Postfix
sudo apt install -y postfix

# During installation, select "Internet Site"
# Set system mail name to your domain

# Configure Postfix for local delivery
sudo nano /etc/postfix/main.cf

# Update these lines:
# inet_interfaces = loopback-only
# mydestination = localhost

# Restart Postfix
sudo systemctl restart postfix
```

For production, use a service like SendGrid, AWS SES, or your organization's SMTP server.

## 4. PM2 Process Management

Create PM2 ecosystem file `/var/www/tickets/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'it-tickets',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/tickets',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

Start the application:

```bash
cd /var/www/tickets
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow the instructions to enable startup on boot
```

## 5. nginx Configuration

Create `/etc/nginx/sites-available/tickets`:

```nginx
# Upstream for Next.js application
upstream nextjs_tickets {
    server 127.0.0.1:3000;
    keepalive 64;
}

# HTTP Server - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com www.your-domain.com;  # Change to your domain or IP

    # Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com www.your-domain.com;  # Change to your domain

    # SSL Configuration (adjust paths based on your certificate location)
    ssl_certificate /etc/ssl/certs/your-domain.crt;
    ssl_certificate_key /etc/ssl/private/your-domain.key;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Max upload size (for file attachments)
    client_max_body_size 10M;

    # Logging
    access_log /var/log/nginx/tickets-access.log;
    error_log /var/log/nginx/tickets-error.log;

    # Serve static uploads
    location /uploads/ {
        alias /var/www/tickets/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Next.js static files
    location /_next/static/ {
        proxy_pass http://nextjs_tickets;
        proxy_cache_valid 200 60m;
        add_header Cache-Control "public, immutable";
    }

    # Socket.io WebSocket support
    location /api/socket/io {
        proxy_pass http://nextjs_tickets;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 86400;
    }

    # All other requests
    location / {
        proxy_pass http://nextjs_tickets;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
    }
}
```

### For Development/Testing (HTTP only):

If you don't have SSL certificates yet, use this simpler configuration:

```nginx
upstream nextjs_tickets {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;  # or use _ for any domain/IP

    client_max_body_size 10M;

    access_log /var/log/nginx/tickets-access.log;
    error_log /var/log/nginx/tickets-error.log;

    location /uploads/ {
        alias /var/www/tickets/uploads/;
        expires 30d;
    }

    location /api/socket/io {
        proxy_pass http://nextjs_tickets;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_buffering off;
    }

    location / {
        proxy_pass http://nextjs_tickets;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Enable the site:

```bash
# Test nginx configuration
sudo nginx -t

# Enable the site
sudo ln -s /etc/nginx/sites-available/tickets /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Reload nginx
sudo systemctl reload nginx
```

## 6. SSL Certificate (Let's Encrypt)

For production, use Let's Encrypt for free SSL:

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate (this will auto-configure nginx)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

## 7. Firewall Configuration

```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'

# Check status
sudo ufw status
```

## 8. Monitoring and Maintenance

### Check Application Status

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs it-tickets

# Restart application
pm2 restart it-tickets
```

### Check nginx Status

```bash
# Check nginx status
sudo systemctl status nginx

# View error logs
sudo tail -f /var/log/nginx/tickets-error.log

# Reload nginx after config changes
sudo nginx -t && sudo systemctl reload nginx
```

### Database Backup

```bash
# Create backup script
sudo nano /usr/local/bin/backup-tickets-db.sh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/tickets"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
pg_dump -U ticketuser ticketdb | gzip > $BACKUP_DIR/backup_$DATE.sql.gz
# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
```

```bash
# Make executable
sudo chmod +x /usr/local/bin/backup-tickets-db.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-tickets-db.sh
```

## 9. Keycloak OIDC Configuration

In your Keycloak admin console:

1. Create a new client
   - Client ID: `it-tickets`
   - Client Protocol: `openid-connect`
   - Access Type: `confidential`

2. Set Valid Redirect URIs:
   - `https://your-domain.com/api/auth/callback/keycloak`

3. Copy Client Secret to your `.env` file

4. Create realm roles or groups for IT admins

## Troubleshooting

### Application won't start
```bash
pm2 logs it-tickets  # Check logs
pm2 restart it-tickets  # Restart
```

### Database connection issues
```bash
# Test connection
psql -U ticketuser -d ticketdb -h localhost
```

### nginx 502 errors
```bash
# Check if app is running
pm2 status
# Check nginx error log
sudo tail -f /var/log/nginx/tickets-error.log
```

### File uploads failing
```bash
# Check permissions
ls -la /var/www/tickets/uploads
sudo chown -R $USER:$USER /var/www/tickets/uploads
chmod 755 /var/www/tickets/uploads
```

## Updating the Application

```bash
cd /var/www/tickets

# Pull latest changes (if using git)
git pull

# Install new dependencies
npm install

# Run migrations
npx prisma migrate deploy

# Rebuild
npm run build

# Restart
pm2 restart it-tickets
```

## Security Recommendations

1. **Use SSL/TLS** - Always use HTTPS in production
2. **Strong passwords** - Use strong database and SMTP passwords
3. **Keep updated** - Regularly update Node.js, npm packages, and system packages
4. **Firewall** - Only open necessary ports
5. **Regular backups** - Automate database backups
6. **Monitor logs** - Regularly check application and nginx logs
7. **Environment variables** - Never commit `.env` to version control
8. **Keycloak** - Use Keycloak for admin authentication for better security

## Support

For issues or questions, check the logs:
- Application: `pm2 logs it-tickets`
- nginx: `/var/log/nginx/tickets-error.log`
- PostgreSQL: `/var/log/postgresql/postgresql-*-main.log`

