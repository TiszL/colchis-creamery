# Colchis Creamery — Prospect Intelligence Database v3.0

## Document Purpose

This document explains the complete data architecture, contents, and usage of the Colchis Creamery B2B prospect intelligence system. It covers three JSON files that together form a single source of truth for all sales, analytics, and business planning around prospect and customer management.

---

## Overview at a Glance

| Metric | Value |
|---|---|
| Total prospect entities (brands/companies) | **266** |
| Total physical locations (selling points) | **287** |
| Active locations (Google-verified operational) | **285** |
| Locations with GPS coordinates | **269** (93.7%) |
| Locations with phone numbers | **262** (91.3%) |
| Locations with Google ratings | **263** (91.6%) |
| States covered | **14** |
| Category types | **17** |
| Monthly TAM (low) | **$435,405** |
| Monthly TAM (high) | **$1,735,200** |
| Annual TAM (low) | **$5,224,860** |
| Annual TAM (high) | **$20,822,400** |

---

## The Three Files

### 1. `colchis_creamery_prospects_v3.json` (931 KB) — Master Database

This is the **primary intelligence file**. It contains everything: metadata, summary analytics, the category taxonomy, the revenue model, priority scoring methodology, and all 266 prospect entities with their nested locations.

**Structure:**
```
{
  "metadata": { ... },          // Version, dates, coverage zone, data quality stats
  "summary": { ... },           // Pre-calculated TAM, breakdowns by tier/category/state
  "categoryTaxonomy": { ... },  // Complete 17-category classification system
  "revenueModel": { ... },      // Revenue estimation methodology per category
  "priorityScoring": { ... },   // Weighted scoring formula and label definitions
  "prospects": [ ... ]          // Array of 266 prospect entities
}
```

This file is designed for **database import, AI consumption, and dashboard backends**. It is self-documenting — the taxonomy, revenue model, and scoring methodology are embedded in the file itself, so any system reading it can understand how every number was derived.

### 2. `colchis_map_pins.json` (331 KB) — Flat Map-Ready Locations

This is a **flattened** version: one record per physical location (287 records). It is designed for **direct import into map visualizations, website analytics, and CRM pin-drop views**.

Every record has `latitude`, `longitude`, and all the fields needed to render a colored pin on a map: `priorityRank` for color, `revenue` for pin size, `category` for filtering, `tierLabel` for grouping.

### 3. `colchis_prospect_taxonomy.json` (15 KB) — Reference/Lookup

A standalone reference file containing the full category taxonomy and revenue model. Useful as a **lookup table** for dashboards or as configuration for scoring algorithms.

---

## Data Architecture: Prospect → Locations

The most important design decision: **each record in the prospects array represents a brand or company, not a building**.

A single prospect (e.g., "Chama Mama") can have multiple locations. Each location has its own coordinates, phone, rating, and status. Revenue is calculated per-location and then aggregated to the prospect level.

```
PROSPECT (brand entity)
├── prospectId: "CC-0001"
├── brandName: "Chama Mama"
├── classification: { tier, sector, subsector, segment }
├── priority: { score, label }
├── revenueEstimate: { perLocation, total, annual }
├── locations: [
│     { name: "Chama Mama - Chelsea", lat, lng, phone, status, rating ... },
│     { name: "Chama Mama - UWS", lat, lng, phone, status, rating ... },
│     { name: "Chama Mama - Bushwick", lat, lng, phone, status, rating ... },
│     { name: "Chama Mama - Brooklyn Heights", lat, lng, phone, status, rating ... },
│     { name: "Chama Mama - Greenpoint", lat, lng, phone, status, rating ... },
│   ]
├── prospectReason: "Multi-unit brand with 5 locations..."
└── productFit: { applicableProducts, cheeseApplication, purchaseFrequency }
```

**Why this matters for analytics:**
- When you close a deal with Chama Mama, you potentially supply ALL 5 locations through one purchasing relationship
- Revenue per prospect = per-location estimate × number of active locations
- Your sales pipeline tracks **brands**, not buildings — one deal, multiple delivery points

### Multi-Location Brands in the Database

| Brand | Locations | Type |
|---|---|---|
| Chama Mama | 5 | Georgian Restaurant |
| Saperavi | 4 | Georgian Restaurant |
| Oda House | 3 | Georgian Restaurant |
| Ubani | 3 | Georgian Restaurant |
| Aragvi | 2 | Georgian Restaurant |
| Cheeseboat | 2 | Georgian Restaurant |
| Old Marani | 2 | Georgian Restaurant |
| Sipsteria | 2 | Georgian Restaurant |
| X Factory | 2 | Georgian Restaurant |
| Little Georgia | 2 | Georgian Restaurant |
| Georgian Deli and Bakery | 2 | Georgian Bakery |
| Georgian House | 2 | Georgian Restaurant |
| Tatiana Restaurant | 2 | Russian Restaurant |
| Formaggio Kitchen | 2 | Cheese Shop / Distributor |

---

## The 5-Tier Classification System

Every prospect is classified into one of 5 tiers that define how naturally they need Georgian cheese:

### Tier 1: CORE (91 prospects, 111 locations)
Direct Georgian food businesses. These have **built-in, daily demand** for our exact products.

| Category Code | Label | Count | Monthly TAM |
|---|---|---|---|
| GEO_REST | Georgian Restaurant | 59 | $112,100 - $336,300 |
| GEO_BAKERY | Georgian Bakery | 14 | $47,600 - $142,800 |
| GEO_MARKET | Georgian Specialty Market | 18 | $40,900 - $128,100 (est.) |

**Sales approach:** Degustation + price sheet. No education needed — they already use this cheese daily.

### Tier 2: ADJACENT (111 prospects, 111 locations)
Eastern European and Caucasian businesses with cultural proximity to Georgian food. Their customer base recognizes and expects these cheese types.

| Category Code | Label | Count |
|---|---|---|
| EE_MARKET | Eastern European / Russian Grocery | 64 |
| CAUC_REST | Caucasian/Eurasian Restaurant | 15 |
| RUS_REST | Russian/Slavic Restaurant | 12 |
| UZB_REST | Uzbek/Central Asian Restaurant | 11 |
| CA_MARKET | Central Asian Grocery | 6 |
| ARM_REST | Armenian Restaurant | 3 |

**Sales approach:** Product sampling + showing how their existing dishes benefit from authentic Georgian cheese.

### Tier 3: STRATEGIC (7 prospects, 7 locations)
Food distributors. The **single highest-volume deal type** — one contract gives access to 50-500+ downstream accounts.

| Category Code | Label | Count | Monthly TAM |
|---|---|---|---|
| DISTRIBUTOR | Specialty Food / Cheese Distributor | 7 | $105,000 - $525,000 |

**Sales approach:** Trade show meetings, broker introductions, volume pricing negotiations.

### Tier 4: GROWTH (17 prospects, 17 locations)
Businesses where Georgian cheese is a specialty add-on, not a core ingredient.

| Category Code | Label | Count |
|---|---|---|
| ARTISAN_PIZZA | Artisan / Neapolitan Pizzeria | 15 |
| INTL_MARKET | International / Gourmet Market | 2 |

**Sales approach:** Chef samples, side-by-side tasting vs. their current cheese.

### Tier 5: EXPERIMENTAL (40 prospects, 41 locations)
No natural demand yet, but strategic potential if pitched correctly.

| Category Code | Label | Count |
|---|---|---|
| CHEESE_SHOP | Artisan Cheese Shop / Monger | 14 |
| MEDITERRANEAN_REST | Mediterranean / Turkish Restaurant | 8 |
| BRUNCH_UPSCALE | Upscale Brunch / Farm-to-Table | 7 |
| CATERING | Catering Company | 6 |
| MEAL_KIT | Meal Kit / Food Subscription | 5 |

**Sales approach:** Storytelling ("American-made authentic Georgian cheese"), chef education, event-driven pitches.

---

## Complete Field Reference

### Prospect Entity Fields

| Field | Type | Description |
|---|---|---|
| `prospectId` | string | Unique ID (format: CC-XXXX) |
| `brandName` | string | Brand or company name |
| `pinType` | string | Always "PROSPECT" until converted to "PARTNER" or "CUSTOMER" |
| `classification.categoryCode` | string | One of 17 category codes (e.g., GEO_REST) |
| `classification.categoryLabel` | string | Human-readable category name |
| `classification.tier` | integer | 1-5 (Core to Experimental) |
| `classification.tierLabel` | string | CORE, ADJACENT, STRATEGIC, GROWTH, EXPERIMENTAL |
| `classification.sector` | string | FOOD_SERVICE, RETAIL, DISTRIBUTION, FOOD_TECH |
| `classification.subsector` | string | RESTAURANT, BAKERY, SPECIALTY_GROCERY, etc. |
| `classification.segment` | string | Specific market segment |
| `priority.score` | float | 0-100 weighted composite score |
| `priority.label` | string | CRITICAL, HIGH, MEDIUM, LOW, EXPLORATORY |
| `priority.weight` | integer | Category base weight (used in score calculation) |
| `locationCount` | integer | Total physical locations |
| `activeLocationCount` | integer | Locations verified as currently operational |
| `locations` | array | Array of location objects (see below) |
| `revenueEstimate.perLocationMonthly.lowUSD` | integer | Conservative monthly revenue per location |
| `revenueEstimate.perLocationMonthly.highUSD` | integer | Optimistic monthly revenue per location |
| `revenueEstimate.perLocationMonthly.cheeseLbsLow` | integer | Conservative monthly cheese volume in lbs |
| `revenueEstimate.perLocationMonthly.cheeseLbsHigh` | integer | Optimistic monthly cheese volume in lbs |
| `revenueEstimate.perLocationMonthly.avgPricePerLb` | float | Wholesale price per lb used in calculation |
| `revenueEstimate.totalMonthly.lowUSD` | integer | = perLocation.low × activeLocationCount |
| `revenueEstimate.totalMonthly.highUSD` | integer | = perLocation.high × activeLocationCount |
| `revenueEstimate.totalAnnual.lowUSD` | integer | = totalMonthly.low × 12 |
| `revenueEstimate.totalAnnual.highUSD` | integer | = totalMonthly.high × 12 |
| `revenueEstimate.rationale` | string | Explanation of how the estimate was derived |
| `productFit.applicableProducts` | array | Which Colchis products this prospect would buy |
| `productFit.cheeseApplication` | string | How they would use the cheese |
| `productFit.purchaseFrequency` | string | WEEKLY, BIWEEKLY, or MONTHLY |
| `geography.primaryState` | string | State abbreviation |
| `geography.primaryCity` | string | City name |
| `geography.closestDistanceMiles` | float | Straight-line distance from Columbus, OH |
| `geography.estimatedDriveHours` | float | Estimated drive time (distance ÷ 55 mph) |
| `geography.statesPresent` | array | All states where this brand has locations |
| `metrics.avgGoogleRating` | float | Average Google rating across locations |
| `metrics.highestRating` | float | Best rating among locations |
| `prospectReason` | string | Multi-sentence business case explaining why this is a prospect |
| `rawNotes` | array | Original research notes from data collection |

### Location Object Fields

| Field | Type | Description |
|---|---|---|
| `locationName` | string | Name including location qualifier |
| `address` | string | Full street address (from Google Places) |
| `city` | string | City |
| `state` | string | State abbreviation |
| `neighborhood` | string | Neighborhood (if available, mostly NYC) |
| `borough` | string | Borough (if applicable, NYC only) |
| `latitude` | float or null | GPS latitude (from Google Places API) |
| `longitude` | float or null | GPS longitude (from Google Places API) |
| `phone` | string | Phone number (from Google Places API) |
| `website` | string | Website URL |
| `googleRating` | float or null | Google Maps star rating |
| `status` | string | ACTIVE, TEMPORARILY_CLOSED, or UNVERIFIED |
| `distanceFromColumbusMiles` | float or null | Miles from Columbus, OH (haversine) |
| `estimatedDriveHours` | float or null | Estimated drive time |
| `georgianDishesServed` | array | List of specific Georgian dishes found on menu |

---

## Revenue Model Explained

Revenue estimates are calculated using this formula:

```
Revenue per location = cheese_lbs_per_month × wholesale_price_per_lb
Total monthly = revenue_per_location × active_locations
Total annual = total_monthly × 12
```

Each category has its own volume and price assumptions based on industry research:

| Category | Lbs/Month (Low) | Lbs/Month (High) | Price/Lb | Monthly Revenue/Location |
|---|---|---|---|---|
| GEO_BAKERY | 400 | 1,200 | $8.50 | $3,400 - $10,200 |
| GEO_REST | 200 | 600 | $9.50 | $1,900 - $5,700 |
| GEO_MARKET | 150 | 500 | $9.00 | $1,350 - $4,500 |
| DISTRIBUTOR | 2,000 | 10,000 | $7.50 | $15,000 - $75,000 |
| EE_MARKET | 100 | 400 | $9.00 | $900 - $3,600 |
| CAUC_REST | 80 | 300 | $9.50 | $760 - $2,850 |
| MEAL_KIT | 500 | 5,000 | $7.00 | $3,500 - $35,000 |
| RUS_REST | 40 | 150 | $9.50 | $380 - $1,425 |
| UZB_REST | 30 | 120 | $9.00 | $270 - $1,080 |
| CA_MARKET | 50 | 200 | $9.00 | $450 - $1,800 |
| ARM_REST | 30 | 100 | $9.50 | $285 - $950 |
| ARTISAN_PIZZA | 20 | 80 | $10.00 | $200 - $800 |
| CHEESE_SHOP | 20 | 80 | $11.00 | $220 - $880 |
| INTL_MARKET | 30 | 150 | $10.00 | $300 - $1,500 |
| MEDITERRANEAN_REST | 30 | 100 | $10.00 | $300 - $1,000 |
| BRUNCH_UPSCALE | 20 | 60 | $11.00 | $220 - $660 |
| CATERING | 40 | 200 | $9.50 | $380 - $1,900 |

**Note:** "Low" assumes minimum viable order (new account, testing phase). "High" assumes mature relationship with full product adoption. Real revenue will fall somewhere in this range depending on account maturity.

---

## Priority Scoring System

Every prospect receives a composite score from 0 to 100 using four weighted factors:

| Factor | Weight | What it Measures |
|---|---|---|
| Category Weight | 50% | Inherent value of the business type for cheese sales |
| Google Rating | 15% | Higher ratings → more foot traffic → more cheese consumption |
| Multi-Location Bonus | 15% | Brands with multiple locations yield more volume per deal |
| Proximity Bonus | 20% | Closer to Columbus → cheaper delivery → higher net margin |

**Score → Label mapping:**

| Label | Score Range | Meaning | Action |
|---|---|---|---|
| CRITICAL | 70-100 | Highest value, immediate ROI | Outreach this week |
| HIGH | 50-69 | Strong fit, high conversion probability | Outreach this month |
| MEDIUM | 35-49 | Good fit with targeted pitch | Second-wave outreach |
| LOW | 20-34 | Possible fit, requires effort | Opportunistic outreach |
| EXPLORATORY | 0-19 | Experimental, needs market education | Long-term pipeline |

---

## How to Structure This in a Database

### Recommended Schema (PostgreSQL / Supabase / any relational DB)

#### Table: `prospects`
```sql
CREATE TABLE prospects (
    prospect_id         VARCHAR(10) PRIMARY KEY,    -- "CC-0001"
    brand_name          VARCHAR(255) NOT NULL,
    pin_type            VARCHAR(20) DEFAULT 'PROSPECT',  -- PROSPECT → LEAD → CUSTOMER → PARTNER
    
    -- Classification
    category_code       VARCHAR(30) NOT NULL,       -- FK → categories
    tier                SMALLINT NOT NULL,           -- 1-5
    tier_label          VARCHAR(20) NOT NULL,
    sector              VARCHAR(30),
    subsector           VARCHAR(30),
    segment             VARCHAR(50),
    
    -- Priority
    priority_score      DECIMAL(5,1) NOT NULL,      -- 0.0 - 100.0
    priority_label      VARCHAR(20) NOT NULL,
    
    -- Counts
    location_count      SMALLINT DEFAULT 1,
    active_location_count SMALLINT DEFAULT 1,
    
    -- Revenue (monthly, per location)
    rev_per_loc_low     INTEGER,                    -- USD
    rev_per_loc_high    INTEGER,
    cheese_lbs_low      INTEGER,                    -- lbs/month
    cheese_lbs_high     INTEGER,
    avg_price_per_lb    DECIMAL(5,2),
    
    -- Revenue (total monthly, all locations)
    rev_total_monthly_low   INTEGER,
    rev_total_monthly_high  INTEGER,
    rev_total_annual_low    INTEGER,
    rev_total_annual_high   INTEGER,
    
    -- Product fit
    applicable_products TEXT[],                     -- array of product names
    cheese_application  TEXT,
    purchase_frequency  VARCHAR(20),                -- WEEKLY, BIWEEKLY, MONTHLY
    
    -- Geography
    primary_state       VARCHAR(2),
    primary_city        VARCHAR(100),
    closest_distance_miles DECIMAL(6,1),
    estimated_drive_hours  DECIMAL(4,1),
    
    -- Metrics
    avg_google_rating   DECIMAL(2,1),
    highest_rating      DECIMAL(2,1),
    
    -- Intelligence
    prospect_reason     TEXT,
    raw_notes           TEXT[],
    
    -- Timestamps
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);
```

#### Table: `locations`
```sql
CREATE TABLE locations (
    location_id         SERIAL PRIMARY KEY,
    prospect_id         VARCHAR(10) REFERENCES prospects(prospect_id),
    location_name       VARCHAR(255) NOT NULL,
    
    -- Address
    address             TEXT,
    city                VARCHAR(100),
    state               VARCHAR(2),
    neighborhood        VARCHAR(100),
    borough             VARCHAR(50),
    
    -- Coordinates
    latitude            DECIMAL(10,7),
    longitude           DECIMAL(10,7),
    geom                GEOMETRY(Point, 4326),      -- PostGIS for spatial queries
    
    -- Contact
    phone               VARCHAR(30),
    website             VARCHAR(500),
    
    -- Status
    google_rating       DECIMAL(2,1),
    status              VARCHAR(30) DEFAULT 'ACTIVE',
    
    -- Logistics
    distance_from_columbus_miles DECIMAL(6,1),
    estimated_drive_hours        DECIMAL(4,1),
    
    -- Menu
    georgian_dishes_served TEXT[],
    
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- Spatial index for map queries
CREATE INDEX idx_locations_geom ON locations USING GIST(geom);
-- Fast filtering
CREATE INDEX idx_locations_state ON locations(state);
CREATE INDEX idx_locations_status ON locations(status);
```

#### Table: `categories` (lookup/reference)
```sql
CREATE TABLE categories (
    category_code       VARCHAR(30) PRIMARY KEY,
    category_label      VARCHAR(100),
    tier                SMALLINT,
    tier_label          VARCHAR(20),
    sector              VARCHAR(30),
    subsector           VARCHAR(30),
    segment             VARCHAR(50),
    description         TEXT,
    cheese_application  TEXT,
    default_priority_weight SMALLINT,
    purchase_frequency  VARCHAR(20),
    applicable_products TEXT[]
);
```

#### Table: `interactions` (CRM layer — add as you start outreach)
```sql
CREATE TABLE interactions (
    interaction_id      SERIAL PRIMARY KEY,
    prospect_id         VARCHAR(10) REFERENCES prospects(prospect_id),
    interaction_date    TIMESTAMP NOT NULL,
    type                VARCHAR(30),    -- CALL, EMAIL, VISIT, DEGUSTATION, SAMPLE_SENT, FOLLOW_UP
    outcome             VARCHAR(30),    -- INTERESTED, NOT_INTERESTED, CALLBACK, ORDER_PLACED, NO_ANSWER
    contact_person      VARCHAR(255),
    notes               TEXT,
    next_action         TEXT,
    next_action_date    DATE,
    created_at          TIMESTAMP DEFAULT NOW()
);
```

#### Table: `orders` (activate when prospects convert)
```sql
CREATE TABLE orders (
    order_id            SERIAL PRIMARY KEY,
    prospect_id         VARCHAR(10) REFERENCES prospects(prospect_id),
    location_id         INTEGER REFERENCES locations(location_id),
    order_date          DATE NOT NULL,
    products            JSONB,          -- [{"product": "sulguni", "lbs": 50, "price_per_lb": 9.50, "total": 475}]
    total_lbs           DECIMAL(8,1),
    total_usd           DECIMAL(10,2),
    delivery_date       DATE,
    status              VARCHAR(20),    -- PENDING, SHIPPED, DELIVERED, CANCELLED
    created_at          TIMESTAMP DEFAULT NOW()
);
```

### Import Script (Python → PostgreSQL)

```python
import json
import psycopg2

with open('colchis_creamery_prospects_v3.json') as f:
    db = json.load(f)

conn = psycopg2.connect("dbname=colchis user=admin")
cur = conn.cursor()

# Import categories from taxonomy
for code, cat in db['categoryTaxonomy'].items():
    cur.execute("""
        INSERT INTO categories (category_code, category_label, tier, sector, subsector, segment,
                               description, cheese_application, default_priority_weight, applicable_products)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (category_code) DO UPDATE SET category_label = EXCLUDED.category_label
    """, (code, cat['label'], cat['tier'], cat['sector'], cat['subsector'], cat['segment'],
          cat['description'], cat['cheese_application'], cat['default_priority_weight'],
          cat['products_applicable']))

# Import prospects
for p in db['prospects']:
    cur.execute("""
        INSERT INTO prospects (prospect_id, brand_name, category_code, tier, tier_label,
                              sector, subsector, segment, priority_score, priority_label,
                              location_count, active_location_count,
                              rev_per_loc_low, rev_per_loc_high, cheese_lbs_low, cheese_lbs_high,
                              avg_price_per_lb, rev_total_monthly_low, rev_total_monthly_high,
                              rev_total_annual_low, rev_total_annual_high,
                              applicable_products, cheese_application, purchase_frequency,
                              primary_state, primary_city, closest_distance_miles, estimated_drive_hours,
                              avg_google_rating, highest_rating, prospect_reason, raw_notes)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (p['prospectId'], p['brandName'], p['classification']['categoryCode'],
          p['classification']['tier'], p['classification']['tierLabel'],
          p['classification']['sector'], p['classification']['subsector'], p['classification']['segment'],
          p['priority']['score'], p['priority']['label'],
          p['locationCount'], p['activeLocationCount'],
          p['revenueEstimate']['perLocationMonthly']['lowUSD'],
          p['revenueEstimate']['perLocationMonthly']['highUSD'],
          p['revenueEstimate']['perLocationMonthly']['cheeseLbsLow'],
          p['revenueEstimate']['perLocationMonthly']['cheeseLbsHigh'],
          p['revenueEstimate']['perLocationMonthly']['avgPricePerLb'],
          p['revenueEstimate']['totalMonthly']['lowUSD'],
          p['revenueEstimate']['totalMonthly']['highUSD'],
          p['revenueEstimate']['totalAnnual']['lowUSD'],
          p['revenueEstimate']['totalAnnual']['highUSD'],
          p['productFit']['applicableProducts'],
          p['productFit']['cheeseApplication'],
          p['productFit']['purchaseFrequency'],
          p['geography']['primaryState'], p['geography']['primaryCity'],
          p['geography']['closestDistanceMiles'], p['geography']['estimatedDriveHours'],
          p['metrics']['avgGoogleRating'], p['metrics']['highestRating'],
          p['prospectReason'], p['rawNotes']))

    # Import locations
    for loc in p['locations']:
        cur.execute("""
            INSERT INTO locations (prospect_id, location_name, address, city, state, neighborhood, borough,
                                  latitude, longitude, phone, website, google_rating, status,
                                  distance_from_columbus_miles, estimated_drive_hours, georgian_dishes_served)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (p['prospectId'], loc['locationName'], loc['address'], loc['city'], loc['state'],
              loc['neighborhood'], loc['borough'], loc['latitude'], loc['longitude'],
              loc['phone'], loc['website'], loc['googleRating'], loc['status'],
              loc['distanceFromColumbusMiles'], loc['estimatedDriveHours'],
              loc['georgianDishesServed']))

conn.commit()
```

---

## Analytics Queries This Data Enables

### 1. Sales Prioritization
```sql
-- Top 20 prospects to call this week
SELECT prospect_id, brand_name, priority_score, priority_label,
       rev_total_monthly_high, primary_city, primary_state, closest_distance_miles
FROM prospects
WHERE pin_type = 'PROSPECT'
ORDER BY priority_score DESC
LIMIT 20;
```

### 2. Route Optimization
```sql
-- All CRITICAL prospects within 4 hours of Columbus, sorted by distance
SELECT p.brand_name, l.address, l.city, l.state,
       l.distance_from_columbus_miles, l.estimated_drive_hours,
       p.rev_total_monthly_high
FROM prospects p
JOIN locations l ON p.prospect_id = l.prospect_id
WHERE p.priority_label = 'CRITICAL'
  AND l.estimated_drive_hours <= 4
  AND l.status = 'ACTIVE'
ORDER BY l.distance_from_columbus_miles;
```

### 3. TAM by State
```sql
-- Revenue potential by state
SELECT primary_state,
       COUNT(*) as prospects,
       SUM(active_location_count) as locations,
       SUM(rev_total_monthly_low) as monthly_low,
       SUM(rev_total_monthly_high) as monthly_high
FROM prospects
GROUP BY primary_state
ORDER BY monthly_high DESC;
```

### 4. Category Performance After Conversion
```sql
-- Once orders start flowing, compare actual vs. estimated
SELECT c.category_label, c.tier,
       AVG(p.rev_per_loc_high) as estimated_monthly,
       AVG(o.total_usd) as actual_avg_order,
       COUNT(DISTINCT o.prospect_id) as converted_accounts
FROM prospects p
JOIN categories c ON p.category_code = c.category_code
LEFT JOIN orders o ON p.prospect_id = o.prospect_id
GROUP BY c.category_label, c.tier
ORDER BY c.tier;
```

### 5. Conversion Funnel
```sql
-- Pipeline by stage (once you start tracking interactions)
SELECT
    p.tier_label,
    COUNT(CASE WHEN p.pin_type = 'PROSPECT' AND i.interaction_id IS NULL THEN 1 END) as untouched,
    COUNT(CASE WHEN i.type = 'CALL' THEN 1 END) as contacted,
    COUNT(CASE WHEN i.type = 'DEGUSTATION' THEN 1 END) as tasted,
    COUNT(CASE WHEN i.type = 'SAMPLE_SENT' THEN 1 END) as sampling,
    COUNT(CASE WHEN p.pin_type = 'CUSTOMER' THEN 1 END) as converted
FROM prospects p
LEFT JOIN interactions i ON p.prospect_id = i.prospect_id
GROUP BY p.tier_label
ORDER BY p.tier;
```

### 6. Delivery Clustering
```sql
-- Find delivery clusters (multiple prospects near each other)
SELECT l1.city, l1.state, COUNT(*) as prospects_in_area,
       SUM(p.rev_per_loc_high) as combined_monthly_potential
FROM locations l1
JOIN prospects p ON l1.prospect_id = p.prospect_id
WHERE l1.status = 'ACTIVE'
GROUP BY l1.city, l1.state
HAVING COUNT(*) >= 3
ORDER BY combined_monthly_potential DESC;
```

### 7. Product-Category Cross Analysis
```sql
-- Which products sell to which categories
SELECT category_code, category_label,
       UNNEST(applicable_products) as product,
       COUNT(*) as prospect_count,
       SUM(rev_total_monthly_high) as monthly_potential
FROM prospects
GROUP BY category_code, category_label, product
ORDER BY monthly_potential DESC;
```

---

## Dashboard KPIs This Data Powers

### Executive Summary Dashboard
- **Map view**: All 287 locations as colored pins (color = tier, size = revenue potential)
- **TAM gauge**: Monthly $435K-$1.74M with actual revenue overlay as it grows
- **Pipeline funnel**: Prospect → Contacted → Tasting → Sampling → Customer
- **Conversion rate by tier**: Which category types convert best?

### Sales Operations Dashboard
- **Priority queue**: Ranked list of prospects to call, filtered by state/tier
- **Route planner**: Map of next week's delivery stops with combined revenue
- **Outreach tracker**: Number of calls/emails/tastings this week vs. target
- **Win/loss by category**: Which categories say yes vs. no

### Financial Dashboard
- **Revenue forecast**: Based on pipeline stage × conversion probability × revenue estimate
- **Revenue by product**: Which cheese products generate most revenue
- **Revenue by state**: Geographic revenue concentration
- **Customer lifetime value**: Actual order data vs. initial estimate (over time)

### Geographic Intelligence Dashboard
- **Heatmap**: Prospect density by city
- **Drive-time rings**: Concentric zones from Columbus (2h, 4h, 6h, 8h, 10h)
- **Delivery route efficiency**: Revenue per mile driven
- **White space analysis**: Where are there NO prospects? (underserved areas)

---

## Data Lineage and Methodology

### How this data was collected

1. **Web research**: Multiple parallel research agents searched Yelp, Google, OpenTable, TripAdvisor, food blogs, and restaurant directories across all 14 states in the coverage zone
2. **Google Places API verification**: Every business was searched via the Google Places API to confirm it exists, extract exact GPS coordinates, phone number, website, and operational status
3. **Deduplication**: Multi-location brands were identified and grouped; cross-source duplicates were merged keeping the richest data
4. **Closed business removal**: 12 businesses confirmed as permanently closed via Google Places were removed
5. **Revenue modeling**: Category-specific volume and pricing assumptions applied based on restaurant industry cheese purchasing benchmarks
6. **Priority scoring**: Weighted composite score calculated per prospect
7. **Validation**: Automated audit checked every revenue calculation, schema field, duplicate, and summary total. Zero errors in final output.

### Data freshness
- Generated: March 2026
- Google Places data: Verified March 2026
- Recommendation: Re-verify Google Places status quarterly (businesses open and close)

### Known limitations
- 18 locations lack GPS coordinates (marked UNVERIFIED — could not be found on Google Places)
- Revenue estimates are category-level averages, not per-business calculations. Actual revenue will vary based on restaurant size, menu pricing, and location foot traffic.
- Some experimental prospects (cheese shops, meal kits) may have lower conversion probability than estimated
- Coverage zone is straight-line distance, not actual drive time. Some locations may exceed 10 hours actual drive time due to routing.

---

## How to Update This Data Over Time

### When a prospect converts to customer
```json
// Change pinType from "PROSPECT" to "CUSTOMER"
// Start recording actual orders in the orders table
// Compare actual revenue vs. revenueEstimate to refine the model
```

### When you discover a new prospect
```json
// Add to prospects array with next sequential CC-XXXX ID
// Verify via Google Places for coordinates
// Classify using the categoryTaxonomy
// Calculate revenue using the revenueModel
// Score using the priorityScoring formula
```

### Quarterly refresh
- Re-run Google Places verification on all locations to catch closures
- Search for new Georgian restaurants that opened
- Update priority scores if market conditions change

---

*Generated for Colchis Creamery. Version 3.0. March 2026.*
