# Technical Specification — Refinery quality

| | |
| --- | --- |
| Document ID | PID-TSD-003 |
| Version | 1.0 |
| Date | 20 October 2026 |
| Status | Implementation baseline |
| Audience | Engineering |
| Functional source | `Docs/FSD/FSD-Refinery-Quality.md` (PID-FSD-003, version 1.1) |
| Wireframe | `canvases/refinery-quality-lofi.canvas.tsx` |
| Parent implementation | `Docs/TSD/TECH-SPEC-Plant-Information-Dashboard.md` |

Behaviour, blank-cell rules, and acceptance days are in the functional spec. This document says how to build that page on the stack that already exists. It does not add a framework, a component library, or a second stylesheet.

---

## 1. Tech stack

The choices below are the ones already locked by the parent technical spec and the current packages. This feature uses them. It does not introduce another.

| Layer | Requirement |
| --- | --- |
| Container and environments | Docker Compose. Dev, Testing, and Production each have their own env file. A test import never writes the production database |
| Database | PostgreSQL 16. Access through the existing `pg` pool in `Backend/src/db.js` |
| Backend | Node.js 20, Express 4, ESM (`"type": "module"`). JSON bodies. Session cookie already issued by `/api/v1/auth` |
| API prefix | `/api/v1`. QC routes already mount at `/api/v1/sites/:siteId/qc` in `Backend/src/index.js`. This feature adds paths on that router (`Backend/src/routes/qc.js`) |
| Frontend | React 19, Vite 8, TypeScript, react-router-dom 7. No new UI library |
| Charts | Recharts 3, the same `LineChart` structure as `Frontend/src/features/live-ops/QuantityHistoryDialog.tsx` |
| Styles | `Frontend/src/styles/tokens.css`, `shell.css`, `dashboard.css`. New rules only when a class from those files cannot express the screen |
| Copy | `Frontend/src/i18n/messages.ts`, English and Indonesian |
| Workbook read | SheetJS (`xlsx`), already a Frontend dev dependency. Used by the mapper script, not by the browser |
| Source system | LogSheet Builder at `https://logsheet-builder.gamasap.com`. Form F/QCO-002, external id `54c4be2f-6076-4f6e-b897-90f12622d142`. Date filter `f5a319ef-984d-4114-9744-908c6c41fd0c`. Credentials stay in `Frontend/.env.sync` and are not committed |

The browser does not download the workbook. The mapper reads files already saved by `Frontend/scripts/sync-refinery-quality.mjs` under `Docs/exports/daily-quality-refinery/`. That script stays the download. It does not call `parse-logsheets.mjs`.

---

## 2. Why these rows are not `lab_results`

`lab_results` and `storage_certificates` store one certificate per tank per snapshot. `tank_id` is required, and the unique key is `(tank_id, snapshot_on, revision)`.

An F/QCO-002 hour carries up to five streams. Destinations in the October 2026 files include `CR.401` and `RFI T.04`, which are not rows in `tanks`. Putting those hours into `lab_results` would either drop the row or invent a tank. This feature uses its own projection, still tied to `logsheet_submissions`.

`quality_rules.scope` stays `storage` or `inbound`. This feature writes no verdict.

---

## 3. Schema

The tables, keys, and tenancy rules are in `Docs/DATABASE-DESIGN.md`, section “Refinery quality (F/QCO-002)”. This section does not restate a second shape.

Migration `Backend/migrations/003_refinery_quality.sql` must match that section before it is applied: natural key `(process_unit_id, production_date)`, composite foreign keys to the plant and the unit, the parameter check, and the `(site_id, production_date)` index. `flow_rate` stays on the reading. `lab.break_test` is the only text parameter.

---

## 4. Mapper

Script: `Frontend/scripts/map-refinery-quality.mjs`.

Input: `Docs/exports/daily-quality-refinery/F-QCO-002_YYYY-MM-DD.xlsx`. Output: rows in the tables above, through the API’s import path or a direct database write using the same Backend env as `npm run migrate`. The script does not start the browser and does not edit Daily Production sample data.

### 4.1 Definition and map

Seed, on the Priscolin site:

| Field | Value |
| --- | --- |
| `form_code` | `F/QCO-002` |
| `external_id` | `54c4be2f-6076-4f6e-b897-90f12622d142` |
| `mapper_key` | `refinery-quality` |
| Process unit | `Refinery 150 MTD` on the sheet maps to process unit code `refinery150`. `Refinery 500 MTD` maps to `refinery500` |

Field-map version 1 stores one `field_map_rows` line per stream parameter, with `source_field` equal to `{stream}.{code}` (for example `finished_good.lab.ffa`). The same printed header `FFA` appears on three streams, so the source field includes the stream. The parser still reads by column index, because the export uses merged group headers. The map row is the record of which concept that index feeds.

Column indexes on TABLE 1, header row pair confirmed on the 14–20 Oct 2026 files:

| Index | Stream | Code or field |
| --- | --- | --- |
| 0 | reading | `observed_time` |
| 1 | reading | `from_tank_text` |
| 2 | reading | `flow_rate` |
| 3 | `raw_material` | commodity text |
| 4–13 | `raw_material` | `lab.ffa`, `lab.moisture`, `lab.dobi`, `lab.iv`, `lab.pv`, `lab.av`, `lab.totox`, `lab.color_r`, `lab.color_y`, `lab.color_b` |
| 14–16 | `bleaching_oil` | `lab.color_r`, `lab.color_y`, `lab.color_wb` |
| 17 | `bleaching_oil` | `lab.break_test` |
| 18 | `finished_good` | commodity text |
| 19–25 | `finished_good` | `lab.ffa`, `lab.moisture`, `lab.iv`, `lab.pv`, `lab.color_r`, `lab.color_y`, `lab.color_wb` |
| 26 | `finished_good` | destination text |
| 27 | `finished_good` | stream remark, kept on the stream only when present |
| 28 | `by_product` | commodity text |
| 29–30 | `by_product` | `lab.ffa`, `lab.moisture` |
| 31 | `by_product` | destination text |
| 32–33 | `spent_earth` | `lab.moisture`, `lab.oc` |
| 34 | reading | `remark` |

Indexes 35 and above are empty in this export and are ignored.

### 4.2 Parse rules

1. Business date is the `YYYY-MM-DD` after `Date of Production`. Report date is the date after `Date of Report`. A file whose production date does not match the file name is skipped and listed on the ingest run.
2. Plant text `Refinery 150 MTD` selects process unit `refinery150`. Any other plant text keeps the submission payload and writes no day row. The ingest run lists it.
3. A data row is one whose first cell matches `HH:MM`.
4. Tank text is normalised with the existing rule: `T.11` and `T11` become `T11`. Lookup is against `tanks` for that plant. No match leaves `from_tank_id` or `destination_tank_id` null and records the printed text. The job does not insert a tank.
5. Commodity text resolves through `commodity_aliases` for the site. Seed aliases: `RPO/RBDPO` → RBDPO, `RPS/RBDPS` and `RRPS/RRBDPS` → RBDPS, `CPO` → CPO, `PFAD` → PFAD. An unknown text is stored and `commodity_id` stays null. A destination of T.05 does not fill the by-product name.
6. Break test is stored as printed and shown with one capitalisation. `clear` and `Clear` compare equal.
7. The workbook bytes, or the parsed row array, go in `logsheet_submissions.payload`. The screen reads the projection, not the payload.

---

## 5. API

Both routes require a session and view on page key `qc`, the same gate as the other QC routes. `siteId` is the site on the user’s account. A site the user is not assigned returns the same denial the other site routes already return.

### 5.1 Snapshot

`GET /api/v1/sites/:siteId/qc/refinery?from=YYYY-MM-DD&to=YYYY-MM-DD`

The roster is the latest `production_date` inside the inclusive range, the same rule Tank & Stock uses for the latest sounding day. No `from` or `to` uses the latest imported production date as both ends.

Response:

```json
{
  "productionDate": "2026-10-20",
  "reportDate": "2026-10-21",
  "processUnit": "refinery150",
  "processUnitName": "Refinery 150",
  "declaredOils": "CPO",
  "importedAt": "2026-10-20T04:46:00.000Z",
  "hoursLogged": 3,
  "figures": {
    "finishedFfa": { "oil": "RPO/RBDPO", "low": 0.043, "high": 0.046 },
    "feedFfa": { "oil": "CPO", "value": 3.983, "time": "08:00" },
    "byproductFfa": null
  },
  "streams": [
    { "stream": "raw_material", "hoursWithResult": 1, "figure": "FFA 3.983" },
    { "stream": "finished_good", "hoursWithResult": 3, "figure": "FFA 0.043–0.046" },
    { "stream": "bleaching_oil", "hoursWithResult": 0, "figure": null },
    { "stream": "by_product", "hoursWithResult": 0, "figure": null },
    { "stream": "spent_earth", "hoursWithResult": 0, "figure": null }
  ],
  "oils": ["CPO", "RPO/RBDPO"],
  "readings": [
    {
      "time": "08:00",
      "fromTank": "T.12",
      "flowRate": 6,
      "feedOil": "CPO",
      "feedFfa": 3.983,
      "feedMoisture": 0.312,
      "feedDobi": 2.766,
      "finishedOil": "RPO/RBDPO",
      "finishedFfa": 0.043,
      "colorR": 2,
      "colorY": 20,
      "toTank": "RFI T.04",
      "remark": null
    }
  ]
}
```

A range with no submission returns `productionDate: null`, null figures, five streams with `hoursWithResult: 0`, and `readings: []`. It does not return zeros for FFA.

`figure` on a stream is the display string the screen prints. Finished FFA is `low–high` when more than one hour has a value, and the single number when one hour has it. Feed FFA is the sample value. Several samples on one day are joined in sheet order, not averaged.

`oils` is the distinct feed and finished commodity text on that day. The client filter uses this list.

A column whose value is null on every reading of that day is still present in the JSON as null. The screen omits the column.

### 5.2 History

`GET /api/v1/sites/:siteId/qc/refinery/history?from&to&oil=RPO/RBDPO&parameter=lab.ffa&stream=finished_good`

One point per production date in the range that has at least one numeric value for that oil, stream, and parameter.

```json
{
  "oil": "RPO/RBDPO",
  "parameter": "lab.ffa",
  "stream": "finished_good",
  "points": [
    { "productionDate": "2026-10-14", "low": 0.042, "high": 0.063, "count": 20 },
    { "productionDate": "2026-10-20", "low": 0.043, "high": 0.046, "count": 3 }
  ]
}
```

Dates with no value are omitted. The client draws a gap. Low and high are the minimum and maximum of the hourly numbers. The API does not return an average of those hours.

A single feed sample has `low` and `high` equal to that sample.

---

## 6. Screen

### 6.1 Route and access

| Item | Value |
| --- | --- |
| Route | `/qc/refinery` |
| Query | `from` and `to`, same date-range component as Tank & Stock |
| Permission | view on `qc` |
| Sidebar | Under Quality Control, next to Storage, Vessel, and Truck |
| Page class | `page page--prod page--ops` |

Files:

| File | Role |
| --- | --- |
| `Frontend/src/features/qc/RefineryQualityPage.tsx` | Page |
| `Frontend/src/features/qc/RefineryHistoryDialog.tsx` | History dialog |
| `Frontend/src/App.tsx` | Route |
| `Frontend/src/layout/Sidebar.tsx` | Link |
| `Frontend/src/i18n/messages.ts` | Labels |

The page loads through the existing `api()` helper in `Frontend/src/data/api.ts`. It does not read `qc.json`.

### 6.2 Layout

Same vertical order as `Frontend/src/features/live-ops/LiveOpsPage.tsx`.

1. Header: title, site pill, the snapshot production date, `DateRangeFilter`.
2. Four `prod-kpi` figures: hours logged, finished FFA, feed FFA, by-product FFA. A missing figure is the same empty mark the rest of the app uses (`-`), not zero.
3. Stream lines in the `commodity-stock` pattern from `CommodityStock.tsx`: name, track, hours with a result, figure. The bar width is `hoursWithResult / hoursLogged`. A stream with no result has an empty track and `-`.
4. Section head `Readings`, with the existing `view-toggle` (table, then cards) and an oil filter built like `CommodityFilter.tsx`.
5. The hour roster.

### 6.3 Table

Copy the sort behaviour of `Frontend/src/features/live-ops/TankTable.tsx`.

- Class `prod-table`.
- First click on a header sorts ascending. The second click sorts descending.
- Empty values sort last in both directions.
- `aria-sort` on the header.
- Idle mark and active mark match that table.
- A numeric figure the user can open is a `button.qty-link`. Finished FFA, feed FFA, and a stream figure open the history dialog.

Default columns, dropped when every cell of the snapshot day is null: Time, From tank, Flow, Feed oil, Feed FFA, M&I, DOBI, Finished oil, Finished FFA, Colour (R and Y together), To tank, Remark.

### 6.4 Cards

The card view uses the same fields as the table row, in the tank-card rhythm: time as the title, finished oil, finished FFA, colour, destination, and the feed sample when that hour has one. The oil filter applies to both views.

### 6.5 History dialog

Copy `QuantityHistoryDialog.tsx`.

- Element `<dialog class="stock-dialog qty-dialog">`, opened with `showModal`, closed from the dialog `close` event and from the close button.
- Heading: oil, then the parameter name. Example: `RPO/RBDPO - FFA`.
- Line under the heading: the selected range, formatted with the active language.
- `qty-stats` shows the low and the high across the returned points. It does not show an average of hourly FFA.
- Chart sits in `chart-frame qty-chart`.
- Footer uses `btn btn--secondary` and the existing close label.

Chart, matching `QuantityChart` in that dialog and the second series colour from `QualityChart.tsx`:

| Setting | Value |
| --- | --- |
| Library | Recharts `LineChart` inside `ResponsiveContainer`, height 280 |
| Grid | `CartesianGrid` stroke `#E0E0E0`, `vertical={false}` |
| Lines | Low: stroke `#114C5A`, width 2. High: stroke `#10B981`, width 2 |
| Nulls | `connectNulls={false}` |
| Animation | `isAnimationActive={false}` |
| Axis | X is the production date. Y is the parameter value. Tick size 11 |

### 6.6 Daily Production link

The Refinery 150 quality block specified in the functional spec stays on that page. The finished-oil name is a link to `/qc/refinery?from={productionDate}&to={productionDate}`. This technical spec does not change the summary production table.

### 6.7 Language

Every new label has an `en` and an `id` entry in `messages.ts`. Sheet remarks stay in the language printed on the form.

---

## 7. Logic the API must apply

| Rule | Implementation |
| --- | --- |
| Snapshot day | `MAX(production_date)` where `production_date` is between `from` and `to` for that site |
| Hours logged | Count of readings on that day |
| Hours with a result | Readings that have a stream row for that stream |
| Finished FFA low and high | Min and max of `lab.ffa` on `finished_good` for that oil that day |
| Feed FFA | `lab.ffa` values on `raw_material`, in `row_index` order. One value is a single number |
| By-product FFA | Same, on `by_product`. Null when that stream has no FFA |
| Declared, not tested | Banner oil text that matches no commodity text on the day’s streams. Shown on the raw-material line when that day is the snapshot |
| Empty range | Null figures, empty readings. No zero FFA |
| History | Group by `production_date`. Low and high. No average |
| Pass or fail | Not computed |

Numbers keep the precision stored from the sheet. The screen formats with the active locale.

---

## 8. Build order

1. Migration `003_refinery_quality.sql` and the F/QCO-002 definition, map version, process-unit link, and commodity aliases.
2. Mapper over the workbooks already in `Docs/exports/daily-quality-refinery`.
3. The two GET routes.
4. The page, dialog, sidebar link, and both languages.
5. The finished-oil link on the Refinery 150 production page.

---

## 9. Acceptance

Using the workbooks for 14–20 October 2026 after the mapper has run:

1. `GET .../qc/refinery?from=2026-10-14&to=2026-10-20` returns production date 20 Oct, 3 hours, finished FFA 0.043–0.046, feed FFA 3.983, by-product FFA null.
2. The 14 Oct submission stores 23 readings. Finished FFA low is 0.042 and high is 0.063, from 20 parameter rows. The 08:00 raw-material FFA is 4.258. The 07:00 by-product FFA is 87.296 and its commodity text is empty.
3. 15 Oct `declared_oils` contains CPKO, and no stream that day has commodity text CPKO.
4. A second import of 14 Oct leaves 23 readings, not 46.
5. `CR.401` and `RFI T.04` are stored as destination text with a null tank id. No new tank row exists for them.
6. The history call for finished `lab.ffa` and oil `RPO/RBDPO` over 14–20 Oct returns a low and a high per day and no average.
7. The screen table sorts, the card toggle and the oil filter use the Tank & Stock controls, and the history dialog uses `stock-dialog qty-dialog` and the chart settings in section 6.5.
8. Refinery 500 has no day rows from this extract.
