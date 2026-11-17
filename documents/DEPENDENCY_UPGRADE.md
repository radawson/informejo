# Dependency refresh — November 17, 2026

Use Node.js 24 (`nvm use`), then `npm ci`. Node.js 20 is no longer supported by the development dependency set.

## Major migrations

- FullCalendar 6 → 7.1.5: standard plugins now come from `@fullcalendar/react/*`; callback types come from `@fullcalendar/react`. The classic theme and stylesheets are imported explicitly. Temporal replaces the Luxon timezone plugin, preserving the organization timezone. Luxon remains in use by the recurrence engine.
- Nodemailer 7 → 10.6.0: the package includes its own types, so `@types/nodemailer` is removed. A scoped npm override updates NextAuth's optional Nodemailer peer requirement. Authentication uses credentials and Keycloak, without NextAuth's email provider. Reassess this override before adding an email authentication provider.
- TypeScript 5 → 6.0.3: pinned to the 6.0 patch line because the installed `typescript-eslint` parser requires TypeScript `<6.1`. TypeScript 7 cannot replace the parser's JavaScript compiler API yet.
- ESLint uses a flat configuration and the ESLint CLI because Next.js 16 removed `next lint`. The unused `@eslint/eslintrc` dependency is removed.

## Release constraints

All direct dependencies were checked against npm release tags, including major versions. Next.js 16.4.6, React 19.3.1, and the Prisma 7.10.1 client/adapter already use current stable releases. Keep the Prisma CLI aligned at 7.10.1: its `latest` tag currently points to `8.0.0-rc.34`, while the client and PostgreSQL adapter remain on stable 7.10.1. NextAuth 5 is also still beta.

The lockfile also refreshes transitive dependencies within upstream ranges. npm reports stale ESLint 9 peer ranges from the React, accessibility, and import plugins bundled by `eslint-config-next`; Next.js 16.4 supports ESLint 10 and supplies compatibility wrappers. Do not use `--legacy-peer-deps` for installation.

## Validation

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run lint
npm audit
```

The build requires network access for the Google Inter font. Calendar regression tests exercise the real FullCalendar implementation. Existing recurrence checks and Nodemailer's local stream transport can run without a database or SMTP server.

The newly working lint command exposes existing application issues: synchronous state updates in effects, unescaped apostrophes, and missing effect dependencies. These remain visible for a separate application cleanup; lint rules have not been disabled.

After the mailer upgrade, npm audit reports no high or critical findings. Remaining moderate findings come from Jest's development-only `glob`/`minimatch` dependencies. Upstream ranges do not yet permit their fixed major versions; avoid forcing those transitive majors or downgrading Jest via `npm audit fix --force`.
