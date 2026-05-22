# Colchis Food — Brand & Design System

Current as of the Phase 1-8 platform overhaul. Replaces the pre-rebrand "Colchis Creamery" brand book (deleted in the same commit). This document is the source of truth for visual language, voice, and reusable design patterns. Source code reflects this — when the two diverge, the code wins and this doc gets updated.

## 1. Brand identity

**Name**: Colchis Food (post-rebrand from "Colchis Creamery" — the broader name fits the bakery + B2B + creamery business model).

**Promise**: ancient heritage, fresh every day. Hand-pressed Georgian cheese and hot khachapuri baked in Dublin, Ohio. The bakery delivers hot in 25 minutes; the creamery ships nationwide.

**Position**: ultra-premium artisanal — Georgian craft transposed to American distribution. Direct-to-consumer locally, ship-to-home nationwide for creamery, and a tightly-vetted wholesale channel for restaurants + specialty grocers.

**Aesthetic** in one line: **stone-carved seal on cream paper, with a copper sun behind it.**

---

## 2. Logo & seal

Source files live at `public/brand/`:

| File | When to use |
|---|---|
| `seal-primary.svg` / `seal-primary.png` | Default — header, hero, invoices. Cream background, ink letterforms, copper Golden Fleece arc |
| `seal-cream.svg` | On dark backgrounds (B2B portal, admin panel) |
| `seal-black.svg` | Single-color print, faxes, simple icon embeds |
| `seal-mono.svg` / `seal-mono-copper.svg` | Monochrome variants for stamps, embossing, watermarks |
| `lockup-horizontal.svg` / `lockup-vertical.svg` | When the seal needs to be paired with the "Colchis Food" wordmark |
| `mark-only.svg` | The CF monogram without the seal ring — favicons, app icon, ultra-small contexts |
| `favicon.svg` / `app-icon.svg` | Browser tab + iOS/macOS app icon |

**Programmatic seal**: `<ColchisSeal />` from `src/components/brand/ColchisSeal.tsx`. Props:
- `size` (px diameter, default 40)
- `invert` (swap cream ↔ ink for dark contexts)
- `mono` (drop the copper accent — single-color)

**Minimum clear-space**: one quarter of the seal's diameter on all sides. Never crop, rotate, recolor, or apply a drop-shadow.

**Inspiration**: stone-carved Asomtavruli letterforms (the ancient Georgian script) inside a circular seal, with a Golden Fleece arc at the bottom — a direct nod to the Colchis kingdom mythology that gives the brand its name.

---

## 3. Color palette — "Forest & Copper"

All tokens live in `src/app/globals.css` under `@theme inline`. Tailwind 4 picks them up automatically as `bg-cream`, `text-ink`, `border-accent`, etc.

### Public / D2C palette (cream-on-forest)

| Token | Hex | Tailwind class | Use |
|---|---|---|---|
| `--color-cream` | `#F5F0E6` | `bg-cream` / `text-cream` | Primary background, paper feel |
| `--color-cream2` | `#EAE2D2` | `bg-cream2` | Secondary surfaces, sticky nav rails |
| `--color-ink` | `#1F3026` | `text-ink` / `bg-ink` | Primary text, dark CTAs, forest green |
| `--color-ink2` | `#2C3D33` | `text-ink2` | Secondary text, deeper forest |
| `--color-accent` | `#B96A3D` | `text-accent` / `bg-accent` | Copper accent — interactive states, eyebrows, brand color spots |
| `--color-accent2` | `#8B4A28` | `text-accent2` | Darker copper for hover states and stamps |
| `--color-muted` | `#7A8278` | `text-muted` | Sage gray — captions, helper text |

### B2B / Admin dark theme

| Token | Hex | Use |
|---|---|---|
| `--color-b2b-bg` | `#0F0F0F` | App background |
| `--color-b2b-surface` | `#1A1A1A` | Cards, panels, drawers |
| `--color-b2b-border` | `#2A2A2A` | Hairlines |
| `--color-b2b-text` | `#FAFAFA` | Primary text |

Accent stays `#B96A3D` for hover/active across both themes — single thread of brand identity through every surface.

### Semantic aliases

The palette is also exposed via semantic names that won't change even if a brand tone shifts:

```
--color-background: var(--color-cream);
--color-foreground: var(--color-ink);
--color-primary:    var(--color-accent);
--color-border:     #1F302622;        /* ink at 13% */
--color-border-light: #1F302614;      /* ink at  8% */
```

### Selection color

Override: `::selection { background-color: var(--color-accent); color: var(--color-cream); }` — text selection is always copper-on-cream, a small but consistent brand moment.

### Hardcoded usage

There are ~1700 hex references in `.tsx` files (homepage hero, admin sidebar, B2B portal). This is intentional — inline-styled landing pages have a different aesthetic from the Tailwind-token storefront. When refactoring, prefer the CSS variables for **new** code; leave the inline-styled heroes alone unless a redesign is explicitly in scope.

---

## 4. Typography

Five fonts, loaded via `next/font/google` in `src/app/[locale]/layout.tsx`. Latin and Georgian have separate stacks so non-Latin content doesn't visually drift.

| Variable | Family | Role |
|---|---|---|
| `--font-serif` | **Fraunces** | Display, headlines, marketing copy |
| `--font-sans` | **Inter** | Body, UI, forms |
| `--font-mono` | **JetBrains Mono** | Eyebrow labels, technical chips, SKU IDs, status badges |
| `--font-serif-ka` | **Noto Serif Georgian** | Georgian display + headings (`html[lang="ka"]`) |
| `--font-sans-ka` | **Noto Sans Georgian** | Georgian body |

Georgian-locale override is automatic — when the user picks `ka`, body switches to Noto Sans Georgian and headings switch to Noto Serif Georgian via `html[lang="ka"]` selectors in `globals.css`.

### Typographic scale

Defined as utility classes in `globals.css`:

| Class | Family | Size | Weight | Used for |
|---|---|---|---|---|
| `.cf-display` | Fraunces | 96+ px | 300 (light) | Hero "Everything we make, in one place." |
| `.cf-headline` | Fraunces | 56 px | 300 | Section heads |
| `.cf-body` | Inter | 18 px | 400 | Paragraph body, 1.6 leading |
| `.cf-eyebrow` | JetBrains Mono | 11 px, 0.32em tracking | 400, uppercase | "The Shop · ყველაფერი" rail labels |
| `.cf-eyebrow-sm` | JetBrains Mono | 10 px, 0.24em tracking | 400, uppercase | Inline status chips, table headers |

The display + headline use Fraunces at **light weight (300)** intentionally — the brand reads as restrained luxury, not heavy or shouty. Pair with italic emphasis (`<em>`) in copper for the most premium feel:

```jsx
<h1 className="cf-display">
  Everything we make,
  <em style={{ color: 'var(--color-accent)', fontWeight: 300 }}>
    in one place.
  </em>
</h1>
```

### Letter-spacing rule of thumb

- Display: negative tracking (`-0.025em` to `-0.03em`) — large type needs to tighten
- Body: default (0)
- Eyebrow / button labels: wide positive tracking (`0.18em` to `0.32em`) and always UPPERCASE

---

## 5. Voice & tone

Three modes:

### 5.1 Public storefront — confident, slightly poetic, never precious

- ✅ "Ancient heritage, fresh every day."
- ✅ "Hand-pressed sulguni and hot khachapuri."
- ✅ "The bakery delivers in 25 minutes."
- ❌ "Awakening your senses to a journey of Georgian artisanal craftsmanship." (overwrought)
- ❌ "OMG try our cheese it slaps!" (off-brand)

Concrete > emotional. State what we do, where we do it, and why it tastes the way it does. Trust the product to do the heavy lifting.

### 5.2 B2B portal — operational, terse, respect the partner's time

- ✅ "Net 30 invoice. Order ships from Columbus warehouse."
- ✅ "Pay now via Stripe ACH or pick a net term."
- ❌ Marketing language. Partners didn't come here for a story.

### 5.3 Admin / operator — direct, action-oriented

- ✅ "Receive shipment — creates a tracked batch + audit row."
- ✅ "Switching to North Market will clear your cart."
- ❌ Hedge words ("might", "perhaps", "we recommend"). Ops needs decisions, not suggestions.

### Georgian voice

When `lang="ka"`, all UI copy + product names switch to Georgian. Tone stays equally restrained — Georgian copy borrows phrasing from the brand's heritage register, not from modern Tbilisi internet-Georgian. Examples in the catalog: "სულგუნი", "იმერული", "აჭარული" (always nameKa fields on `Product`).

---

## 6. Layout & spacing

No formal spacing token system — Tailwind's default scale (4-px base) is used. The two layout containers in active use:

- `max-w-7xl mx-auto px-6` — admin pages, settings forms
- `max-w-{1280|1440} mx-auto` with inline `padding: '0 56px'` — marketing pages (hero, /shop, /creamery)

Sticky-nav rails sit at `top: 88px` (header height). Cards use `padding: 20-24px` (`p-5` or `p-6`), borders at `#1F302622` (admin: `#ffffff0A`).

### Texture: the brand grid

A subtle 80×80 cream grid is available via `.cf-grid-texture`:

```css
background-image:
  linear-gradient(var(--color-cream) 1px, transparent 1px),
  linear-gradient(90deg, var(--color-cream) 1px, transparent 1px);
background-size: 80px 80px;
opacity: 0.04;
```

Used sparingly behind hero sections — gives the cream paper a faint "blueprint" feel without becoming busy.

---

## 7. Motion

Two animations defined globally:

| Keyframe | Duration | Easing | Where |
|---|---|---|---|
| `fade-in` | 0.3s | ease-out | Toasts, opening modals (`animate-fade-in`) |
| `slide-up` | 0.3s | ease-out | Bottom sheets, mobile drawers |
| `spin` | 1s linear | infinite | Loading spinners |
| `filter-in` | 0.3s | ease-out forwards | Catalog filter chip changes |

**Principle**: motion is for confirming action (page changed, toast arrived), not for delight. Keep it short (≤ 300 ms), easing-out, no bounces.

---

## 8. Components — what the codebase has

The platform has organic components built per surface, not a strict component-library convention yet. Patterns that should be reused (and copied carefully when you find yourself building a fifth variant):

| Pattern | Reference file | Notes |
|---|---|---|
| Sticky header with logo + nav + location picker + cart | `src/components/layout/Header.tsx` | Inline-style, cream background, 88-px tall, sticky |
| Drawer / right-side panel (admin) | `src/components/admin/LocationsClient.tsx` (`LocationDrawer`) | 640-px wide, dark theme, escape-to-close |
| ConfirmDialog (cream + dark variants) | `src/components/ui/ConfirmDialog.tsx` | Single source for "are you sure" — DON'T use `window.confirm` |
| Inline form with eyebrow + grid of inputs | `src/components/admin/LocationConnectPanel.tsx`, `b2b/dispatch/page.tsx` | Eyebrow-labelled sections, 2-col `grid-cols-2 md:grid-cols-4` |
| Status badge chip | `/location-portal/[id]/orders/page.tsx` (`statusClass`), `LocationConnectPanel.tsx` (`StatusBadge`) | Tone tokens: `bg-amber-900/30 text-amber-400`, etc. |
| Tile dashboard (per-location, sales reports) | `/location-portal/[id]/page.tsx`, `/admin/sales-reports/page.tsx` | Bordered card, icon top-left, big number, eyebrow caption |
| Chart wrapper (chart.js + react-chartjs-2) | `src/components/admin/AnalyticsCharts.tsx` | Client component, hydration-safe, copper for bars |
| Image gallery (PDP) | `src/components/shop/ProductDetailClient.tsx` (`ProductGalleryNew`) | Thumbnail rail + main image swap |
| Sticky `LocationPicker` (cream-on-cream, dropdown) | `src/components/location/LocationPicker.tsx` | Bakeries first, "Ship to home" footer for cold warehouse |
| Recurring order form | `/b2b-portal/schedules/page.tsx` | JSON paste box for items — designer follow-up: drag-and-drop builder |

**Cement these patterns** when adding a new admin/portal page rather than freelancing a sixth visual treatment for the same idea.

---

## 9. Iconography

`lucide-react` everywhere. Default size: `w-4 h-4` (16 px) inside text, `w-5 h-5` (20 px) in headers, `w-3.5 h-3.5` for compact chips.

Color rule: icons take the surrounding text color unless they're carrying brand meaning (copper accent for primary actions, semantic tones for status: emerald/amber/red).

Brand icons that don't fit lucide (the seal, the Georgian script glyphs) live in `public/brand/` as static SVG.

---

## 10. Accessibility baseline

The system meets WCAG 2.1 AA for color contrast on the primary tokens:

- `text-ink` (`#1F3026`) on `bg-cream` (`#F5F0E6`): contrast **13.1:1** ✅
- `text-cream` on `bg-ink`: same 13.1:1 inverted ✅
- `text-accent` (`#B96A3D`) on `bg-cream`: contrast **3.6:1** — passes only for large text (>= 18 pt / 14 pt bold). **Don't use copper for small body text on cream.** Use ink instead.
- `text-muted` (`#7A8278`) on `bg-cream`: contrast **3.4:1** — large-text only.

Other baselines (already in code most places):
- Keyboard reachable: every interactive element is `<button>` / `<a>`, not `<div>` with onClick
- Focus rings: Tailwind's default `focus:outline-none focus:ring-2 focus:ring-[#B96A3D]` is used in form inputs
- Screen-reader labels: `aria-label` on icon-only buttons, `aria-current="page"` on the active sidebar item
- `alt` text on every product image (set in admin product editor)

The big gap: form error states aren't consistently `aria-invalid="true"` + `aria-describedby` linked. Worth a focused accessibility pass.

---

## 11. Design tokens — refactor watch-list

These are the places where the design system disagrees with itself; pick one direction next time we refactor:

1. **Inline-style hexes vs. Tailwind tokens** — ~1700 hardcoded `#B96A3D` / `#1F3026` / `#F5F0E6` in `.tsx`. Marketing pages intentionally use inline styles for layout precision; admin pages mix both. Standardize new code on `text-accent`, `bg-cream`, etc.
2. **Border colors** — `#1F302622` (cream-page) vs. `#ffffff0A` (admin-dark) are used inconsistently within each theme. Pick one per theme.
3. **B2B accent color** — most B2B/admin UI uses `#B96A3D` (matching the public palette), but `BulkOrderClient` uses `#CBA153` (lighter gold). Pick one.
4. **Status badge palette** — amber/blue/emerald/red/gray tones are open-coded at each callsite. Extract a single `StatusBadge` component with tone tokens.
5. **`max-width` containers** — `max-w-7xl` (Tailwind 1280) vs. inline `maxWidth: 1280` vs. inline `maxWidth: 1440`. Pick a marketing-page width.

None of these are bugs — the platform works fine — but each is worth a focused commit when the surrounding work touches it.

---

## 12. Where this lives

- This doc: `docs/BRAND_GUIDELINES.md`
- Tokens: `src/app/globals.css`
- Brand SVGs: `public/brand/`
- Seal component: `src/components/brand/ColchisSeal.tsx`
- Fonts: `src/app/[locale]/layout.tsx`

Update this doc when you change any of the above. Keep it short — when in doubt, link to the canonical source rather than duplicating.
