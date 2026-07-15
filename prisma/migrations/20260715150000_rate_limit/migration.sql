-- Launch hardening: fixed-window rate-limit counters (auth + checkout abuse
-- protection). Composite PK doubles as the lookup index.
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key","windowStart")
);
