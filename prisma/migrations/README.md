# Prisma Migrations

This folder is the source of truth for schema evolution. From here forward, **never run `prisma db push` against any environment** — all schema changes go through migrations.

## Running migrations locally

Prisma CLI does not auto-load Next.js env files. Source `.env.local` first:

```bash
set -a; source .env.local; set +a
npx prisma migrate status        # check state
npx prisma migrate dev --name <name>   # create + apply a new migration
npx prisma migrate deploy        # apply pending migrations (CI / prod)
```

## Baseline

`0_init/` is the baseline of the schema as it existed on 2026-05-22. It was generated via `migrate diff --from-empty` and marked as applied via `migrate resolve --applied 0_init` (the SQL was never executed against the DB because the schema was already in sync).

## Naming

Migrations after the baseline use Prisma's default `YYYYMMDDHHMMSS_<name>/` format produced by `migrate dev`. Pick descriptive names tied to the phase (e.g. `20260523_phase1_additive`, `20260530_phase1_rename`).
