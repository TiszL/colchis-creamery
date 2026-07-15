# Colchis Food — Production Launch Runbook

Written 2026-07-15 after the launch-readiness audit (63 findings, 24 blocker/high
confirmed) and the four hardening PRs (#20 payments, #21 timezone, #22 anti-abuse,
#23 ops). Follow top to bottom. Steps marked 🖥 happen in a dashboard, not code.

---

## Phase A — before touching keys (any day before launch)

1. 🖥 **DoorDash Drive production access** — apply in the DoorDash developer
   portal (business verification takes days). Until approved, keep sandbox keys;
   couriers simply won't be real.
2. 🖥 **Uber Direct production access** — same, in the Uber Direct dashboard.
3. 🖥 **Stripe Tax registration** — Dashboard → Tax → Registrations → add Ohio.
   Without it every live order collects $0 tax (you'll now get an ops-alert email
   each time, but don't rely on that).
4. 🖥 **Stripe Radar** — Dashboard → Radar → Rules: enable the default block
   rules; add `Block if :cvc_check: = fail` and review 3DS rules. This layers on
   top of the app's checkout rate limiting (PR #22).
5. 🖥 **Vercel plan check** — `*/5` cron schedules and `maxDuration=60` need a
   paid plan. Verify in Vercel → Settings → Functions & Crons.
6. **Business items (owner)**:
   - Ohio retail food establishment license — have the paperwork ready.
   - Replace legal placeholder copy (Terms / Privacy / Refund) with reviewed text;
     PR to link them from the footer + checkout is on the polish backlog.
   - Real contact phone on /contact (the 555 fallback is also in SEO JSON-LD).
   - Allergen/ingredient text on every Product (Product.ingredients field).
   - Review unused B2B AccessCodes in admin — revoke any you don't recognize.
7. **Per-location config (admin panel)** for every live Location:
   - `hours` JSON correct (evaluated in America/New_York after PR #21).
   - `prepMinutes` realistic (drives courier pickup timing).
   - `notificationEmail` = the kitchen's real inbox (also gets escalation emails).
   - Stock rows / `isEnabled` per SKU; low-stock thresholds.
8. 🖥 **Social OAuth consoles** — add the production domain redirect URIs
   (Google / Facebook / Twitter developer consoles) or social sign-in breaks
   on colchisfood.com. Twitter works secret-less (PKCE) if configured so.
9. **Env hygiene** — generate fresh values for prod (do NOT reuse dev):
   `JWT_SECRET`, `CRON_SECRET`, `ORDER_LOOKUP_SECRET`. Rotating JWT_SECRET logs
   everyone out — do it at a quiet hour.

## Phase B — Stripe cutover (the risky 30 minutes; do in this exact order)

1. 🖥 Create the **live webhook endpoint**: Dashboard (live mode) → Developers →
   Webhooks → `https://colchisfood.com/api/webhooks/stripe`, events:
   `payment_intent.succeeded`, `payment_intent.payment_failed`,
   `payment_intent.canceled`, `payment_intent.processing`, `charge.refunded`,
   `charge.dispute.created`, `account.updated`, `payout.paid`, `payout.failed`.
   Copy the live `whsec_…`.
2. 🖥 Vercel env (Production): set live `STRIPE_SECRET_KEY`,
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` (from step 1).
3. **Null the test-mode Connect linkage** so checkout platform-charges until
   live onboarding is done (PR #20's mode guard also enforces this, belt +
   suspenders):
   ```sql
   UPDATE "Location" SET "stripeConnectAccountId" = NULL,
     "stripeOnboardingStatus" = NULL, "stripeAccountLivemode" = NULL
   WHERE "stripeConnectAccountId" IS NOT NULL;
   ```
4. **Wipe test-era orders** so the books start clean (dry-run first):
   ```bash
   node scripts/cleanup-test-orders.mjs                    # dry run
   CONFIRM_CLEANUP=1 node scripts/cleanup-test-orders.mjs  # delete
   ```
   Then re-count physical Stock quantities per location in admin.
5. Redeploy production (env changes need a deploy).
6. 🖥 Re-run **Connect onboarding in live mode** from /admin/locations for each
   location (optional at launch — platform charges are a safe interim).
7. **Carrier live keys** (only if production access approved): DoorDash
   `DOORDASH_*`, Uber `UBER_DIRECT_*` (+ webhook URLs registered in their
   dashboards), EasyPost `EZAK…` key — but leave `NATIONAL_SHIP_ENABLED` UNSET
   in prod (PR #23 gate) until the UPS pipeline is hardened.
8. **Delayed payment methods**: in Stripe Dashboard → Settings → Payment
   methods, decide on ACH debit. The code now handles `processing` correctly
   (PR #20), but for launch week card-only is simplest.

## Phase C — the live $1 rehearsal (before announcing)

1. Keep the testing banner ON. Place one real order with a REAL card (cheapest
   item, pickup). Verify, in order:
   - [ ] Order flips to PAID/CONFIRMED within ~1 min (webhook working). If it
         takes until the success-page load or ~5 min (cron rescue), the webhook
         secret is wrong — check Stripe → Webhooks → delivery attempts.
   - [ ] **Tax is nonzero** on the order (Stripe Tax registered).
   - [ ] Kitchen queue shows the order + chime; kitchen email arrived.
   - [ ] Accept → advance → Handed over works.
   - [ ] Refund it from the ADMIN UI; money returns; stock restored.
2. Place a second $1 order and refund it from the **Stripe dashboard** instead —
   verify the order flips REFUNDED + fulfillment cancels (charge.refunded sync)
   and the ops-alert email arrives.
3. 🖥 Turn OFF the testing banner: /admin → site settings → testing mode →
   disable. Verify the banner is gone and checkout copy shows no test-mode
   language.
4. Announce. 🎉

## Launch-morning smoke checklist (~15 min, run daily the first week)

| # | Check | Where | Pass looks like |
|---|-------|-------|-----------------|
| 1 | Place a pickup order (real card, refund after) | storefront | PAID within 1 min, tax > $0 |
| 2 | Kitchen queue + chime + Accept | /location-portal/…/orders | order appears newest-first, courier books on courier orders |
| 3 | Cancel-request flow | kitchen acct → manager acct | request → approve → refund lands |
| 4 | Cron sweep healthy | Vercel → Logs → cron | `Sweep complete … errors=0` |
| 5 | Webhook deliveries green | Stripe → Webhooks | no failed deliveries overnight |
| 6 | Ops-alert inbox | BAKERY_NOTIFICATION_EMAIL | zero unexplained alerts |
| 7 | Escalation stamp | leave a test order unaccepted 6 min | escalation email arrives, once |
| 8 | Rate limiter | 11 rapid checkout attempts from one IP | 11th blocked politely |

## Known-deferred (tracked, not launch blockers)

- NATIONAL_SHIP hardening (parcel weights from products, live EasyPost spec
  verification, label persistence) — gated off in prod meanwhile.
- Resolve B2B net-terms — spec unverified, no credentials; keep B2B card-only.
- Recurring-order cron off-session card charging (Phase 10 follow-up).
- Error tracking: Sentry is WIRED but dormant — create a free Sentry project
  and set SENTRY_DSN + NEXT_PUBLIC_SENTRY_DSN in Vercel env to activate.
  Ops-alert emails cover the money paths either way.
- Tax-inclusive total display at checkout + footer legal links (polish PR).
- B2B `OrderItem.unitPrice` stored with `$` prefix (cosmetic, cleanup pass).
