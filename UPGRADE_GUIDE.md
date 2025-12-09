# Upgrade Guide: CVE-2025-55182 & Prisma 7

This guide covers upgrading the Informejo project to address the React2Shell security vulnerability (CVE-2025-55182) and the required Prisma 7 upgrade.

## What Changed

### Security Updates
- **Next.js**: 16.0.1 → 16.0.8 (fixes CVE-2025-66478)
- **React**: 19.2.0 → 19.2.1 (fixes CVE-2025-55182)

### Breaking Changes
- **Prisma ORM**: 6.x → 7.1.0
- **Node.js Minimum**: 18.18.0 → 20.19.0 (or 22.12+, 24+)
- **Prisma Client Location**: `node_modules/@prisma/client` → `src/generated/prisma/client`

## Prerequisites

### Node.js Version Requirement
Prisma 7 requires **one of these Node.js versions**:
- Node.js **20.19+**
- Node.js **22.12+** 
- Node.js **24.0+**

**Important**: Node.js 22.11.0 and earlier are **NOT compatible** with Prisma 7.

## Upgrade Steps

### 1. Check Your Node.js Version

```bash
node --version
```

If your version doesn't meet the requirements above, upgrade:

#### Using nvm (Recommended)

```bash
# Install latest LTS version (currently v24.x)
nvm install --lts
nvm use --lts

# Verify
node --version  # Should show v24.11.1 or later
```

#### Using nvm with specific version

```bash
# Install Node.js 22.12 or later
nvm install 22.12
nvm use 22.12
```

### 2. Clean Install Dependencies

```bash
# Remove old dependencies
rm -rf node_modules package-lock.json

# Install new dependencies
npm install
```

This will:
- Install Prisma 7.1.0
- Install Next.js 16.0.8
- Install React 19.2.1
- Automatically run `npx prisma generate` via postinstall script

### 3. Verify Prisma Client Generation

The Prisma client should be automatically generated during `npm install`. Verify it exists:

```bash
ls -la src/generated/prisma/
```

You should see the generated Prisma client files.

### 4. Test the Application

```bash
# Development
npm run dev

# Production build
npm run build
npm start
```

## Remote Server Deployment

### For Production Servers

1. **SSH into your production server**

```bash
ssh user@your-server.com
cd ~/informejo  # Or your project path
```

2. **Upgrade Node.js**

```bash
# Using nvm
nvm install --lts
nvm use --lts

# Verify
node --version  # Should be 24.11.1 or later
```

3. **Pull the latest code**

```bash
git pull origin main  # Or your branch name
```

4. **Clean install and rebuild**

```bash
# Stop the application
pm2 stop informejo

# Clean install
rm -rf node_modules package-lock.json
npm install

# Build
npm run build

# Restart
pm2 restart informejo
pm2 save
```

5. **Verify deployment**

```bash
# Check PM2 status
pm2 status

# Check logs for errors
pm2 logs informejo --lines 50
```

## Troubleshooting

### Issue: "Prisma only supports Node.js versions 20.19+, 22.12+, 24.0+"

**Solution**: Your Node.js version is too old. Upgrade using the steps above.

```bash
# Check version
node --version

# If it shows v22.11.0 or earlier, upgrade:
nvm install --lts
nvm use --lts
```

### Issue: "Cannot find module '@prisma/client'"

**Solution**: The import paths have changed. All imports should now use `@/generated/prisma/client`.

This has already been updated in the codebase. If you see this error:
1. Make sure you pulled the latest code
2. Run `npx prisma generate`
3. Clear your TypeScript cache: `rm -rf .next`

### Issue: "Failed to load config file prisma.config.ts"

**Solution**: This file is no longer needed. Delete it if it exists:

```bash
rm prisma.config.ts
```

### Issue: Build fails with type errors

**Solution**: Regenerate Prisma client and rebuild:

```bash
npx prisma generate
rm -rf .next
npm run build
```

## Verification Checklist

After upgrading, verify these items:

- [ ] Node.js version is 20.19+, 22.12+, or 24+
- [ ] `npm install` completes without errors
- [ ] Prisma client is generated in `src/generated/prisma/`
- [ ] Application builds successfully (`npm run build`)
- [ ] Application runs without errors (`npm run dev` or `npm start`)
- [ ] Database connections work
- [ ] Tickets can be created and viewed
- [ ] Real-time updates work (WebSockets)

## References

- [CVE-2025-55182 Security Bulletin](https://vercel.com/changelog/cve-2025-55182)
- [Prisma 7 Upgrade Guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7)
- [Next.js 16 Release Notes](https://nextjs.org/blog/next-16)

## Need Help?

If you encounter issues not covered in this guide:

1. Check the application logs: `pm2 logs informejo`
2. Check npm install logs for specific errors
3. Verify all environment variables are set correctly in `.env`
4. Ensure PostgreSQL is running and accessible

## Rollback Instructions

If you need to rollback (not recommended due to security vulnerabilities):

```bash
git checkout <previous-commit-hash>
nvm use 18  # Or your previous Node version
rm -rf node_modules package-lock.json
npm install
npm run build
pm2 restart informejo
```

**Warning**: Rolling back will leave you vulnerable to CVE-2025-55182. Only do this temporarily while debugging.

