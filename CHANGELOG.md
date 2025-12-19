# Changelog

All notable changes to the Informejo project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### ✨ Added
- **Ticket Access Code**: Emails now display the full ticket UUID as "Access Code" instead of a truncated ID
- **Admin Shortcut**: Support for 12+ character ticket ID prefixes as an admin convenience feature

### 🔄 Changed
- **Email Format**: Changed "Ticket ID" to "Access Code" in ticket creation emails, displaying the full UUID
- **Magic Link Route**: Updated `/api/tickets/magic/[token]` to accept:
  - Full magic tokens (64 hex characters) - primary method for users
  - Full ticket UUIDs (32 or 36 characters, with or without dashes) - for direct ticket access
  - 12+ character ticket ID prefixes - admin shortcut feature
- **Removed**: 8-character ticket ID prefix support (replaced with 12+ character minimum)

### 📚 Documentation
- Updated CHANGELOG with ticket access code changes
- Documented admin shortcut feature for ticket ID prefixes

## [1.0.9] - 2025-12-09

### 🔒 Security
- **PATCHED** CVE-2025-55182 (React2Shell vulnerability) - Critical severity
- **PATCHED** CVE-2025-66478 (Next.js vulnerability) - Critical severity
- Updated Next.js from 16.0.1 to 16.0.8
- Updated React from 19.2.0 to 19.2.1
- Updated React-DOM from 19.2.0 to 19.2.1
- Zero npm audit vulnerabilities

### ⚠️ Breaking Changes
- **Node.js**: Minimum version increased from 18.18.0 to 20.19.0 (or 22.12+, 24+)
- **Prisma ORM**: Upgraded from 6.x to 7.1.0
  - Prisma client now generated to `src/generated/prisma/` instead of `node_modules/@prisma/client/`
  - All imports updated from `@prisma/client` to `@/generated/prisma/client`
  - Added PostgreSQL adapter with connection pooling
  - Created `prisma.config.ts` for Prisma 7 configuration

### ✨ Added
- npm scripts for semantic versioning:
  - `npm run version-major` - Bump major version (x.0.0)
  - `npm run version-minor` - Bump minor version (0.x.0)
  - `npm run version-patch` - Bump patch version (0.0.x)
- Comprehensive upgrade documentation:
  - `UPGRADE_GUIDE.md` - Step-by-step migration guide
  - Updated `README.md` with security information
  - Added troubleshooting section for Node.js and Prisma 7
- Created `CHANGELOG.md` for version tracking

### 🔄 Changed
- Database setup: Cleaned up multiple PostgreSQL containers, now using single `quicket-db-1` container
- Updated all import paths throughout codebase (11 files)
- Enhanced README with CVE patch status and version management instructions
- Updated package.json engine requirements to match Prisma 7 needs

### 📦 Dependencies
- `@prisma/client`: ^6.19.0 → ^7.1.0
- `@prisma/adapter-pg`: ^7.1.0 (new)
- `pg`: ^8.16.3 (new)
- `@types/pg`: ^8.11.10 (new, dev)
- `prisma`: ^7.1.0 (new, dev)
- `dotenv`: ^17.2.3 (new)
- `next`: 16.0.1 → 16.0.8
- `react`: 19.2.0 → 19.2.1
- `react-dom`: 19.2.0 → 19.2.1

### 🐛 Fixed
- Created placeholder `src/app/api/socket/route.ts` to fix Next.js 16 type validation errors during production builds
- Fixed Prisma 7 configuration to properly handle database connections
- Fixed pie chart display issue when only one priority item exists (now renders as full circle)

### 📚 Documentation
- Added security patch status to README
- Created comprehensive UPGRADE_GUIDE.md
- Updated prerequisites with new Node.js version requirements
- Added "Prisma 7 Migration Notes" section
- Added "Version Management" section with semantic versioning instructions
- Enhanced troubleshooting section with Node.js upgrade instructions

### 🔧 Technical Details

#### Files Modified (26 files)
**Configuration:**
- `package.json` - Version, scripts, dependencies, engines
- `package-lock.json` - Auto-updated with new dependencies
- `prisma/schema.prisma` - Removed datasource URL, updated output path
- `prisma.config.ts` - Created for Prisma 7
- `.gitignore` - Added `/src/generated/`

**Source Code:**
- `src/lib/prisma.ts` - Added PostgreSQL adapter and connection pooling
- `src/lib/auth.ts` - Updated Prisma imports
- `src/lib/seed-admin.ts` - Updated Prisma imports
- `src/types/index.ts` - Updated Prisma imports
- `src/types/next-auth.d.ts` - Updated Prisma imports
- `src/app/api/socket/route.ts` - Created placeholder
- `src/app/api/tickets/[id]/route.ts` - Updated Prisma imports
- `src/app/api/tickets/anonymous/route.ts` - Updated Prisma imports
- `src/app/api/tickets/route.ts` - Updated Prisma imports
- `src/app/api/admin/users/[id]/route.ts` - Updated Prisma imports
- `src/app/api/auth/register/route.ts` - Updated Prisma imports
- `src/app/api/stats/route.ts` - Updated Prisma imports
- `src/components/PriorityPieChart.tsx` - Fixed single-item display bug

**Documentation:**
- `README.md` - Security updates, version management, troubleshooting
- `UPGRADE_GUIDE.md` - Created comprehensive migration guide
- `CHANGELOG.md` - This file

#### Migration Commands
```bash
# Upgrade Node.js
nvm install --lts && nvm use --lts

# Clean install
rm -rf node_modules package-lock.json
npm install

# Apply migrations (fresh database)
npx prisma migrate deploy

# Verify
npm audit  # Should show 0 vulnerabilities
```

---

## [1.0.0] - 2024-11-11

### ✨ Initial Release

#### Features
**For Users:**
- Self-registration with email/password
- Create, view, and track support tickets
- Add comments to tickets
- Upload file attachments (up to 10MB)
- Real-time updates via WebSocket
- Email notifications for ticket updates
- Personal dashboard with ticket statistics
- Filter and search tickets

**For IT Admins:**
- SSO authentication via Keycloak OIDC
- System-wide ticket management dashboard
- Assign tickets to admins
- Set ticket status and priority
- Add internal notes
- Real-time notifications for new tickets
- Track average resolution times

**Technical Features:**
- Dual authentication: Local Credentials or Keycloak OIDC
- Real-time updates with Socket.io
- Email notifications with Nodemailer
- File upload support
- Modern, responsive UI with Tailwind CSS
- Role-based access control
- Comprehensive dashboard statistics

#### Tech Stack
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- NextAuth.js with Keycloak OIDC
- Socket.io
- Nodemailer

---

## Version Naming Convention

- **Major** (x.0.0): Breaking changes, significant new features
- **Minor** (0.x.0): New features, backwards compatible
- **Patch** (0.0.x): Bug fixes, security patches

Use the npm scripts for consistent versioning:
```bash
npm run version-patch  # 1.0.9 → 1.0.10
npm run version-minor  # 1.0.9 → 1.1.0
npm run version-major  # 1.0.9 → 2.0.0
```

---

## Links

- [Security Bulletin](https://vercel.com/changelog/cve-2025-55182)
- [Prisma 7 Docs](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7)
- [Upgrade Guide](./UPGRADE_GUIDE.md)
- [README](./README.md)

