Context

Colchis Creamery is an ultra-premium artisanal Georgian cheese brand based in Ohio, USA. The website needs to serve B2C customers, B2B wholesale partners, and internal admin. The brand book (D:\\Cheese\\Colchis Creamery - ბრენდბუქი.md) provides comprehensive specifications: design system, sitemap, database schema (7 tables), API endpoints, and component code samples.

The D:\\Cheese\\website directory is empty. Stripe and Adobe Sign integrations will be placeholders since the company is not yet established.

The site must be English by default with easy language switching (Georgian, Russian, Spanish, and extensible to others).



Tech Stack

ConcernChoiceRationaleFrameworkNext.js 15 (App Router)Specified in brand bookLanguageTypeScript (strict)Type safety for B2B/B2C logicStylingTailwind CSSBrand book uses Tailwind classes throughouti18nnext-intlBest App Router integration, SSR-nativeAuthjose (JWT in Edge Middleware)Brand book specifies this approachDatabasePrisma + SQLite (dev) / PostgreSQL (prod)Type-safe DB access, easy migrationPaymentsStripe SDK (placeholder wrapper)Stubbed with mock responsesFormszod + React Server ActionsMatches brand book patternChartsrecharts (admin only)Lightweight React charting



Brand Design Tokens



Backgrounds: Cream #FDFBF7, Off-white #FAFAFA

Primary accent: Heritage Gold #CBA153

Text: Charcoal #2C2A29

B2B portal: Black + Gold dark theme

Headings: Playfair Display (serif) + Noto Serif Georgian (ka locale)

Body: Inter (sans-serif) + Noto Sans Georgian (ka locale)

Slogan: "Ancient Heritage, Fresh Taste"





Folder Structure

src/

├── app/

│   ├── layout.tsx                    # Root layout (minimal)

│   ├── \[locale]/

│   │   ├── layout.tsx                # Locale layout (fonts, i18n provider, cart provider)

│   │   ├── globals.css

│   │   ├── (public)/                 # B2C public pages

│   │   │   ├── page.tsx              # Home (SSG)

│   │   │   ├── heritage/page.tsx     # Our Heritage (SSG)

│   │   │   ├── shop/

│   │   │   │   ├── page.tsx          # Catalog (SSR)

│   │   │   │   └── \[productId]/page.tsx  # Product detail (SSR + JSON-LD)

│   │   │   ├── cart/page.tsx         # Cart (CSR)

│   │   │   ├── checkout/page.tsx     # Checkout (Stripe placeholder)

│   │   │   ├── recipes/

│   │   │   │   ├── page.tsx          # Recipes listing

│   │   │   │   └── \[slug]/page.tsx

│   │   │   ├── wholesale/page.tsx    # B2B landing (dark theme + lead form)

│   │   │   ├── contact/page.tsx

│   │   │   ├── faq/page.tsx

│   │   │   └── legal/{privacy,terms,returns}/page.tsx

│   │   ├── (auth)/

│   │   │   ├── login/page.tsx

│   │   │   └── register/page.tsx

│   │   ├── (b2b-portal)/b2b-portal/  # Closed B2B zone

│   │   │   ├── dashboard/page.tsx

│   │   │   ├── orders/{page.tsx, new/page.tsx}

│   │   │   ├── contracts/page.tsx

│   │   │   ├── tracking/page.tsx

│   │   │   └── invoices/page.tsx

│   │   └── (admin)/admin/            # Internal admin panel

│   │       ├── dashboard/page.tsx

│   │       ├── orders/page.tsx

│   │       ├── b2b/{partners,leads,contracts}/page.tsx

│   │       ├── logistics/page.tsx

│   │       ├── inventory/page.tsx

│   │       └── cms/{products,recipes}/page.tsx

│   └── api/                          # API routes (outside \[locale])

│       ├── auth/{register,login,logout}/route.ts

│       ├── products/route.ts

│       ├── orders/route.ts

│       ├── webhooks/{stripe,adobe-sign}/route.ts

│       ├── contracts/generate/route.ts

│       ├── shipments/route.ts

│       └── export/orders/route.ts

├── actions/                          # Server Actions

│   ├── wholesale.ts, orders.ts, logistics.ts, auth.ts

├── components/

│   ├── ui/     (Button, Input, Card, Badge, Table, Modal)

│   ├── layout/ (Header, Footer, LocaleSwitcher, B2BSidebar, AdminSidebar)

│   ├── home/   (HeroSection, TrustBadges, FeaturedProducts)

│   ├── shop/   (ProductCard, ProductGrid, AddToCartButton, CartDrawer)

│   ├── checkout/ (StripeCheckoutPlaceholder)

│   ├── b2b/    (BulkOrderClientForm, ContractStatusCard, DeliveryTracker)

│   ├── admin/  (SalesChart, OrdersTable, InventoryEditor)

│   └── seo/    (JsonLdProduct, JsonLdLocalBusiness, JsonLdRecipe)

├── lib/        (db.ts, auth.ts, stripe.ts, adobe-sign.ts, cart.ts, validations.ts, utils.ts)

├── hooks/      (useCart.ts, useAuth.ts)

├── providers/  (CartProvider.tsx)

├── types/      (user.ts, product.ts, order.ts, contract.ts, shipment.ts)

├── i18n/       (routing.ts, request.ts)

├── middleware.ts  # Composed: next-intl locale routing + JWT auth

messages/          # Translation files: en.json, ka.json, ru.json, es.json

prisma/            # schema.prisma, seed.ts, migrations/



Implementation Phases (Public Site First)

Priority: Build Phases 1-4 first (foundation + all public B2C pages). B2B portal and admin panel will follow later.

Database: SQLite via Prisma for fast development. Switch to PostgreSQL for production later.

Phase 1: Project Foundation



Initialize Next.js 15 with TypeScript, Tailwind, ESLint, App Router

Install dependencies: next-intl, prisma, jose, zod, stripe

Configure Tailwind with brand colors, fonts (Playfair Display, Inter + Georgian fallbacks)

Set up next-intl with \[locale] routing (en, ka, ru, es)

Set up composed middleware (locale routing + JWT auth stubs for future)

Initialize Prisma schema with all 7 tables + SQLite datasource

Create seed data (products, recipes) for dev

Create placeholder service wrappers for Stripe and Adobe Sign

Create .env.example with all required variables



Phase 2: Design System \& Shared Components



Build branded UI primitives (Button, Input, Card, Badge, Table)

Build layout components (Header with nav + locale switcher, Footer)

Build SEO components (JSON-LD for LocalBusiness, Product, Recipe)



Phase 3: Public B2C Pages (Core)



Home page: Hero section, trust badges, featured products, heritage teaser

Our Heritage: Georgian cheese history, Ohio sourcing story

Shop catalog: Product grid with SSR, product cards

Product detail: Full page with JSON-LD, metadata, Add to Cart + Buy on Amazon buttons

Cart: Client-rendered with localStorage-backed cart context

Checkout: Stripe placeholder with "coming soon" UI



Phase 4: Public B2C Pages (Content \& SEO)



Recipes \& Pairings: Blog-style recipe pages with SEO

Wholesale Hub: Dark-themed B2B landing page with lead capture form (Server Action)

Support pages: Contact, FAQ, Privacy, Terms, Returns

SEO infrastructure: Dynamic sitemap, robots.txt, OpenGraph defaults





Future phases (to be built after public site is complete):

Phase 5 (Future): Authentication System

Phase 6 (Future): B2B Client Portal

Phase 7 (Future): Admin Panel

Phase 8 (Future): API Routes \& Webhooks

Phase 9 (Future): Polish \& Deployment



Key Technical Decisions



Middleware composition: next-intl locale middleware runs first, then JWT auth checks for protected routes

Georgian fonts: Playfair Display doesn't support Georgian script - load Noto Serif/Sans Georgian conditionally when locale === 'ka'

Database: Start with SQLite (via Prisma) for zero-setup dev; switch to PostgreSQL for production

Placeholders: Stripe/Adobe Sign wrappers check for API keys at runtime; return mock responses when keys are missing

API routes sit outside \[locale] - REST endpoints don't need locale prefixes



Verification



Run npm run dev and verify all public pages render correctly

Test locale switching (en -> ka -> ru -> es) on all pages

Verify protected routes redirect to login when unauthenticated

Run npm run build to confirm SSG/SSR strategies work

Seed database and verify shop catalog, product detail pages

Test cart add/remove/checkout flow (placeholder)

Preview on mobile/tablet/desktop viewports

