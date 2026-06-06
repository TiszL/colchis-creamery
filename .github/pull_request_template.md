<!-- Keep this short but real. Vercel Agent + reviewers read it as context. -->

## What
<!-- What does this PR change, in one or two sentences? -->

## Why
<!-- The problem / motivation. Link any issue or screenshot. -->

## Risk / blast radius
<!-- Which areas could this affect? cart/checkout · RBAC/auth · Stripe webhooks ·
     Prisma schema · B2B portal scoping · the prospect map (DO NOT TOUCH). -->

## How tested
<!-- No automated tests in this repo — say what you actually checked. -->
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run build` passes
- [ ] Manual check (describe):

## Checklist
- [ ] No secrets committed; `.env*` untouched
- [ ] Schema change → hand-written migration + `prisma migrate deploy` (never `prisma db push`)
- [ ] Auth gated via `getSession()` / `authorize()` / `requireLocationAccess()` (no raw `verifyToken`/`jwtVerify`)
- [ ] Did **not** touch the prospect map (`/admin/analytics-control`, `AnalyticsMap`/`AnalyticsPinForm`)
