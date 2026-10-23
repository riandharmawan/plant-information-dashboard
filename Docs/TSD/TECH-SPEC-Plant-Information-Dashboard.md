# Plant Information Dashboard — Technical Specification

**Version:** 1.2
**Date:** 2026-10-20
**Status:** Aligned with PID-FSD-001. Behaviour is defined there. This document is the implementation baseline. `Docs/DATABASE-DESIGN.md` records these decisions before migration `001`. It does not reopen them.
**Audience:** Engineering
**Companion:** `Docs/FSD/FSD-Plant-Information-Dashboard.md` (PID-FSD-001). User and role screens: `Docs/TSD/TSD-Admin-Users-and-Roles.md`.
**Reference system:** Jetty Planning System (local), for environment layout, Docker, and Alicloud only. This product does not share that database, those ports, or that API.

---

## 1. Decision

Turn the current React mockup into a three-tier application without redrawing the screens.

| Layer | Choice |
| --- | --- |
| Container | Docker Compose |
| Database | PostgreSQL 16 |
| Backend | Node.js (Express), REST |
| Frontend | The existing React application and its CSS |

Three environments, each with its own env file. Nothing in Testing or Production reads Dev config.

| Environment | Where it runs | Env file |
| --- | --- | --- |
| Dev | Developer machine | `.env.dev` |
| Testing | Alicloud ECS | `.env.testing` |
| Production | Alicloud ECS | `.env.production` |

The browser keeps calling the methods already defined in `Frontend/src/data/repository.ts`. The JSON shapes in `Frontend/src/domain/types.ts` stay the contract for the screens that exist today. The API returns those shapes directly. It does not wrap them in a `{ success, data }` envelope.

This application is a visualization of Logsheet Builder. Operators and mechanics enter data there. This dashboard does not become a second place to type a sounding, a lab result, or a production figure. It copies what was submitted and draws it.

Logsheet Builder will run at every factory, plant, and site. Each site has its own logsheet forms. Bekasi’s F/TNF-003 and F/QCO-001 are the first site’s forms, not the database shape for the next site. A table per form, or a column set copied from Priscolin, will not survive the second site.

Behaviour, module priorities, and acceptance of the product are in the functional spec. Section 8 is the database that implements those decisions. Section 13 is the build order from functional spec section 7. `Docs/DATABASE-DESIGN.md` is the table-level note written from this section before any SQL. It does not reopen a decision the functional spec has already made.

---

## 2. What the mockup is today

The application is a Vite + React 19 single-page app under `Frontend/`. There is no backend, no database, and no login. Screens render. Writes do not survive a refresh, except tank-calibration overrides, which sit in the browser under `localStorage` key `pid.tankCalibration.v1`.

### 2.1 Screens already built

Shell, sidebar, English/Indonesian copy, and these routes in `Frontend/src/App.tsx`:

| Route | Screen | Data today |
| --- | --- | --- |
| `/` | Live Ops | `OperationsRepository` over `logsheets.json` |
| `/ops-analytics` | Ops Analytics | Same repository. Route exists; sidebar does not link it yet. Keep the route. |
| `/qc` | QC overview | `qc.json` via `Frontend/src/domain/qc.ts` |
| `/qc/storage` | Storage certificates | `qc.json` |
| `/qc/vessel` | Vessel / palka (F/QCO-009) | `qc.json` |
| `/qc/truck` | Truck samples (F/QCO-010) | `qc.json` |
| `/qc/movements` | Gate movements | `qc.json` |
| `/daily-production` | Production summary | Hard-coded days in `dailyProduction.ts` (6–8 Oct 2026) |
| `/daily-production/refinery-500` | Refinery 500 | Same |
| `/daily-production/refinery-150` | Refinery 150 | Same |
| `/daily-production/fractionation-400` | Fractionation 400 | Same |
| `/daily-production/fractionation-500` | Fractionation 500 | Empty |
| `/daily-production/separator` | Separator | Empty, plus downtime and quality columns that are not filled |
| `/daily-production/supporting-materials` | Stock ladder | Eight material names, every quantity is blank |
| `/master` | Master menu | In-memory seed |
| `/master/companies` | Companies | In-memory seed |
| `/master/sites` | Sites | In-memory seed |
| `/master/plants` | Plants | In-memory seed |
| `/master/commodities` | Commodities | In-memory seed |
| `/master/commodities-calibration` | Density lookup | `tankCalibration.json` density tables, read-only |
| `/master/tank-farm` | Tank list | In-memory seed |
| `/master/tank-farm/:tankId` | Tank calibration editor | Seed profile plus `localStorage` override |

### 2.2 Visual system to keep

Do not introduce a component library or a second stylesheet. New UI, including login, uses the existing files:

- `Frontend/src/styles/tokens.css`
- `Frontend/src/styles/shell.css`
- `Frontend/src/styles/dashboard.css`
- `Frontend/src/styles/master.css`
- `Frontend/src/index.css`

Copy stays in `Frontend/src/i18n/messages.ts` (`en` and `id`).

### 2.3 Data the mockup already holds

| Source | What it is | Volume in the workspace |
| --- | --- | --- |
| `Docs/exports/storage-tank-sounding/` | Daily Excel of F/TNF-003 from logsheet-builder | 22 Jul 2026 – 19 Oct 2026, 90 days, about 27 tickets a day |
| `Docs/exports/daily-storage-tank-analytical/` | Daily Excel of F/QCO-001 | 20 Sep 2026 – 19 Oct 2026 requested; 4 days actually analysed |
| `Frontend/src/data/logsheets.json` | Parsed soundings, labs, logistics, movement totals | Runtime file for Live Ops |
| `Frontend/src/data/qc.json` | Storage rows, vessel tickets, truck sheet, movement rows | Runtime file for QC |
| `Frontend/src/data/tankCalibration.json` | Volume tables, ring bands, density tables | Runtime file for quantity |
| `Frontend/src/data/masterSeed.ts` | One company, one site, four plants, nine commodities, tank roster | Runtime seed for Master |
| `Frontend/scripts/sync-sounding.mjs` | Pulls F/TNF-003 from logsheet-builder | Local script, credentials in `Frontend/.env.sync` |
| `Frontend/scripts/sync-analytical.mjs` | Pulls F/QCO-001 | Same |
| `Frontend/scripts/parse-logsheets.mjs` | Excel → `logsheets.json` | Local script |

Logsheet Builder (`https://logsheet-builder.gamasap.com`) is where the team builds the form and where the operator or mechanic fills it in. A form is addressed by its own id. Bekasi sounding is form id `f80caa03-a6b0-4ad7-b823-459b2f828ce3`. Bekasi daily analytical is a different id. Those ids are seed rows, not environment variables. The next site gets new ids and a different sheet. The dashboard stores a copy of those submissions and serves the console. It does not replace the logsheet product.

### 2.4 Site the screens assume

| Record | Value |
| --- | --- |
| Company | PRC GENERAL HO JAKARTA (`PRC-HO`) |
| Site | Bekasi, timezone `Asia/Jakarta` |
| Plant with data | PRISCOLIN PROJ BEKASI |
| Other plants, no logsheets yet | RFI PROJ BEKASI, RFI GENERAL BEKASI, PRC PALM & LAURIC BEKASI |
| Numbered tanks | T01–T08, T10–T16, T20–T29. T09 and T17–T19 are absent. |
| Bulk bins | BAK CURAH CPO A, BAK CURAH CPO B, BAK CURAH CPO DEPAN |
| QC storage roster | T01–T29 printed even when a certificate is missing |

### 2.5 Rules the UI already applies

These stay for the Bekasi screens. They are seed data for that site, not default rules for the next factory. The API must produce the same Bekasi results the local repository produces today.

- Tank id canonical form is `T01`, not `T.01` or `t1`. `canonicalTankId` in `tankCalibration.ts` is the rule.
- Quantity, empty space, loadable stock, and fill ratio come from the calibration profile plus the density table (`stockOf` in `tankStock.ts`). Level alone is not a mass.
- A storage analysis older than 2 days is due for retest (`RETEST_AFTER_DAYS`).
- Storage pass/fail limits are **not configured**. Every oil family is `spec-pending` until the lab supplies a limit per commodity. Do not invent one FFA ceiling.
- Inbound CPO is the only configured gate rule: FFA max 5, moisture (MI) max 0.5, from the F/QCO-009 and F/QCO-010 headers. A palka sample outside that band rejects the vehicle.
- Palka IV band 51–54 and DOBI above 2 are watch limits printed on F/QCO-009, not reject rules.
- Commodity utilisation groups follow the stock report: CPO, RBDPO, OLEIN, RBDPS, IV 64, PMF, PFAD. IV 64 is not olein.
- Refinery yield is `(product / feed)` and loss is `feed − product − coproduct`. Fractionation yield is not computed from the same-day figures (`yieldApplicable: false`) because product and co-product are not same-day feed.
- Refinery 500 is the larger flowmeter; PFAD from it goes to T16. Refinery 150 is the smaller flowmeter; PFAD from it goes to T05.
- Master deletes are blocked when a child row still points at the record (`in-use`). Duplicate codes and names are rejected.

---

## 3. Target architecture

```text
Browser
  React SPA (existing CSS)
        │  same origin  /api/v1
        ▼
pid-web   nginx
        │  private network
        ▼
pid-api   Node.js
        │
        ▼
pid-db    PostgreSQL 16
```

Dev may skip nginx and run Vite on the host against `pid-api`. Testing and Production always use nginx so the browser never calls the API host directly.

Ports are chosen so this stack can sit on the same machine as Jetty Planning System without taking its ports (JPS uses 3000, 3001/3080, and loopback 5436).

| Service | Container | Host port (product default) |
| --- | --- | --- |
| Web | `pid-web` | **3090** → container 80 |
| API | `pid-api` | **3010** → container 3010 |
| Postgres | `pid-db` | **127.0.0.1:5437** → container 5432 |

On the shared Alicloud SIT pair (`172.28.92.56` / `172.28.92.57`) those host ports are already taken (`msd-fe` `:3090`, `project_management_backend_staging` `:3010`). Staging therefore publishes **`3091`** and **`3011`**. The process inside each PID container is unchanged. See [STAGING-3-SERVER-DEPLOY-RUNBOOK.md](../Guide/STAGING-3-SERVER-DEPLOY-RUNBOOK.md).

Postgres is bound to loopback only. Security groups do not open 5437 or 5432 to the internet. On Testing and Production the published API port accepts traffic only from the app server private IP.

---

## 4. Environments

Each environment is a separate database, a separate Docker project name, and a separate env file. Copy the example, fill secrets on that machine, and pass the file explicitly:

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml up -d --build
docker compose --env-file .env.testing -f docker-compose.backend.yml up -d --build
docker compose --env-file .env.production -f docker-compose.backend.yml up -d --build
```

Committed files are the examples only. Real env files are gitignored.

| File in git | Copied to | Used on |
| --- | --- | --- |
| `.env.dev.example` | `.env.dev` | Developer machine |
| `.env.testing.example` | `.env.testing` | Alicloud Testing hosts |
| `.env.production.example` | `.env.production` | Alicloud Production hosts |

`Frontend/.env.sync` stays a local file for logsheet-builder credentials. It is never copied into Testing or Production images. Those credentials live in the API env file on the host that runs ingest.

### 4.1 Dev (local)

Purpose: build and check the app on a workstation.

| Piece | How it runs |
| --- | --- |
| Postgres + API | `docker-compose.dev.yml` |
| React | `npm run dev` in `Frontend/` (Vite). Optional: the same compose file can also build `pid-web`. |
| Database | `pid_db` in the Dev container. Empty on first boot, then migrations and seed. |
| Browser API URL | `http://127.0.0.1:3010/api/v1` |
| Data mode | `VITE_DATA_SOURCE=local` until the endpoint under test exists, then `api` |

Dev does not point at the Testing or Production database.

### 4.2 Testing (Alicloud)

Purpose: shared build the plant can click through, loaded with a copy of logsheet history, not with Production data.

Two ECS instances in one VPC, same pattern as Jetty Planning System:

| Server | Runs | Compose file |
| --- | --- | --- |
| App | `pid-web` only | `docker-compose.app.yml` |
| API | `pid-api` + `pid-db` | `docker-compose.backend.yml` |

Install path: `/opt/plant-information-dashboard`.

SIT (shared hosts, internal only): users open `http://172.28.92.56:3091`. nginx proxies `/api/` to `172.28.92.57:3011`. API data is ApsaraDB, not a `pid-db` container (`docker-compose.backend-api-only.yml`). `VITE_API_URL` is baked at image build as `/api/v1`. `VITE_DATA_SOURCE` is `api`. Dedicated hosts can still use the product-default ports 3090 / 3010.

`CORS_ORIGIN` lists the Testing app origin only.

### 4.3 Production (Alicloud)

Same compose files as Testing. Different hosts, different env file, different database, different `JWT_SECRET`, different logsheet credentials if the upstream account differs.

Start on the two-server layout. Move Postgres to its own ECS later with `docker-compose.db.yml` and `DB_HOST` if the API host needs to scale. Do not do that split on day one.

A third server, when needed:

```text
Browser → App :3090 → API :3010 → DB :5432
```

The DB security group allows 5432 from the API private IP only.

### 4.4 Variables

Same keys in all three examples. Values differ.

```bash
# Identity
APP_ENV=dev                    # dev | testing | production
COMPOSE_PROJECT_NAME=pid-dev  # pid-dev | pid-testing | pid-production

# API
NODE_ENV=development           # production on Testing and Production containers
PORT=3010
CORS_ORIGIN=http://127.0.0.1:5173,http://localhost:5173
JWT_SECRET=change-me
JWT_EXPIRES_IN=8h
COOKIE_SECURE=false            # true only behind HTTPS

# Postgres
POSTGRES_USER=pid_user
POSTGRES_PASSWORD=change-me
POSTGRES_DB=pid_db
# Set on the API host when the database is on another machine.
# DB_HOST=pid-db
# DB_PORT=5432

# Frontend build (read by docker-compose.app.yml)
PID_FE_PORT=3090
VITE_DATA_SOURCE=api
VITE_API_URL=/api/v1           # Dev Vite uses http://127.0.0.1:3010/api/v1

# Logsheet-builder ingest (API host only).
# Credentials for this environment. They are not a form catalog.
# Which form is imported, and when, lives on logsheet_definitions.
# The site timezone lives on sites.timezone.
# Bekasi seed ids (not runtime config): sounding f80caa03-a6b0-4ad7-b823-459b2f828ce3,
# analytical 9e1e978f-18c0-42dc-a558-e28e65bdf5ce.
LOGSHEET_BASE=https://logsheet-builder.gamasap.com
LOGSHEET_IDENTIFIER=
LOGSHEET_PASSWORD=
```

`DATABASE_URL` is assembled by Compose for the API container:

```text
postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${DB_HOST:-pid-db}:5432/${POSTGRES_DB}
```

---

## 5. Repository layout to add

Keep `Frontend/` and `Docs/` where they are. Add:

```text
Backend/
  Dockerfile
  package.json
  src/index.js              # Express app, /api/v1
  src/db.js                 # pg pool
  src/routes/               # one file per area in section 7
  src/domain/               # stock, quality, oil family — same results as the frontend
  migrations/001_....sql
  scripts/migrate.js
  scripts/seed-from-mockup.js
docker-compose.dev.yml      # pid-db + pid-api, optional pid-web
docker-compose.backend.yml  # Testing and Production API host
docker-compose.app.yml      # Testing and Production app host
docker-compose.db.yml       # later, dedicated database host
Frontend/Dockerfile
Frontend/nginx.conf         # local / same-host proxy
Frontend/nginx.alicloud.conf
.env.dev.example
.env.testing.example
.env.production.example
```

Backend runtime is Node 20, `"type": "module"`, driver `pg`, framework Express 4. Migrations are numbered SQL files applied in order. No ORM.

---

## 6. Frontend changes

Existing screens, CSS, and the one-site JSON shapes stay. New screens use the same stylesheets. They do not introduce a component library.

1. `VITE_API_URL` default becomes `http://127.0.0.1:3010/api/v1` in `createRepository.ts` and `.env.example`.
2. `HttpOperationsRepository` stays the Live Ops and Ops Analytics client. Every operational call sends the active site. A group view sends the user’s assigned sites.
3. A site switcher lists only assigned sites. The active site’s timezone controls the business date. English and Indonesian cover every new label.
4. Master, calibration, QC, and daily production gain the same style of repository once their endpoints exist. Until an endpoint exists, that screen keeps its current local data.
5. Calibration stops writing `localStorage` when `VITE_DATA_SOURCE=api`. Dev may still use `localStorage` in `local` mode.
6. New screens, in the build order: coverage, utility, refinery and fractionation as its own page key (the current routes may stay), logsheet catalog, field maps, process units, aliases, stock groups, and quality rules. Each figure can open its trail: site, form code, business date, import time. Table export uses the figures on screen.
7. A login view is added in the access phase. It uses `tokens.css` and `shell.css`.

Quantity math may remain in the frontend for `local` mode. In `api` mode the server returns `quantityKg`, `emptySpaceKg`, `loadableKg`, and `fillRatio` already computed from the calibration stored in Postgres, so two browsers see the same stock. A missing quantity is null, not zero.

---

## 7. API

Base path: `/api/v1`.

Health, with no auth:

| Method | Path | Body |
| --- | --- | --- |
| GET | `/health` | `{ "ok": true, "env": "dev" }` |

### 7.1 Live operations

Already declared in `repository.ts`. Response bodies match `types.ts` for one site. Every operational route takes `siteId`. Omitting it is the group view across the caller’s assigned sites, and the body adds `coverage` (`sitesWithValue`, `sitesAssigned`, `sitesSilent`, `sitesUnmapped`).

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/sites` | Sites on the caller’s assignment |
| GET | `/sites/:siteId` | `SiteContext` |
| GET | `/sites/:siteId/snapshot` | `SnapshotMeta` (`dataSource: "api"`) plus the latest successful import time for the forms behind the screen |
| GET | `/sites/:siteId/live/tanks?on=&from=&to=` | `TankLive[]` |
| GET | `/sites/:siteId/live/logistics` | `LogisticsVehicle[]` |
| GET | `/sites/:siteId/tanks/:tankId/soundings` | `SoundingPoint[]` |
| GET | `/sites/:siteId/tanks/:tankId/labs` | `LabHistoryPoint[]` |
| GET | `/sites/:siteId/analytics/summary?tankId=` | `AnalyticsSummary` |
| GET | `/sites/:siteId/analytics/movements` | `MovementTotal[]` |
| GET | `/sites/:siteId/facts/:factId/trail` | Site, form code, business date, import time, map version |

`GET .../live/tanks` without dates returns the latest sounding per tank, same rule as `LocalOperationsRepository`. A tank with no sounding on the selected day stays on the roster with a null level.

### 7.2 Master

Matches `MasterContext` save/remove results: `{ "ok": true }` or `{ "ok": false, "reason": "missing" | "duplicate" | "in-use" }` with HTTP 400 or 409.

| Method | Path |
| --- | --- |
| GET | `/master` |
| POST, PUT `/master/companies/:id`, DELETE | `/master/companies` |
| POST, PUT `/master/sites/:id`, DELETE | `/master/sites` |
| POST, PUT `/master/plants/:id`, DELETE | `/master/plants` |
| POST, PUT `/master/commodities/:id`, DELETE | `/master/commodities` |
| POST, PUT `/master/tanks/:id`, DELETE | `/master/tanks` |
| GET, POST, PUT, DELETE | `/master/sites/:siteId/aliases` |
| GET, POST, PUT, DELETE | `/master/sites/:siteId/stock-groups` |
| GET, POST, PUT, DELETE | `/master/sites/:siteId/quality-rules` |
| GET, POST, PUT, DELETE | `/master/sites/:siteId/utility-assets` |
| GET, POST, PUT, DELETE | `/master/sites/:siteId/supporting-materials` |
| GET, POST, PUT, DELETE | `/master/plants/:plantId/process-units` |
| GET, POST, PUT, DELETE | `/master/sites/:siteId/logsheets` |
| GET, POST | `/master/logsheets/:id/field-maps` |

`GET /master` returns the `MasterData` shape: `companies`, `sites`, `plants`, `commodities`, `tanks`, plus the site-scoped lists for the active site. Company, site, plant, and commodity writes return 409 once DataHub owns those records. `POST /master/logsheets/:id/field-maps` creates the next map version. It does not edit a version already used by a submission.

### 7.3 Calibration

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/calibration/tanks?siteId=` | Profiles for plants on that site, seed merged with saved overrides |
| GET | `/calibration/tanks/:tankId` | One profile |
| PUT | `/calibration/tanks/:tankId` | Body is `TankProfile`. Run `validateProfile`. 400 plus the issue code on failure. |
| DELETE | `/calibration/tanks/:tankId` | Clears the override and restores the seed profile |
| GET | `/calibration/density/:group` | Rows of `[tempC, density]` for `cpo`, `rpo`, `olein`, `rps`, `pfad` |

### 7.4 Quality and production

Read-only in the first release. The console displays logsheet history; it does not become the lab entry tool yet.

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/sites/:siteId/qc/storage?from=&to=` | `StorageRow[]` |
| GET | `/sites/:siteId/qc/vessels?from=&to=` | `VesselTicket[]` |
| GET | `/sites/:siteId/qc/trucks?from=&to=` | `TruckSheet` |
| GET | `/sites/:siteId/qc/movements?from=&to=` | movement header plus `MovementRow[]` |
| GET | `/sites/:siteId/production/days?from=&to=` | `ProductionDay[]` summed from shift rows. Yield recomputed only where `yield_rule` is `same-day` |
| GET | `/sites/:siteId/production/units/:unitId?from=&to=` | That process unit, including chemicals, utilities, downtime, and quality |
| GET | `/sites/:siteId/production/supporting-materials?from=&to=` | The site’s materials. Null quantities stay null |
| GET | `/sites/:siteId/utility?from=&to=` | Readings by utility asset. The owner source is the figure. The other copy stays on the trail |
| GET | `/sites/:siteId/coverage` | Each definition: form code, name, plant, mapper state, last success, last failure, unmapped-field count |
| GET | `/sites/:siteId/export?screen=&from=&to=` | Spreadsheet of the figures that screen shows. Export does not write facts |

### 7.5 Ingest

Operator or cron, not the browser:

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/ingest/definitions/:id` | Body `{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" }`. Runs that site’s form, not a hard-coded Bekasi report. |
| GET | `/ingest/runs?limit=20` | Recent runs, including definition id and site |

Day one can run the same logic as a CLI inside the API container instead of HTTP. The HTTP form is the target so Testing can be triggered without a shell. A CLI flag selects the definition. It does not assume one sounding form for the whole group.

---

## 8. Database

These decisions come from PID-FSD-001. This section is not the migration. Migration `001` is written only after `Docs/DATABASE-DESIGN.md` records the tables below. That note does not reopen them.

The hard part is not Bekasi’s columns. Bekasi is one site, and even there four plants share the site while only Priscolin has forms. The next factory will bring different form ids, different column names, and tank codes that collide with `T01` if the key is global. The database has to accept that without a new table for every form.

### 8.1 What the database must do

- Hold many companies, sites, and plants. The mockup’s single Bekasi site is the first row, not a constant.
- Let each site own its own logsheet forms. A form may also name the plant it belongs to. Bekasi sounding and Bekasi analytical are two definitions. Another site does not reuse those ids.
- Keep the operator’s submission even when this dashboard does not yet have a screen for that form.
- Feed the screens that do exist (Live Ops, QC, production) from a stable shape, scoped to the site the user is looking at.
- Treat tank `T01` at Bekasi as a different tank from `T01` anywhere else.
- Keep quality rules with the site or the form. FFA max 5 is the Bekasi inbound CPO header, not a group-wide law.
- Store dates as `date` in the site timezone. Store measured quantities as `numeric`.

### 8.2 What it must not do

- A table per logsheet, or a table per site.
- `tank_code` as a primary key.
- A fixed `plant_code` list of `refinery500`, `refinery150`, `fract400`, `fract500`, `separator`. Those are Priscolin sections. Another plant will not have them.
- One pair of env vars (`LOGSHEET_ID`, `LOGSHEET_QCO_ID`) as the catalog. Those become two rows in the logsheet catalog for the Bekasi plant.
- Data entry tables. If a value is wrong, it is corrected in Logsheet Builder and imported again.

### 8.3 Three layers

```text
Organisation          company → site → plant → tank
                      commodity catalog (company-wide, site alias if a local name differs)

Logsheet copy         logsheet_definitions     one row per form at a site or plant
                      logsheet_submissions     one row per import of that form
                      payload jsonb            the sheet as received, columns untouched

Dashboard facts       soundings, lab results, gate samples, movements, production measures
                      filled only by a mapper registered on that definition
                      every row carries site_id and, when the form is plant-scoped, plant_id
```

Layer 2 is the copy of record. A form this app has never seen still lands in `logsheet_submissions` and can be listed as unmapped. Layer 3 is a projection for the screens. Re-import replaces the submission and re-runs the mapper. It does not insert a second sounding for the same business key.

Adding a site is data: a site row, its plants, its tanks, and its logsheet definitions. Adding a screen for a new kind of form is a mapper plus, only if the canonical facts cannot hold the measure, a new fact table. It is not a copy of the Bekasi schema.

### 8.4 Master data

Master data is in the same database note as logsheets and users. The mockup already has the screens. Nothing in this group is typed by an operator on the logsheet. An administrator maintains it here.

The master menu already splits ownership. Keep that split in the tables.

| Group on the master menu | Records | Who owns the data |
| --- | --- | --- |
| DataHub | Company, site, plant, commodity | Sent in later from DataHub. This app stores a copy and the screens can edit it until that feed exists. |
| This plant | Tank farm, tank calibration, commodity density lookup | Owned here. Capacity and the volume table are not on the logsheet. |

Logsheet definitions are master data too. They are how a site is connected to Logsheet Builder. They are not a fact table.

Names can change in `Docs/DATABASE-DESIGN.md`. The relationships cannot. Every master row stores `created_at`, `updated_at`, and `updated_by`.

```text
companies (id, code unique, name, created_at, updated_at, updated_by)

sites (id, company_id → companies, name, timezone,
       unique (company_id, lower(name)))

plants (id, site_id → sites, name,
        unique (site_id, lower(name)))

commodities (id, company_id → companies, code, name,
             unique (company_id, code))

commodity_aliases (
  id, site_id → sites, commodity_id → commodities, source_text,
  unique (site_id, lower(source_text))
)

stock_groups (
  id, site_id → sites, code, name, sort_order,
  unique (site_id, code)
)

process_units (
  id, plant_id → plants, code, name,
  yield_rule,                         -- 'same-day' or 'withheld'
  destination_tank_id → tanks null,   -- Bekasi: Refinery 500 PFAD → T16, Refinery 150 → T05
  unique (plant_id, code)
)

quality_rules (
  id, site_id → sites, commodity_id → commodities,
  scope,                              -- 'storage' or 'inbound'
  parameter_code,                     -- lab.ffa, lab.moisture, …
  bound,                              -- 'max' or 'min'
  limit_value numeric null,           -- null means spec pending
  severity,                           -- 'reject' or 'watch'
  unique (site_id, commodity_id, scope, parameter_code, severity)
)

utility_assets (
  id, site_id → sites, plant_id → plants null, code, name, kind,
  unique (site_id, code)
)

supporting_materials (
  id, site_id → sites, code, name,
  unique (site_id, code)
)

tanks (id, plant_id → plants, code,
       unique (plant_id, code))
```

Rules the design note must keep, because the screens and the functional spec already enforce them:

- A company cannot be removed while a site points at it. A site cannot be removed while a plant points at it. A plant cannot be removed while a tank points at it. A tank cannot be removed while a sounding or a calibration row points at it. The API reason is `in-use`.
- Duplicate company code, duplicate site name inside a company, duplicate plant name inside a site, duplicate commodity code inside a company, and duplicate tank code inside a plant are `duplicate`.
- Blank required fields are `missing`.
- Tank code is unique per plant. `T01` at two plants is two rows.
- Commodities belong to the company. A sheet that prints `RPO/RBDPO` or `ROL` resolves through `commodity_aliases`. That is not a second commodity list.
- Stock groups belong to the site. Bekasi seeds CPO, RBDPO, OLEIN, RBDPS, IV 64, PMF, and PFAD. IV 64 is its own group.
- Process units belong to the plant. Refinery 500, Refinery 150, Fractionation 400, Fractionation 500, and Separator are Priscolin rows. Another plant configures its own units. Same-day yield is product divided by feed, and loss is feed minus product minus co-product. `yield_rule = withheld` shows the tonnes and leaves yield empty.
- Quality rules belong to the site and the commodity. An empty rule yields spec pending. Bekasi inbound CPO is FFA max 5 and moisture max 0.5, severity `reject`. Palka IV 51–54 and DOBI above 2 are severity `watch`. Storage limits are not seeded.
- When DataHub sends company, site, plant, and commodity, those screens become read-only. Tank farm, calibration, aliases, stock groups, process units, quality rules, utility assets, supporting materials, and the logsheet catalog stay editable here.
- An unknown tank code on a submission stays on the payload and is listed as unmapped. Import does not insert a tank.

Calibration and density stay master data attached to the tank, as in section 8.5. They are not logsheet submissions.

### 8.4.1 Logsheet catalogue

This is the master record that points at a form in LogSheet Builder. Organisation tables stay in section 8.4.

```text
logsheet_definitions (
  id,
  site_id → sites,                 -- required
  plant_id → plants null,          -- set when the form belongs to one plant
  external_id,                     -- logsheet-builder form UUID, unique per site when known
  form_code,                       -- local label, e.g. F/TNF-003, unique per site
  name,
  mapper_key null,                 -- null means stored, not drawn
  schedule,                        -- local times in the site timezone, or null until mapped
  unique (site_id, form_code)
)

field_map_versions (
  id, definition_id → logsheet_definitions, version int,
  unique (definition_id, version)
)

field_map_rows (
  id, version_id → field_map_versions,
  source_field,                    -- header text on that site’s sheet
  canonical_code,                  -- FSD Appendix B: sounding.level, lab.ffa, util.steam, check.result
  unit,                            -- unit on the sheet
  conversion,                      -- explicit, e.g. cm → m; null when units already match
  entity_hint,                     -- tank, shift, process unit, asset
  required boolean,
  unique (version_id, source_field)
)

logsheet_submissions (
  id,
  definition_id → logsheet_definitions,
  map_version_id → field_map_versions null,
  business_key,                    -- unique inside that definition
  period_start date,
  period_end date,
  payload jsonb,                   -- current copy
  imported_at,                     -- UTC
  unique (definition_id, business_key)
)

submission_history (
  id, submission_id → logsheet_submissions,
  map_version_id, payload jsonb, imported_at
)

ingest_runs (
  id, definition_id, map_version_id null,
  range_from, range_to, status,
  detail jsonb,                    -- unmapped fields, rows missing a required tank or date
  started_at, finished_at
)
```

The business key is unique inside one definition, so two sites can both have `T01 | 2026-10-19 | round 1`. Keys follow the functional spec:

| Observation | Key inside that form |
| --- | --- |
| One sounding round | Business date + tank code + round index |
| One storage certificate snapshot | Business date + tank code + revision |
| One incoming vessel ticket | Ticket or sample identity printed on the sheet; if none, vessel + arrival date + commodity |
| One truck sample | Sample number |
| One production shift row | Business date + process unit + shift + role (feed, product, co-product) |
| One utility reading | Business date + asset + measure |
| One checklist | Business date + form + item |

Re-import replaces `logsheet_submissions.payload` and writes the previous payload to `submission_history`. It then rebuilds the facts. It does not insert a second sounding for the same key.

Canonical codes are the Appendix B catalog (`sounding.level`, `lab.ffa`, `util.steam`, `check.result`, and the rest). A new shared measure is a new code. It is not a new table per site. A column with no code stays on the payload and is counted as unmapped. A missing required field keeps the submission and withholds the fact.

Bekasi F/TNF-003 and F/QCO-001 can ship with a mapper that already knows those headers, recorded as map version 1. A renamed column is a new map version. Submissions already stored keep the version they were read with until they are re-imported. Units convert only through `conversion`. A value whose unit is unknown is stored and excluded from totals.

All 41 Priscolin forms in functional spec Appendix A are catalog rows. `external_id` is filled when the LogSheet Builder id is known. The two known ids are the sounding id `f80caa03-a6b0-4ad7-b823-459b2f828ce3` and the analytical id `9e1e978f-18c0-42dc-a558-e28e65bdf5ce`.

### 8.5 Dashboard facts

These tables exist so the screens stay fast and so the current TypeScript shapes can be filled. They are projections. The submission payload remains after the projection is built.

Every fact row includes `site_id`, `plant_id` where the form is plant-scoped, and `submission_id`. Natural keys are never global.

```text
soundings (
  id, site_id, plant_id, tank_id → tanks, submission_id,
  recorded_on date, round_index,
  product_name, commodity_id null, level_m, temperature_c, operational_status,
  unique (tank_id, recorded_on, round_index)
)

The sounding, storage-certificate, and refinery-quality projections are specified in `Docs/DATABASE-DESIGN.md` under “Three logsheet projections”. `storage_certificates` is the F/QCO-001 header. Its tests are `certificate_parameters`, not `lab_results`. F/QCO-002 is `refinery_quality_days` and its children. `lab_results` remains in migration 001 and is not written for these forms.

production_measures (
  id, site_id, plant_id, process_unit_id → process_units, submission_id,
  recorded_on date, shift, role,          -- feed, product, coproduct
  quantity numeric, unit,
  flow_start numeric null, flow_end numeric null,
  unique (process_unit_id, recorded_on, shift, role)
)

utility_measures (
  id, site_id, plant_id, asset_id → utility_assets null, submission_id,
  recorded_on date, canonical_code, quantity numeric, unit,
  owner boolean,                          -- the map marks one source as the owner when two forms carry the same steam or power
  unique (site_id, recorded_on, canonical_code, asset_id, submission_id)
)

checklist_results (
  id, site_id, plant_id, submission_id,
  recorded_on date, item, result, remark
)
```

Gate samples, vessel tickets, truck samples, and movements follow the same rule: foreign keys to site, plant, and submission. A day total for a process unit is the sum of its shift rows. A duplicated flowmeter span that repeats the same start and end is counted once.

Mass (`quantity`, empty space, loadable stock, fill ratio) is computed at read time from the tank profile and the density table. Capacity and bottom stock share `capacity_unit` and are converted to kilograms first: `kg` is unchanged, and a tonne is 1,000 kg. A unit the converter does not know leaves those figures null. Level alone is not a mass. Sounding mass is shown to two decimal places of kilograms. Yield is shown as a percentage to one decimal place. A quantity that cannot be computed is null, never zero.

Calibration hangs off `tanks.id`, not off a tank code:

```text
tank_profiles (tank_id primary key → tanks, capacity, capacity_unit default 'kg',
               bottom_stock, …, origin)
tank_volume_points (tank_id, height_mm, volume_litre, primary key (tank_id, height_mm))
tank_ring_bands (id, tank_id, low_mm, high_mm, offset_mm)
tank_ring_volumes (tank_id, ring_index, volume_litre, primary key (tank_id, ring_index))
density_points (density_group, temp_c, density, primary key (density_group, temp_c))
```

Density tables are group-wide reference data for this release, seeded from `tankCalibration.json`. A later site that brings its own density sheet adds a nullable `site_id` on `density_points`. Bekasi’s table is not assumed to be every site’s table.

Delete rules match the UI inside a site: a company with sites, a site with plants, a plant with tanks, and a tank referenced by a sounding or a calibration row cannot be deleted.

### 8.6 User and role management

Users and roles are part of the same database design. They are not a column added the week login is built. The mockup has no user screen yet. The design note still specifies the tables, the seed roles, and what each role may do. Admin screens for users and roles come later. The tables are in migration `001`.

Follow the Jetty Planning System shape: a user has roles, a role has permissions, and a permission is view, edit, or delete on a page. Add site assignment, which Jetty does with ports and this product does with sites. Do not share Jetty’s user table.

```text
users (
  id, username unique, display_name, email unique null,
  password_hash, is_active, created_at, updated_at
)

roles (
  id, name unique, description,
  is_system_role,          -- true for seeded roles that cannot be deleted
  created_at, updated_at
)

permissions (
  id,
  resource_type,           -- 'page' for this release
  resource_key,            -- stable key, not the translated label
  can_view, can_edit, can_delete,
  unique (resource_type, resource_key)
)

role_permissions (role_id → roles, permission_id → permissions,
                  primary key (role_id, permission_id))

user_roles (user_id → users, role_id → roles,
            primary key (user_id, role_id))

user_sites (user_id → users, site_id → sites,
            primary key (user_id, site_id))
```

A person can see a tank, a logsheet, or a plant master row only when that row’s site is in `user_sites` and the role has `can_view` on that page. Edit and delete follow the same site check plus `can_edit` or `can_delete`. Company rows sit above a site: viewing a company requires at least one assigned site under it. Editing a company requires the company permission.

Page keys the design note must list, matching the sidebar plus the admin screens that do not exist yet:

| resource_key | Screen |
| --- | --- |
| `live-ops` | Live Ops |
| `ops-analytics` | Ops Analytics |
| `qc` | Quality control, including storage, vessel, truck, movements |
| `daily-production` | Daily production report |
| `refinery-fractionation` | Refinery and fractionation process view |
| `utility` | Utility |
| `coverage` | Unmapped forms and ingest coverage |
| `master-companies` | Companies |
| `master-sites` | Sites |
| `master-plants` | Plants |
| `master-commodities` | Commodities, aliases, and stock groups |
| `master-calibration` | Commodity density and tank calibration |
| `master-tanks` | Tank farm and process units |
| `master-logsheets` | Logsheet definitions and field maps |
| `master-quality-rules` | Site quality limits |
| `admin-users` | User management |
| `admin-roles` | Role management |

Seed two system roles. Further roles are data, added from role management, not a code change.

| Role | is_system_role | What it can do |
| --- | --- | --- |
| Administrator | true | View, edit, and delete on every page above. Assigned to the sites they administer. The first seed user is this role. |
| Viewer | true | `can_view` on `live-ops`, `ops-analytics`, `qc`, and `daily-production` only. Utility, refinery, coverage, master, and admin pages are not on this role. |

Rules the design note must state:

- Passwords are stored as a hash. The seed command reads `SEED_ADMIN_USERNAME` and `SEED_ADMIN_PASSWORD` from the env file and does not write the password back out.
- A system role cannot be deleted. Its permissions can be adjusted only by a user who has `admin-roles` edit.
- A role that is still assigned to a user cannot be deleted (`in-use`).
- A user who is the last active Administrator cannot be deactivated.
- An empty `user_sites` list means no sites. It does not mean every site. The first administrator is given Bekasi explicitly by the seed.
- User management and role management are themselves permission-gated. A Viewer never receives those keys.
- Operators and mechanics do not need an account in this app to record a sounding. They use Logsheet Builder. Accounts here are for people who look at the dashboard or maintain master data.
- A user may hold more than one role. Permissions are the union of those roles, still limited to `user_sites`.
- Site Manager, QC, Production, Utility, Tank Farm, Group Viewer, and Master Data are created as data when those people are enrolled. They are not extra system roles.

### 8.7 Seed

Seed is idempotent on the unique keys above.

1. Company, Bekasi site (`Asia/Jakarta`), four plants, commodities, Priscolin tanks, from `masterSeed.ts`.
2. Bekasi stock groups, process units (with yield rules and PFAD destinations), commodity aliases used by the current sheets, and the Bekasi quality rules in functional spec Appendix C.
3. All 41 Priscolin form codes from functional spec Appendix A as `logsheet_definitions`. Mapper and schedule set only for the forms in the build order. Known external ids: F/TNF-003 and F/QCO-001.
4. Map version 1 for F/TNF-003 and F/QCO-001. Submissions plus projected soundings and lab results from `logsheets.json`.
5. Calibration from `tankCalibration.json`, attached to those tank ids.
6. F/RFA-004(A) and F/RFA-004(B) projected into `production_measures` for the Priscolin process units, including the 6–8 October 2026 days already on the screen.
7. Permissions for the page keys in section 8.6, the Administrator and Viewer roles, one administrator user, and a `user_sites` row for Bekasi.

### 8.8 Decisions recorded from the functional spec

`Docs/DATABASE-DESIGN.md` copies these. It does not reopen them. Migration `001` is not written until that note exists.

1. A logsheet requires a site. `plant_id` is set when the form belongs to one plant. Bekasi sounding and analytical belong to Priscolin.
2. Business keys are the table in section 8.4.1.
3. First mappers, in order: F/TNF-003 and F/QCO-001, then F/RFA-004(A) and F/RFA-004(B), then F/QCO-009, F/QCO-010, and F/TNF-004. Every other Appendix A form is stored with `mapper_key` null.
4. Commodities are company-wide. A local sheet name is a `commodity_aliases` row.
5. Fact tables for the first cut are soundings, lab results, and production measures. Gate samples, movements, utility measures, and checklist results are added when those mappers are switched on. Columns with no canonical code stay on the payload.
6. When DataHub sends company, site, plant, and commodity, those screens become read-only. Tanks, calibration, and the logsheet catalog stay editable here.
7. Page keys are section 8.6. Seeded system roles are Administrator and Viewer only. No `user_sites` row means no access.
8. A user may hold more than one role. Permissions are the union, still limited to assigned sites.

---

## 9. Ingest

Ingest reads Logsheet Builder. It does not collect keystrokes from operators.

For each active `logsheet_definitions` row:

1. The API logs into logsheet-builder with that environment’s `LOGSHEET_IDENTIFIER` and `LOGSHEET_PASSWORD`.
2. It downloads that definition’s `external_id` for a date range.
3. It upserts `logsheet_submissions` on `(definition_id, business_key)` and appends the previous payload to `submission_history`.
4. If `mapper_key` is set, it rebuilds the dashboard facts for that submission using the current field-map version.
5. It writes an `ingest_runs` row for that definition, including unmapped fields and rows that failed a required tank or date.

The Bekasi parsers in `parse-logsheets.mjs` become the mapper for those two definitions. A later site gets its own mapper or a field map. It does not get a fork of the Bekasi tables.

Schedule is stored per definition (site timezone), not as one clock for the group. The first two jobs, after the design is in place:

| Definition | When | Mapper |
| --- | --- | --- |
| Priscolin F/TNF-003 | 06:30 and 14:30 Asia/Jakarta | Live Ops soundings |
| Priscolin F/QCO-001 | 07:00 Asia/Jakarta | Storage lab results |

A failed day is recorded and skipped. It does not roll back days that already loaded. Credentials never go into the frontend image and never go into git.

---

## 10. Auth

The tables are designed in Phase 0 (section 8.6) and created in migration `001`. The login screen and the user and role admin screens are built in Phase 7, before Testing is opened past the office network.

The mockup has no login. Testing must not be exposed on a public EIP until login is on.

Phase order:

1. Read APIs open on Dev only.
2. Before the Testing security group allows anything except the office IP, add login and the user and role screens.
3. Login is username and password. JWT in an HttpOnly cookie, same idea as Jetty Planning System. No token in `localStorage`.
4. What a person can open comes from their roles and `user_sites`, not from a hard-coded viewer/master flag.
5. Downstream Hub / OIDC is out of this release. The env file may reserve the keys later. Do not build it now.

`COOKIE_SECURE=false` on Dev (HTTP). `true` on Production only when the app origin is HTTPS.

---

## 11. Docker

### 11.1 Images

| Image | Base | Notes |
| --- | --- | --- |
| `pid-db` | `postgres:16-alpine` | Named volume `pid_pgdata`. Healthcheck `pg_isready`. |
| `pid-api` | `node:20-alpine` | `npm ci`, run `src/index.js`. Depends on a healthy database. |
| `pid-web` | Node 20 build, then `nginx:alpine` | `npm run build`. Vite reads `VITE_DATA_SOURCE` and `VITE_API_URL` as build args. |

### 11.2 nginx

`Frontend/nginx.alicloud-app.conf` proxies `/api/` to the Testing or Production API private address. The browser talks only to the App host port (`3091` on shared SIT; `3090` on a dedicated host).

```text
location /api/ {
  proxy_pass http://<api-private-ip>:3011;   # SIT host port; container still listens on 3010
}
location / {
  try_files $uri $uri/ /index.html;
}
```

The private IP is edited on the app host per environment. It is not hard-coded in git as a production address. Dev `nginx.conf` proxies to `pid-api:3010` on the compose network.

### 11.3 What is not in the image

- `.env.dev`, `.env.testing`, `.env.production`
- `Frontend/.env.sync`
- `Docs/exports/**/*.xlsx`
- `node_modules`

---

## 12. Security

- Postgres is not reachable from the internet.
- The published API port on Alicloud accepts the app server only (`3011` on shared SIT; `3010` on a dedicated host).
- The App host port is the only user port (`3091` on shared SIT; `3090` on a dedicated host). Restrict it to the office / VPC range.
- SSH 22 stays on the admin IP.
- `JWT_SECRET` and `POSTGRES_PASSWORD` differ across the three env files.
- Logsheet passwords sit only on the API host.
- Master write endpoints check the page permission and the user’s sites once auth is on.
- Errors return a message and a status code. They do not return SQL or stack traces when `APP_ENV` is `testing` or `production`.

---

## 13. Build order

This follows functional spec section 7. The mockup keeps running on local JSON until the endpoint for that screen exists.

### Phase 0 — Database note

Write `Docs/DATABASE-DESIGN.md` from section 8 and section 8.8. The note has three chapters: master data, logsheets, and user and role management. It includes the versioned field map, process units, aliases, stock groups, quality rules, submission history, and the page keys.

Done when a second site is described as new rows (site, plant, a tank coded T01, two form ids, a user assigned only to that site) and the note does not add a table to hold them. No migration file exists before that.

### Phase 1 — Foundation

- `Backend/` with Express, `/api/v1/health`, Postgres pool.
- `docker-compose.dev.yml`, three env examples, gitignore for the real env files.
- Migration `001` from the database note.
- Seed section 8.7: organisation, all 41 form codes, mappers for F/TNF-003 and F/QCO-001, soundings and lab results.
- `Frontend` stays on `VITE_DATA_SOURCE=local` until the comparison in Phase 2.
- Done when `GET http://127.0.0.1:3010/api/v1/health` returns ok and `pid-db` survives a container restart.

### Phase 2 — Tank Farm and QC storage

- Section 7.1 and the storage route in section 7.4, scoped by site.
- Compare Live Ops and storage with `local` mode for Bekasi tank T01, a tank with no sounding, and the latest day.
- Done when level, temperature, calibrated quantity, and the retest badge match, and a second site’s T01 is a different tank.

### Phase 3 — Daily production and refinery

- Map F/RFA-004(A) and F/RFA-004(B) onto the Priscolin process units.
- Daily production and the unit pages read `production_measures`.
- Done when 6 October 2026 Refinery 500 feed, product, and PFAD match the sheet, yield equals product divided by feed, and Fractionation 400 shows its tonnes with yield empty. Supporting-material quantities stay null.

### Phase 4 — Gate and movement

- Map F/QCO-009, F/QCO-010, and F/TNF-004.
- Vessel, truck, and movement screens, plus the oil-movement block on the daily report, read those facts.
- Done when a Bekasi inbound CPO sample above FFA 5 or moisture 0.5 is rejected, and a site with no inbound rule stays spec pending.

### Phase 5 — Access, then Testing

- Login, cookie, and admin screens for users and roles, on the tables from section 8.6.
- App host and API host, `.env.testing`, nginx, office-only security group.
- Open Testing beyond the office only after login and site assignment work.
- Done when a Bekasi viewer cannot see a second site, and a user assigned only to that second site cannot see Bekasi.

### Phase 6 — Utility and the remaining forms

- Utility module, in-process quality, outbound release, and supporting-material quantities as each map is confirmed.
- Coverage lists every definition, including those still unmapped.
- Done when a utility reading that also sits on the production sheet is counted once, from the source the map marks as owner.

### Phase 7 — Production

- Clone the Testing layout with `.env.production` and an empty operational database, then run ingest for the plant window. Do not copy the Testing database over Production.

---

## 14. Out of scope for this baseline

- Rewriting the CSS or replacing React.
- Data entry for operators or mechanics. That stays in LogSheet Builder.
- Lab data entry, approvals, or e-signatures inside this app.
- Editing density tables in this release. The lookup stays read-only.
- Inventing supporting-material quantities, separator tonnes, or downtime hours the sheets do not contain. Those cells stay blank. Fractionation tonnes that are on F/RFA-004(B) are in scope, and fractionation yield stays empty.
- Sharing a database or a login with Jetty Planning System.
- Downstream Hub SSO.
- A dedicated database server. The compose file can wait until the API host is actually tight.
- Public internet exposure before auth.

---

## 15. Acceptance for the first production-ready cut

The cut is Production-ready when all of the following are true:

1. Dev, Testing, and Production each start from their own env file and their own database.
2. An authorised Bekasi user sees Tank Farm, QC storage, and the Daily Production Report from imported logsheets, in English and in Indonesian, with the current CSS.
3. Refresh and a second browser show the same tanks, quantities, and master rows.
4. A sounding re-import for the same site, tank, day, and round replaces the previous level and does not insert a second row. The previous payload remains on the trail. The same tank code at another site is a different tank.
5. A new site and its own logsheet forms can be added as rows in the catalog. They do not need a new table. A user assigned only to that site cannot see Bekasi.
6. Storage verdicts stay spec pending until a limit is configured for that site and commodity. Bekasi inbound CPO still fails above FFA 5 or moisture 0.5. A site without that rule does not inherit it.
7. For 6 October 2026 at Priscolin, Refinery 500 matches F/RFA-004(A). Fractionation tonnes display and fractionation yield stays empty.
8. A renamed column is handled by a new field-map version. A column with no canonical code is listed as unmapped and leaves existing totals unchanged.
9. A group total shows how many assigned sites contributed. A missing value is blank, not zero.
10. Postgres and the API are not open to the internet.
11. Logsheet credentials are not in the frontend image and not in git.

---

## 16. File map for the next session

| Keep and read | Why |
| --- | --- |
| `Docs/FSD-Plant-Information-Dashboard.md` | Behaviour. This spec implements it |
| Section 8 and section 13 of this spec | Tables and build order |
| `Frontend/src/data/masterSeed.ts` | The first company, site, and plants. Proof the model is already multi-plant |
| `Frontend/.env.example` | Two different logsheet-builder ids for one plant. The next site adds more |
| `Frontend/src/domain/types.ts` | API response contract for the current screens |
| `Frontend/src/data/repository.ts` | First eight endpoints |
| `Frontend/src/data/httpRepository.ts` | Client already written |
| `Frontend/src/domain/present.ts` | How a raw sounding becomes a card |
| `Frontend/src/domain/tankStock.ts` | Quantity |
| `Frontend/src/domain/qualitySpec.ts` | Retest and the one inbound rule |
| `Frontend/src/domain/master.ts` | Master payloads and `SaveResult` |
| `Frontend/src/domain/qc.ts` | QC payloads |
| `Frontend/src/domain/dailyProduction.ts` | Production payloads |
| `Frontend/src/styles/*.css` | The visual system |

Jetty Planning System documents to copy as a pattern, not as code: `docker-compose.backend.yml`, `docker-compose.app.yml`, `Frontend/Dockerfile`, `Frontend/nginx` proxy, and `Docs/Guide/ALICLOUD-DEPLOYMENT-GUIDE.md`.
