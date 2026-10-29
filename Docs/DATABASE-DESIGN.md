# Plant Information Dashboard — Database design

**Version:** 1.0
**Date:** 2026-10-20
**Source:** `Docs/TECH-SPEC-Plant-Information-Dashboard.md` section 8 and `Docs/FSD-Plant-Information-Dashboard.md`

This note records the tables in `Backend/migrations/001_foundation.sql`. It does not reopen the functional spec.

Master ids are the stable text ids already used by the mock (`bekasi`, `tank-t01`). Fact rows use `bigint`. Dates are `date`. Measured quantities are `numeric`. Import timestamps are `timestamptz` in UTC.

## Organisation and access

`companies`, `sites`, `plants`, `commodities`, `commodity_aliases`, `stock_groups`, `tanks`, `quality_rules`.

A tank code is unique inside a plant. Commodities belong to the company. An alias belongs to a site.

`users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_sites`. No site row means no access. This slice seeds the rows and does not yet require a login.

## Calibration

`tank_profiles`, `tank_volume_points`, `tank_ring_bands`, `tank_ring_volumes`, `density_points`.

Profile capacity is `capacity` plus `capacity_unit`, default `kg`. Bottom stock is `bottom_stock` in that same unit. A plant may store `ton` instead. Stock math converts `kg` and tonne spellings to kilograms before empty space, loadable stock, and fill ratio. Any other unit is left unconverted, so those figures stay null rather than mixing units.

Volume-table heights are stored in **metres** (`height_m`), because that is the unit the sounding workbook and `stockOf` compare. Ring bands are millimetres.

## Logsheet copy

`logsheet_definitions` (site required, plant when the form belongs to one plant, schedule in the site timezone), `field_map_versions`, `field_map_rows`, `logsheet_submissions`, `submission_history`, `ingest_runs`.

A re-import updates the submission and appends the previous payload to `submission_history`.

## Facts this slice reads

`soundings`, `lab_results`, `logistics_events`, `analytics_movements`, `storage_certificates`, `vessel_tickets`, `vessel_palka_samples`, `truck_batches`, `truck_samples`, `gate_movements`.

Every fact row carries `site_id` and `submission_id`. Sounding and lab rows also carry `plant_id` and `tank_id`.

## Created empty for later modules

`process_units`, `utility_assets`, `supporting_materials`, `production_measures`, `utility_measures`, `checklist_results`.

Nothing in this slice reads them. `production_measures` and `gate_movements` as created in migration `001` are not the projections for F/RFA-004 or F/TNF-004. Those forms are specified under “Refinery daily log, fractionation, and oil movement”. `utility_measures` and `checklist_results` stay unused. The thirteen utility reports are specified under “Utility logsheets”.

## Bekasi seed rules

Inbound CPO: FFA max 5 and moisture max 0.5, severity reject. Palka IV outside 51–54 and DOBI at or below 2 are watch rows. Storage limits are not seeded. Retest after two days is applied when a tank card is built, not stored as a column.

## Three logsheet projections

Tank Farm, Daily Storage Tank Analytical, and Refinery quality each keep the sheet in `logsheet_submissions` and read a projection. Re-import updates that submission, appends the previous payload to `submission_history`, and rebuilds only that submission’s projection.

Shared rules:

- Commodities belong to the company. Printed names resolve through `commodity_aliases` for the site. Unknown text is kept. Import does not invent a commodity.
- A tank code is unique inside a plant. An unknown code stays on the payload and does not insert a tank.
- The plant on a fact belongs to the site. The tank or process unit belongs to that plant. `plants` has `UNIQUE (id, site_id)`. `process_units` and `tanks` have `UNIQUE (id, plant_id)`. Fact rows use those pairs as foreign keys.
- A blank cell stays null. It is not stored as zero.
- Retest age and calibrated sounding mass are computed when the screen is read. They are not columns.

### Tank Farm: Storage Tank Sounding (F/TNF-003)

One row per tank, per business date, per round, in `soundings`. Bekasi logs two rounds (06:30 and 14:30). `round_index` separates them. “Latest sounding” is a read rule. The table keeps every round.

| Column | Rule |
| --- | --- |
| `site_id`, `plant_id`, `tank_id`, `submission_id` | Required. Tank and plant are the pair above |
| `recorded_on` | Required business date |
| `round_index` | Round on that date |
| `product_name` | Sheet text |
| `commodity_id` | Site alias, null when none matches |
| `level_m` | `sounding.level`, metres |
| `temperature_c` | `sounding.temperature` |
| `operational_status` | `sounding.status` |

Quantity, empty space, loadable stock, and fill ratio are not columns. They are computed from that tank’s calibration and the density table. A level the calibration cannot resolve stays null.

Natural key: `UNIQUE (tank_id, recorded_on, round_index)`. Business key inside the site’s F/TNF-003 definition: `{recordedOn}|{tankCode}|{roundIndex}`. Index `(site_id, recorded_on)` serves the day roster. Source file for the Bekasi load: `Frontend/src/data/logsheets.json` (2,407 soundings).

### Daily Storage Tank Analytical (F/QCO-001)

One certificate per tank, per snapshot date, per revision. `analysis_date` is when the laboratory tested. `snapshot_on` is the business date of the file. A row was analysed that day only when the two dates are equal. Retest is analysis age greater than two days on the selected snapshot. That comparison is not stored.

`storage_certificates` is the header. `lab_results` is not written. Tests are child rows in `certificate_parameters`, one filled cell each.

Header columns: `site_id`, `plant_id`, `tank_id`, `submission_id`, `snapshot_on`, `analysis_date`, `revision`, `oil` (sheet text), `commodity_id`, `temperature_c`, `capacity`, `quantity`, `empty_space`, `odor`, `remark`. The quantities are the numbers printed on this form. They are not the sounding mass.

`certificate_parameters`: `certificate_id`, `canonical_code`, exactly one of `numeric_value` or `text_value`. `UNIQUE (certificate_id, canonical_code)`. Codes on this sheet: `lab.ffa`, `lab.moisture`, `lab.color_r`, `lab.color_y`, `lab.iv`, `lab.pv`, `lab.dobi`, `lab.totox`, `lab.smp`, `lab.cloud_point`, `lab.anv`, `lab.carotene`, `lab.phosphorus`. A new test is a new code, not a new column. The wide test columns already on `storage_certificates` are not the record. Screens read the child rows.

Natural key: `UNIQUE (tank_id, snapshot_on, revision)`. Business key: `{snapshotOn}|{tankCode}|{revision}`. Live Ops joins a tank’s sounding to the latest certificate whose `analysis_date` is on or before that sounding day. Source file: `Frontend/src/data/qc.json` (225 certificates). Vessel, truck, and movement rows in that file are not this projection.

### Refinery quality (F/QCO-002)

These hours do not fit a storage certificate. A tank is required there, and one hour here has up to five streams. Destinations such as `CR.401` and `RFI T.04` are not tanks. Another site’s Refinery 150 is a different `process_units` row.

```text
sites -> plants -> process_units -> refinery_quality_days
logsheet_submissions -> refinery_quality_days
refinery_quality_days -> refinery_quality_readings
refinery_quality_readings -> refinery_quality_streams
refinery_quality_streams -> refinery_quality_parameters
```

`refinery_quality_days` is the fact header: `site_id`, `plant_id`, `process_unit_id`, `submission_id`, `production_date`, `report_date`, `declared_oils`. `production_date` is the business date. `report_date` is the banner date. `declared_oils` is the banner text (`CPO`, or `CPO, CPKO`). A declared oil with no sample is not a result row.

`UNIQUE (submission_id)`. `UNIQUE (process_unit_id, production_date)`. Foreign keys `(plant_id, site_id)` to `plants` and `(process_unit_id, plant_id)` to `process_units`. Index `(site_id, production_date)`.

Business key inside the site’s F/QCO-002 definition: `{productionDate}|{processUnitCode}`, for example `2026-10-14|refinery150`. Re-import deletes the day row. Readings, streams, and parameters cascade.

`refinery_quality_readings` hang off the day and do not repeat `site_id`. `row_index` is sheet order, so 14 Oct can run 08:00 through 07:00 and two `20:00` rows both stay. `observed_time` is the clock text. `flow_rate` is the unlabeled sheet number, not feed tonnes. `from_tank_text` is what was printed. `from_tank_id` is set only when that code is a tank of the same plant. `UNIQUE (day_id, observed_time, row_index)`.

`refinery_quality_streams` exist when that hour has a commodity, a destination, or a parameter. `stream` is one of `raw_material`, `bleaching_oil`, `finished_good`, `by_product`, `spent_earth`. One stream per hour. `commodity_text` is the sheet wording. `commodity_id` is the alias, null when the site has none. `destination_text` keeps `CR.401` and `RFI T.04`. `destination_tank_id` is null unless the text matches a tank of that plant.

`refinery_quality_parameters` are one filled cell. Blank and `-` create no row. Exactly one of `numeric_value` or `text_value`. `lab.break_test` is the text code. Every other code is numeric: `lab.ffa`, `lab.moisture`, `lab.dobi`, `lab.iv`, `lab.pv`, `lab.av`, `lab.totox`, `lab.color_r`, `lab.color_y`, `lab.color_b`, `lab.color_wb`, `lab.oc`. `UNIQUE (stream_id, canonical_code)`.

Before any day row: process units `refinery150` and `refinery500` on plant `priscolin-proj-bekasi`, site aliases for `CPO`, `RPO/RBDPO`, `RPS/RBDPS`, `RRPS/RRBDPS`, and `PFAD`, and the F/QCO-002 definition (`mapper_key` `refinery-quality`, external id `54c4be2f-6076-4f6e-b897-90f12622d142`). This extract fills Refinery 150 only. Source file: `Frontend/src/data/refineryQuality.json` (7 days, 147 readings). The workbooks are no longer in the export folder.

## Refinery daily log, fractionation, and oil movement

F/RFA-004(A), F/RFA-004(B), and F/TNF-004 follow the same rules as the three projections above. The submission keeps the workbook. Facts hang off the site, the plant, and a process unit or a tank. A name that is not a master stays text. Blank and `-` are null. A printed number is stored as printed, including a negative total. The mapper does not recompute a flowmeter total and does not invent a zero for a form that was not submitted.

`production_measures` and `gate_movements` from migration `001` are replaced before any of these rows are inserted. The tables below are the projection.

### Refinery daily log (F/RFA-004(A))

External id `b1d7e44d-e90d-447f-9772-ffecba657b1e`. The extract has two workbooks, both `Plant : Ref 150`: 19 Oct (5 tickets) and 20 Oct (4 tickets). `production_date` is the date in the file name. A plant line that also prints another date stays inside the submission copy.

`production_measures` allows one row per unit, date, shift, and role. Shift 1 on 19 Oct has two feed runs, so that key is too small.

```text
sites -> plants -> process_units -> production_days
logsheet_submissions -> production_days
production_days -> production_flows
production_days -> production_materials
production_days -> production_utilities
production_days -> production_remarks
```

`production_days` is the fact header: `site_id`, `plant_id`, `process_unit_id`, `submission_id`, `production_date`. `UNIQUE (submission_id)`. `UNIQUE (process_unit_id, production_date)`. Foreign keys `(plant_id, site_id)` to `plants` and `(process_unit_id, plant_id)` to `process_units`. Business key inside the site’s F/RFA-004(A) definition: `{productionDate}|{processUnitCode}`, for example `2026-10-19|refinery150`. Re-import deletes the day. Flows, materials, utilities, and remarks cascade. Child rows do not repeat `site_id`.

`production_flows` is one printed line: `day_id`, `block`, `row_index`, `shift_text`, `commodity_text`, `commodity_id`, `from_tank_text`, `from_tank_id`, `started_at`, `ended_at`, `flow_start`, `flow_end`, `quantity`, `unit`, `destination_text`, `destination_tank_id`. `block` is `feed`, `product`, or `coproduct`. `UNIQUE (day_id, block, row_index)`. `shift_text` keeps `Shift 1`, `Shift 3`, and `Long Shift 1`. Clock columns stay text. Feed is the CPO, RPO, RPS, and RPOL block and its unit is tonnes. Product is RBDPO, RRBDPO, and RRPS. Coproduct is PFAD. Product and PFAD headers do not print a unit, so `unit` stays null. `T.12` resolves to a tank of that plant. `RFI T.03` and `CR.401` stay in the text columns with a null tank id.

`production_materials` is one supporting-material line: `day_id`, `shift_text`, `material`, `row_index`, `slot`, `quantity`, `tank_volume`, `total_quantity`, `unit`, `lot`, `grade`. `material` is `bleaching_earth` or `phosphoric_acid`. `row_index` is the printed line inside that material block, so two Shift 1 lines both stay. `UNIQUE (day_id, material, row_index, slot)`. Bleaching earth has up to three bags on one line, so `slot` is 1, 2, or 3, `quantity` is the bags, and `unit` is bags. Phosphoric acid uses `slot` 1: `quantity` is usage, `tank_volume` is the tank volume, `total_quantity` is the printed total, and `lot` is the lot text. The sheet prints no unit for the acid, so `unit` stays null.

`production_utilities` is one utility line: `day_id`, `row_index`, `shift_text`, `canonical_code`, `quantity`, `flow_start`, `flow_end`, `unit`, `owner`. `UNIQUE (day_id, shift_text, canonical_code, row_index)`. Steam is one total and the sheet prints no unit. Power is kWh. Gas is mmBtu. A shift that logs steam twice keeps both rows; `row_index` distinguishes them. `owner` marks the source the field map names, so a later boiler form does not add the same steam again.

`production_remarks`: `day_id`, `row_index`, `section_text`, `shift_text`, `remark`. `UNIQUE (day_id, row_index)`. A dash is null.

`Ref 150` maps to process unit `refinery150`. `refinery500` is seeded and gets no rows from this extract.

### Fractionation daily log (F/RFA-004(B))

External id `476fba4b-8ee8-4e3b-8fb1-627da45a47d3`. The same `production_days`, `production_flows`, `production_utilities`, and `production_remarks` tables. This range downloaded zero workbooks, so the form is specified and no rows are inserted.

Feed is RBDPO and ROL. Product is olein. Coproduct is stearin. Utilities are steam, power, and water. This form has no bleaching-earth or phosphoric-acid block, so it writes no `production_materials` rows. Yield is not a column. Process units `fractionation400` and `fractionation500` are seeded on `priscolin-proj-bekasi` before a later file can land. Business key: `{productionDate}|{processUnitCode}`.

### Monitor Masuk dan Keluar Minyak (F/TNF-004)

External id `200e78d6-a1d6-4cfe-b01c-69b02909d345`. Twenty-three workbooks, one per date that had tickets. The sheet has no tonnes. Each line is a vehicle visit: vehicle, commodity, time in, time out, customer or vessel, seal in, seal out, operator, and a remark. The remark often names a tank (`T28`, and sometimes `T 27 + T 25`).

`gate_movements` as created has no business date and no row key.

```text
sites -> plants -> oil_movement_days
logsheet_submissions -> oil_movement_days
oil_movement_days -> oil_movements
```

`oil_movement_days`: `site_id`, `plant_id`, `submission_id`, `movement_date`. `UNIQUE (submission_id)`. `UNIQUE (site_id, movement_date)`. Foreign key `(plant_id, site_id)` to `plants`. Business key inside the site’s F/TNF-004 definition: `{movementDate}`. Re-import deletes the day. Visits cascade.

`oil_movements`: `day_id`, `row_index`, `vehicle`, `commodity_text`, `commodity_id`, `time_in`, `time_out`, `customer`, `seal_in`, `seal_out`, `operator`, `remark`, `tank_text`, `tank_id`. `UNIQUE (day_id, row_index)`. `tank_id` is set only when the remark names one tank of that plant. A remark that names two tanks stays in `tank_text` and `tank_id` is null. Direction is not stored. The screen derives it from the seals. Quantity is not stored, because the sheet has none.

`olein`, `olein tolling`, and the printed spelling `Olein toling` are aliases of one commodity. `Cpo` and `CPO` likewise. The alias is stored. A typo does not become a new commodity.

## Utility logsheets

Thirteen utility reports. The extract is 21 Sep–20 Oct 2026: 13 reports, 243 workbooks. Two reports downloaded nothing. A day with no tickets is not a row of zeros.

`utility_measures` and `checklist_results` in migration `001` are one flat quantity or one checklist line, with no day header and no row key. Hourly boiler tags, a coal shift, and a repeated checklist item do not fit that grain. Those two tables stay unused. The tables below are the projection.

Same rules as the other projections. The submission keeps the workbook. `recorded_on` is the date in the file name. A banner that also prints the previous date stays in the submission copy. Blank and `-` create no value. A printed number is stored as printed, not recomputed. An Indonesian cell with a comma uses the comma as the decimal mark. A dot followed by exactly three digits, and no comma, is a thousands separator (`21.611` next to `35900`). Anything else with a dot keeps the dot as a decimal mark (`5810.6`).

Steam, power, and gas on F/RFA-004 stay the owner for the daily production report. Readings on these utility forms are `owner = false` until a field map says otherwise. A steam flowmeter on the boiler sheet is not copied into `util.steam`.

```text
sites -> plants -> utility_assets -> utility_days
logsheet_submissions -> utility_days
utility_days -> utility_readings
utility_days -> utility_material_uses
utility_days -> utility_loader_runs
utility_days -> utility_checks
utility_days -> utility_jobs -> utility_job_checks
```

`utility_days`: `site_id`, `plant_id`, `asset_id`, `submission_id`, `recorded_on`, `place_text`, `shift_banner`. `UNIQUE (submission_id)`. Foreign key `(plant_id, site_id)` to `plants`. `asset_id` references `utility_assets` and is null when the report names no asset. `UNIQUE (asset_id, recorded_on, submission_id)` is not the business key. The business key lives inside that form’s definition: `{recordedOn}|{assetCode}`. A report with no asset uses `{recordedOn}`. Two forms can record the same boiler on the same day. Re-import deletes the day and the children cascade. Child rows do not repeat `site_id`.

Seed before any day, on plant `priscolin-proj-bekasi`:

- `taihu-15tph`, kind `boiler`
- `wuxi-15tph`, kind `boiler`
- `wheel-loader`, kind `loader`
- `wwtp`, kind `effluent`

A sample-point name printed as a column group stays `group_text`. It does not insert an asset. A typo in a header (`Deaerahtor`, `Condesat Refeneri`) stays the printed text.

### Shared children

`utility_readings`: `day_id`, `row_index`, `observed_time`, `shift_text`, `group_text`, `tag_text`, `numeric_value`, `text_value`, `unit`, `remark`, `canonical_code`, `owner`. `UNIQUE (day_id, row_index)`. Exactly one of the two values, unless the result is blank and the remark is the information (`cct t 500 stop`), in which case both values are null and `remark` is kept. `771/0,1`, `yes`, `v`, and `x` are text. A cell that is one number plus a unit suffix (`60 %`, `24 jam`) stores the number and that unit. The limit printed inside a tag (`960 max °C`) stays in `tag_text`. It does not become a quality rule.

`utility_material_uses`: `day_id`, `row_index`, `group_text`, `material_text`, `lot`, `received_qty`, `used_qty`, `remaining_qty`, `unit`, `operator`, `remark`. `UNIQUE (day_id, row_index)`. The sheet prints no unit, so `unit` stays null. This is not a stock ladder. Opening is not invented from the previous day’s remaining.

`utility_loader_runs`: `day_id`, `row_index`, `shift_text`, `hour_start`, `hour_end`, `hours_total`, `fuel_liters`, `oil_liters`, `remark`. `UNIQUE (day_id, row_index)`. The printed total is stored. It is not recomputed from the two hour meters.

`utility_checks`: `day_id`, `row_index`, `item_text`, `result`. `result` is `yes` or `no`, taken from the column that carries the check mark. `UNIQUE (day_id, row_index)`. The same item text can repeat. `row_index` keeps each copy.

`utility_jobs`: `day_id`, `row_index`, `period_text`, `performed_on`, `done_by`. `UNIQUE (day_id, row_index)`. `utility_job_checks`: `job_id`, `item_text`, `result`. `performed_on` is the date printed on the row. `recorded_on` on the day is the file date. They are allowed to differ.

### What each report writes

| Report | Form no. on the sheet | External id | Workbooks | Asset | Children |
| --- | --- | --- | --- | --- | --- |
| Operational Boiler Daily Report Taihu 15 TPH | F/UTI-001 | `2877806f-02dc-4332-8a18-1d515c531001` | 29 | `taihu-15tph`, place `Control Room` | One reading per clock and tag. Groups are pressure, temperature, water level, and blower. The banner shift (`3, 4, 5`) stays on the day. Hours are not assigned to a shift. |
| Operational Boiler Taihu 15 t/h Daily Report (Local) | F/UTI-002 | `f9db0b0c-6518-4ca7-80dc-f5763521857f` | 30 | `taihu-15tph`, place `Local` | Same reading shape. The description is the tag, including the unit words. `Flowmeter Steam (Kg)` is a meter reading, `canonical_code` null. The builder’s ticket count of 20002 is not the row count. |
| Operational Boiler Daily Report Wuxi 15 TPH | none printed | `3538d238-442b-4add-9f9d-ce14aae06ba8` | 0 | `wuxi-15tph` | No rows. The same hourly reading shape applies when a file arrives. |
| Form Pemakaian Bahan Bakar Taihu | F/UTI-004 | `0a1b0c28-1780-43d9-8c79-46b9ce2a82b1` | 29 | `taihu-15tph` | One clock line becomes four readings: coal, steam meter, speed, and flori, plus the remark. Steam is not `util.steam`. |
| Logbook Pemakaian Chemical Boiler | F/UTI-005 | `232ca732-aae1-49e9-937e-80d3d0f156bd` | 6 | `taihu-15tph` | One material-use row per chemical. The section title (`Kuriverter N-300`) is `group_text`. The row name (`Oxy Away Plus`, `BP-800`, `CA-12010`) is `material_text`. |
| Monitoring Display Meter Listrik | none printed | `cc2e0682-4681-4ef9-a13d-3a51dd786c86` | 0 | none | Definition only. This is not F/UTI-006. The briefing uses F/UTI-006 for Monitoring Display Meter Air, and this catalog title says Listrik. No columns are invented. |
| Logsheet Batu Bara | F/UTI-010 | `1d5bb87a-74f1-41a5-b692-ad210107a0d6` | 29 | `taihu-15tph` | One reading per filled cell on the shift row: incoming low and mix (kg and pile), blending mix and low (buckets, origin, kg per bucket, destination), consumption (buckets, origin, kg), steam distribution, the printed ratio, silo level, and fly-ash haul. The ratio is not recomputed. |
| Wheel loader checklist | F/UTI-011 (a) | `8faf8a0f-7938-405b-8caf-c6cb3763c247` | 28 | `wheel-loader` | Checklist rows. The banner has a month and no shift. |
| Wheel loader fuel and hour meter | F/UTI-011 (b) | `f49949cb-4e6d-4958-a7df-9c40e89b90fd` | 28 | `wheel-loader` | One loader run per shift. Fuel and oil stay null when the cells are blank. |
| Laporan Analisa Air Boiler | F/UTI-012 | `834ce78e-3eed-4f3b-bef4-af84dc50728e` | 28 | none | Readings. `group_text` is the column group (boiler water, deaerator, feed tank, condensate refinery, condensate tank farm). `shift_text` is the printed shift. `tag_text` keeps the test and the printed range. |
| Laporan Analisa Air WTP & WWTP | F/WTP-001 | `767e5297-f861-4a65-ab27-cbb0d07f8253` | 28 | none | Same reading shape. Groups are RO 1, RO 2, Bak Baku, sand filter, carbon filter, softener, CCT fractionation 200 and 500, DCT 150 and 500, and WWTP. |
| Realization & Verification Cleaning RO | F/WTP-006 | `305c8641-93d0-4c55-9d71-28ee9d7eeee3` | 1 | none | One job. The 2 Oct file contains a September row performed on 30 Sep. The four verifications are job checks. |
| WWTP Operational | F/WWTP-001 | `0826ff96-b12d-42db-ad59-93bea313e4da` | 7 | `wwtp` | Readings. `group_text` is the section: general, consumable receiving, inlet, outlet, aeration pond. An empty section writes nothing. |
