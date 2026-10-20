# Functional Specification Document

## Plant Information Dashboard

| | |
| --- | --- |
| Document ID | PID-FSD-001 |
| Version | 1.0 |
| Date | 20 October 2026 |
| Status | Draft for review |
| Audience | Product owners, plant operations, IT architecture, engineering |
| Companion | `Docs/TECH-SPEC-Plant-Information-Dashboard.md` (implementation baseline) |
| Source system | LogSheet Builder, live at one site and rolling out to further factories |
| Reference | `Docs/LogSheet/E-Logsheet_Management_Brief_Priscolin_Bekasi.pdf` — *E-Logsheet Digitalisation, Management Briefing (PT. Priscolin Bekasi)*, IT Project Downstream, KPN Corp |

---

## 1. Executive Summary and Business Objectives

### 1.1 What this product is

The Plant Information Dashboard is the group visualisation and reporting layer for operational data that operators already record in LogSheet Builder.

LogSheet Builder lets each site build digital forms that follow that site’s own paper standard. Operators and mechanics fill those forms. The dashboard reads the submitted forms, keeps a faithful copy, and turns the fields that have a shared meaning into stock, quality, utility, and production figures. People who need a plant picture use the dashboard. People who record a sounding, a lab result, or a shift tonne continue to use LogSheet Builder.

The first live site is PT. Priscolin at Bekasi, under PRC General HO Jakarta. Four plants sit on that site. Only Priscolin currently has logsheets. The briefing for that site registers **41 forms** across four departments. The next factory will bring its own form codes, column titles, tanks, and process units. The dashboard has to accept that factory as new configuration, and still show one set of group figures.

### 1.2 The problem this specification solves

Two needs pull in opposite directions.

Each site must keep the form its people already know. Bekasi sounding is F/TNF-003. Another site may title the same act differently, number tanks differently, and run a different set of process units. A database or a screen copied from Priscolin’s columns will fail on the second site, and it will fail again the day Priscolin renames a column.

Head office still needs one view: how much oil is in the group, which tanks are overdue for retest, how the refineries yielded yesterday, and whether the daily production report can be produced without retyping Excel. Those figures only exist if every site’s local sheet can be read as the same kind of fact.

The product rule is therefore:

> A site may change its form. The group figures keep their meaning. A form the dashboard has never seen is stored and listed. It does not break the sites that are already mapped.

### 1.3 Business objectives

| ID | Objective | Success looks like |
| --- | --- | --- |
| BO-1 | Give head office and site leadership one place to see plant performance | An authorised user opens the dashboard and sees only the sites they are assigned, in that site’s timezone, with the latest imported day marked |
| BO-2 | Produce the Daily Production Report from submitted logsheets | Feed, product, co-product, yield, loss, chemicals, and the utility readings that sit on the production sheets are filled from the forms, for the selected dates |
| BO-3 | Keep each site’s form standard intact | Adding or altering a site’s logsheet does not require a new table and does not change another site’s screens |
| BO-4 | Make the second factory a configuration exercise | A new site is a company or site row, its plants, its tanks, its form definitions, and a field map. Unmapped forms still land and are visible as unmapped |
| BO-5 | Show data coverage honestly | A group total states how many assigned sites contributed. A missing map, a missed ingest, or a blank quantity is visible. It is never stored as zero |
| BO-6 | Shorten the morning reporting cycle | Sounding and the daily analytical are imported on a schedule in the site timezone. A corrected sheet in LogSheet Builder replaces the previous copy on the next import |

### 1.4 Users this release serves

Accounts on this dashboard are for people who look at the plant or maintain master data. Operators and mechanics do not need an account here to record a shift. Section 7 defines the personas and the access rules.

The interface is English and Indonesian. Dates and numbers follow the active language. The business date is always the calendar date in the site’s timezone.

### 1.5 What is already true at Bekasi

The current application already expresses the first site’s screens: live tank farm, quality control, daily production, and master data for company, site, plant, commodity, and tank calibration. Those screens are the functional starting point for Priscolin. They are not the data model for the next site.

Observed Bekasi sources:

| Form | What it is | Evidence in this workspace |
| --- | --- | --- |
| F/TNF-003 | Storage Tank Sounding Report | Daily Excel, 22 Jul 2026 – 19 Oct 2026, about 27 tickets a day |
| F/QCO-001 | Daily Storage Tank Analytical Result | Daily Excel, analyses present on 14, 15, 16, and 19 Oct 2026 |
| F/RFA-004(A) | Refinery daily log (feed, RBDPO, PFAD, bleaching earth, phosphoric acid, steam, power, gas) | Workbook parsed for the daily production screen |
| F/RFA-004(B) | Fractionation daily log (RBDPO/ROL feed, olein, stearin, steam, power, water) | Workbook parsed for the daily production screen |
| F/QCO-009, F/QCO-010 | Incoming material by vessel and by truck | Represented on the QC screens from the current extract |

The remaining forms in Appendix A are in the Priscolin register. They are in scope as logsheets the platform must be able to receive. They become dashboard figures only after a field map exists.

---

## 2. System Architecture and Data Flow

### 2.1 Place in the landscape

```text
Operators, mechanics, lab, utility
        │  fill the site’s own forms
        ▼
LogSheet Builder                         system of record for entries
  one form id per site form
  submitted reports, exportable by date
        │  scheduled import, per form, in the site timezone
        ▼
Plant Information Dashboard
  1. Organisation          company → site → plant → tank, commodity
  2. Logsheet copy         the sheet as received
  3. Mapped facts          sounding, lab, movement, production, utility
        │
        ▼
Browser
  Tank Farm · QC · Utility · Refinery & Fractionation · Daily Production · Others
  scoped to the sites on the user’s account
```

LogSheet Builder remains the place a value is typed and the place a wrong value is corrected. The dashboard imports the submitted report again and replaces the previous copy for that same business key. It does not offer a second sounding screen, a second lab entry screen, or an approval signature.

Master data that describes the organisation (company, site, plant, commodity) is maintained here until DataHub sends it. Tank identity, tank calibration, and density tables are owned here, because capacity and the volume table are not on the logsheet. A level in metres becomes a mass in kilograms only through that calibration.

### 2.2 Runtime shape

The browser talks to one application origin. The application reads and writes a PostgreSQL database through its own API. Three environments exist — Dev, Testing, and Production — each with its own database. Implementation layout, ports, and deployment are specified in the technical baseline. Functionally, the three environments must stay separate: a test import never writes the production copy.

### 2.3 Integration with LogSheet Builder

Each connected form is a **logsheet definition**:

| Attribute | Meaning |
| --- | --- |
| Site | Required. Every form belongs to a site |
| Plant | Set when the form belongs to one plant inside the site. Bekasi sounding belongs to Priscolin, while the site also contains plants that have no forms yet |
| External id | The LogSheet Builder form UUID. Bekasi sounding and Bekasi analytical are two different ids. The next site receives new ids |
| Form code | The local document number, such as F/TNF-003. Unique inside the site |
| Name | The local title |
| Mapper | The canonical family this form feeds, or empty when the sheet is stored and not yet drawn |
| Schedule | When this form is imported, in the site timezone |
| Field map version | The column-to-concept map that was current when a submission was read |

Import for one definition:

1. Authenticate to LogSheet Builder with the credentials of that environment. Credentials live with the import job. They are not part of the browser application.
2. Download that form for the requested date range.
3. Store or replace the submission under a stable business key (section 3.6).
4. When a mapper is registered, rebuild the dashboard facts for that submission.
5. Record the run: definition, range, status, and any rows that could not be mapped.

A day that fails is recorded and skipped. Days that already loaded stay loaded. A later successful run for that day replaces that day’s copy.

The first two schedules, once ingest is operating for Priscolin:

| Definition | When (Asia/Jakarta) | Feeds |
| --- | --- | --- |
| F/TNF-003 | 06:30 and 14:30 | Tank Farm live stock |
| F/QCO-001 | 07:00 | Storage certificates and the retest badge |

Further forms get their own schedule when their mapper is switched on. There is no single clock for the group.

### 2.4 What moves, and what stays put

| Data | Where it is born | Where the dashboard keeps it | Who may change it |
| --- | --- | --- | --- |
| A sounding, a lab result, a shift tonne, a boiler reading | LogSheet Builder | Copy of the submission, plus mapped facts when a map exists | Corrected in LogSheet Builder, then imported again |
| Company, site, plant, commodity | DataHub later; this application until then | Organisation master | Administrator, on the master screens |
| Tank list, calibration, density | This application | Tank master | Administrator, on the tank and calibration screens |
| Which form feeds which module | This application | Logsheet definition and field map | Administrator, on the logsheet catalog |
| Quality limits | This application, per site and commodity | Site quality rules | Administrator. A limit is entered only when the lab supplies it |
| User, role, site assignment | This application | Access tables | Administrator |

### 2.5 Request path for a screen

Every operational query carries the site the user is looking at, and the API returns rows only for sites on that user’s assignment.

1. The user picks a site they are allowed to see, or a group view across those sites.
2. The screen asks for a canonical fact (latest sounding, storage certificate, production day) for a date range.
3. The API reads the mapped facts for those sites. It computes quantity from the tank calibration stored for that plant’s tank.
4. The screen draws the result. Local form labels may be shown as detail. Group comparisons use the canonical names.

A form with no mapper does not appear as a tank card or a production line. It appears on the coverage view as an unmapped definition, with the last import time and the row count.

### 2.6 Boundaries

| In this product | Outside this product |
| --- | --- |
| Read and visualise submitted logsheets | Typing operational data |
| Daily Production Report assembled from mapped forms | Approving or signing the paper form |
| Tank calibration and stock mathematics | Editing a historical sounding in place |
| Site-scoped quality rules supplied by the lab | Inventing a group-wide FFA ceiling |
| User accounts for viewers and administrators | Operator login for data entry |
| English and Indonesian | Downstream Hub single sign-on, in this release |

---

## 3. Data Mapping and Normalization Strategy

This section is the design that lets every site keep its own form and still feed one dashboard.

### 3.1 Three layers

```text
Organisation
  company → site → plant → tank
  commodity catalog for the company, with a local alias when a site’s name differs

Logsheet copy                         the record of what was submitted
  logsheet definition                 one row per form at a site or plant
  submission                          one row per business key, payload kept as received
  ingest run                          success, failure, and unmapped fields

Dashboard facts                       the record the screens read
  sounding, laboratory result, gate sample, movement,
  production measure, utility measure, checklist result
  each row points at its site, its plant when the form is plant-scoped,
  and the submission it came from
```

Layer 2 is complete even when layer 3 is empty. A form this product has never seen still lands, can be listed, and can be mapped later without asking the site to re-export history. Re-import replaces the submission and rebuilds the facts. It does not insert a second sounding for the same tank, day, and round.

Adding a site is data: a site, its plants, its tanks, and its logsheet definitions. Adding a new *kind* of measure is a mapper, and a new fact type only when the canonical catalog cannot hold that measure. It is not a copy of the Bekasi tables.

### 3.2 Canonical concepts

A canonical concept is a stable meaning, independent of the column title printed on a site’s form. The field map points a local column at one concept. Screens and group totals read concepts.

Concepts are grouped so a mapper stays small.

**Identity.** Site, plant, process unit, tank, vehicle, shift, commodity, business date.

**Quantity and condition.** Sounding level, temperature, operational status, calibrated mass, empty space, loadable stock, flowmeter start, flowmeter end, flowmeter total.

**Role of a quantity.** Feed, product, co-product, inbound, outbound, transfer in, transfer out, opening, used, received, closing.

**Laboratory parameter.** A code plus a number and a unit: FFA, moisture (MI), iodine value, DOBI, peroxide value, colour red, colour yellow, slip melting point, cloud point, anisidine value, carotene, phosphorus, TOTOX, odour, and further codes as the lab names them. A parameter the catalog does not yet list is stored on the submission and flagged. It does not block the parameters that are listed.

**Utility measure.** Steam, electrical energy, gas, water, compressor runtime, fuel, boiler chemical, effluent result. Unit is part of the concept binding (kWh, MMBtu, tonne, m³).

**Compliance result.** Checklist item, result (done, not done, not applicable), remark. These stay out of numeric KPIs.

The first catalog is Appendix B. Extending it is a controlled change: a new code, a definition, and a unit. It is not a new table per site.

### 3.3 The field map

Each logsheet definition owns a versioned field map.

| Map column | Example, Bekasi F/TNF-003 | Example, a later site |
| --- | --- | --- |
| Source field | The header text on that sheet | That site’s own header text |
| Canonical concept | `sounding.level` | `sounding.level` |
| Unit | m | cm, with a conversion to m |
| Entity hint | tank column | tank column |
| Required for the mapper | yes | yes |

Rules:

1. One source field maps to one concept. A concept may be filled from only one source field on that form version.
2. Bekasi can ship with a mapper that already knows the F/TNF-003 and F/QCO-001 headers, and an empty extra map. The map exists so the second site, or a renamed Bekasi column, is a data change.
3. A renamed column is a new map row. Submissions already stored keep the map version they were read with. Re-import under the new map rebuilds the facts.
4. A column with no concept stays inside the submission payload and is reported as unmapped. The rest of that row still maps.
5. A missing required field (no tank, no business date) keeps the submission and withholds the fact. The ingest run lists the row.
6. Units convert only through an explicit conversion on the map. A value in centimetres becomes metres by that conversion. A value whose unit is unknown is stored and excluded from totals.

### 3.4 What is configuration, and what is a shared fact

These Bekasi structures are configuration for the Priscolin plant. They are not a group-wide list.

| Bekasi structure | How another site expresses the same idea |
| --- | --- |
| Tanks T01–T08, T10–T16, T20–T29, and three bulk CPO bins | That plant’s own tank codes. `T01` at Bekasi and `T01` at the next plant are two tanks |
| Refinery 500, Refinery 150, Fractionation 400, Fractionation 500, Separator | Process units configured on that plant, each with a role (refining, fractionation, washing) and a yield rule |
| PFAD from the larger refinery flowmeter to T16, and from the smaller to T05 | A destination rule on that plant’s process unit |
| Stock groups CPO, RBDPO, OLEIN, RBDPS, IV 64, PMF, PFAD | A reporting group. IV 64 is its own group on the Bekasi stock report. Another site may not have it |
| Inbound CPO limits FFA max 5 and moisture max 0.5 | A quality rule on the Bekasi inbound forms. Another site carries its own rule, or none |
| Palka IV 51–54 and DOBI above 2 | Watch limits printed on F/QCO-009. They inform the user. They do not reject the vehicle |
| Storage pass/fail | Unset until the lab supplies a limit per commodity. Every storage family stays “spec pending” until then |

Process-unit yield follows the unit’s rule, not a single formula for the group:

- Refining yield is product divided by feed. Loss is feed minus product minus co-product. This applies when the form states that product and co-product come from the same day’s feed.
- Fractionation yield is withheld from same-day arithmetic when product and co-product are not that day’s feed. The tonnes still show. The yield cell stays empty, and the screen says why.

### 3.5 Commodity and tank identity

Commodities belong to the company. A site whose sheet says “RPO/RBDPO” or “ROL” resolves that text through an alias to the company commodity. The alias is data. The stock screen can keep a local reporting group (IV 64 separated from olein) without creating a second commodity master.

A tank is unique inside its plant. The canonical code is the form used on the master (`T01`, not `T.01` or `t1`). The map normalises the code printed on the sheet before it looks up the tank. An unknown code is kept on the submission and listed as an unmapped tank. It does not create a tank by itself.

Mass is computed in the dashboard from the plant’s calibration profile and the density table: quantity, empty space, loadable stock, and fill ratio. Level alone is not a mass. Two users looking at the same tank see the same kilograms, because the calibration is stored once.

### 3.6 Business keys

The business key identifies one real-world observation inside one form, so a re-import replaces it.

| Observation | Key inside that form |
| --- | --- |
| One sounding round | Business date + tank code + round index |
| One storage certificate snapshot | Business date + tank code + revision |
| One incoming vessel ticket | Ticket or sample identity printed on the sheet; if the sheet has none, vessel + arrival date + commodity |
| One truck sample | Sample number |
| One production shift row | Business date + process unit + shift + role (feed, product, co-product) |
| One utility reading | Business date + asset (boiler, meter, plant) + measure |
| One checklist | Business date + form + item |

The key is unique inside one logsheet definition. Two sites may both have `T01 | 2026-10-19 | round 1`.

Where the Excel export has no ticket number, the mapper documents the key it uses. The key is part of the mapper, agreed before that form is switched on.

### 3.7 How a group total is allowed to add

A group figure may sum or average a measure only when all of the following hold:

- the same canonical concept
- the same unit, after the map’s conversion
- the same commodity family, or an explicit rollup the user selected
- the same time grain, using each site’s own business date

The total is accompanied by coverage: how many assigned sites have a mapped value for that concept and date, and which sites are silent. A site with no fractionation plant is absent from the fractionation comparison. It is not filled with zero. A site whose fractionation form is not mapped yet is listed under coverage as unmapped, and its tonnes are absent from the total.

### 3.8 Change scenarios the model is required to survive

| What the site does | What the dashboard does |
| --- | --- |
| Renames a column | An administrator points the new header at the same concept. Historical submissions stay on the previous map version until they are re-imported |
| Adds a column the group has never used | The new column stays on the payload and appears as unmapped. Existing cards and totals stay as they were |
| Removes a required column | New submissions for that form fail the fact build and are listed on the ingest run. The previous day’s facts remain |
| Uses tank code T01 | The tank is stored under that plant. Bekasi T01 is untouched |
| Has no refinery, only a tank farm and a lab | Refinery and fractionation sections are hidden for that site. Tank Farm and QC still run from that site’s own forms |
| Corrects yesterday’s sounding in LogSheet Builder | The next import replaces that tank-day-round and recomputes quantity |
| Sends a form with no mapper | The submission is stored, counted, and shown on coverage. No fact is invented |

### 3.9 Worked example

**Bekasi, today.** F/TNF-003 column for tank level maps to `sounding.level` in metres. The tank text `T.11` normalises to `T11` on the Priscolin plant. Product text `CPO` maps through the commodity alias. Operational status `ISI LK` is kept as the local status and also as the canonical status concept. Quantity is computed from that tank’s calibration. F/QCO-001 FFA for the same tank joins by plant + tank + the certificate’s analysis date, and the retest rule (older than two days) is applied at read time.

**A second site, later.** Its sounding form has a different UUID, a different document number, and a header “Tinggi (cm)”. The field map binds that header to `sounding.level` with a centimetre-to-metre conversion. Its tank `T01` is a different tank row. Its inbound FFA limit, if the lab has published one, is a rule on that site. The group stock view adds calibrated mass by commodity family and shows “2 of 2 sites” for the days both maps produced a value.

### 3.10 Mapping governance

| Actor | Responsibility |
| --- | --- |
| Site process owner | Confirms what each local column means, and which process unit a block of rows belongs to |
| Dashboard administrator | Enters the definition, the map version, and the schedule |
| Lab | Supplies storage and inbound limits per commodity for that site. Until they arrive, the verdict is spec pending |
| Platform owner | Adds a canonical concept when a measure is real and shared, and refuses one-off columns that only one checklist needs |

A map change is versioned. The ingest run records which version read each submission. A user can see, for a tank card, which form and which import produced it.

---

## 4. Functional Requirements by Module

Priority: **Must** for the first production cut that includes Priscolin and the mapping platform, **Should** for the next forms once that platform is in use, **Later** for compliance detail and sites that are not yet live.

Shared behaviour in section 4.1 applies to every module.

### 4.1 Shared behaviour

| ID | Priority | Requirement |
| --- | --- | --- |
| SH-01 | Must | The user sees data only for sites assigned to their account |
| SH-02 | Must | A site switcher lists those sites. The active site’s timezone controls the business date |
| SH-03 | Must | A date range filters every operational screen. Empty days stay empty |
| SH-04 | Must | The screen shows the data source and the time of the latest successful import for the forms behind that screen |
| SH-05 | Must | A quantity that was not on the form and cannot be computed is blank. It is not shown as zero |
| SH-06 | Must | English and Indonesian cover every label on these modules |
| SH-07 | Must | Export of the on-screen table to a spreadsheet uses the same figures the screen shows |
| SH-08 | Should | A group view across the user’s sites shows coverage beside each total |
| SH-09 | Must | Selecting a figure opens the trail: site, form code, business date, import time |

### 4.2 Tank Farm

**Purpose.** Show what is in each tank now, how full it is, and whether the certificate on that tank is still fresh.

**Priscolin sources.**

| Form | Role on this module |
| --- | --- |
| F/TNF-003 Storage Tank Sounding Report | Level, temperature, product, operational status, round |
| F/QCO-001 Daily Storage Tank Analytical Result | Certificate age and parameters shown on the tank |
| F/TNF-004 Monitor Masuk dan Keluar Minyak | Movement context once mapped |
| F/TNF-002, F/TNF-005, F/TNF-009 | Filter-bag, loading-pipe, and vitamin A logbooks. Stored at once. Drawn when a mapper exists. They do not block the sounding cards |

**Screens.** Live operations (tank cards and table, commodity utilisation, logistics strip) and operations analytics (level, temperature, and movement history for a tank).

| ID | Priority | Requirement |
| --- | --- | --- |
| TF-01 | Must | For the selected site and date, show each tank that exists on that plant: code, product, oil family, level, temperature, operational status, and the sounding round |
| TF-02 | Must | Compute quantity, empty space, loadable stock, and fill ratio from that tank’s calibration and the density table. Show mass as unavailable when the calibration cannot resolve the level |
| TF-03 | Must | Default to the latest sounding day. The user can move across days that contain a sounding |
| TF-04 | Must | Join the latest storage certificate for that tank and raise a retest badge when the analysis is older than two days on the snapshot date |
| TF-05 | Must | Leave storage pass/fail as spec pending until a limit for that commodity is configured for the site |
| TF-06 | Must | Group utilisation by the site’s stock groups. At Bekasi those groups are CPO, RBDPO, OLEIN, RBDPS, IV 64, PMF, and PFAD, and IV 64 stays in its own group |
| TF-07 | Must | Show inbound and outbound vehicles from the mapped gate forms, with the inbound verdict for the rules configured at that site |
| TF-08 | Must | Analytics for one tank: sounding history, laboratory history, average level, average temperature |
| TF-09 | Should | Movement totals by commodity once F/TNF-004 is mapped. Until then the movement figure states that quantity is not yet supplied |
| TF-10 | Must | A tank with no sounding on the selected day remains on the roster and shows that no sounding was imported |
| TF-11 | Later | Vitamin A dosing from F/TNF-009 shown against the tank remark already carried on the certificate |

**Bekasi roster.** Numbered tanks T01–T08, T10–T16, T20–T29, plus BAK CURAH CPO A, BAK CURAH CPO B, and BAK CURAH CPO DEPAN. T09 and T17–T19 are not on this plant. The QC storage print runs T01–T29 and keeps a row when the certificate is missing. Both rosters are master data for this site.

**Acceptance.** For a known Bekasi day, tank T01 level, temperature, status, and calibrated quantity match the imported F/TNF-003 row and the calibration profile. A second site’s T01 does not appear in the Bekasi roster.

### 4.3 Quality Control

**Purpose.** Show certificates and gate decisions that the laboratory has already recorded, and make overdue or out-of-limit results visible.

**Priscolin sources.** Seventeen QC forms are registered (Appendix A). The first screens use four of them. The others are received as submissions and mapped in the order below.

| Form | Use | Priority |
| --- | --- | --- |
| F/QCO-001 Daily storage tank analytical | Storage certificates | Must |
| F/QCO-009 Incoming material by vessel, including palka samples | Vessel gate | Must, from the current extract; ingest when the form is connected |
| F/QCO-010 Incoming material by truck | Truck gate | Must, same condition |
| F/QCO-002 Daily quality, refinery 150 MT and 500 MT | Quality beside the production report | Should |
| F/QCO-003 Daily quality, composite fractionation | Quality beside fractionation | Should |
| F/QCO-013 Outgoing shipment by truck | Outbound release | Should |
| F/QCO-020 Outgoing shipment by vessel | Outbound release | Should |
| F/QCO-011 / 011-B Incoming chemical and ingredient | Supporting-material quality | Should |
| F/QCO-018 Form transfer | Transfer record | Should |
| F/QCO-004, 006, 008, 014, 021, 022 | Retain sample, container, cleanliness | Later, under Others as compliance |
| F/QCO-012(A), F/QCO-012(B) | Registered in the briefing. Full duty confirmed when the form page is mapped | Later |

| ID | Priority | Requirement |
| --- | --- | --- |
| QC-01 | Must | Storage view lists the site’s tank roster with analysis date, product, temperature, and the parameters present on that certificate (FFA, moisture, colour, IV, PV, melting point, cloud point, and the others the sheet carries) |
| QC-02 | Must | A certificate older than two days is marked for retest. Age is measured from the analysis date to the snapshot date |
| QC-03 | Must | Storage verdict is spec pending for every oil family until the lab configures a limit for that commodity at that site. The product does not ship with an invented FFA ceiling |
| QC-04 | Must | Vessel view shows ship, supplier, commodity, arrival, contract, palka samples, and the composite result |
| QC-05 | Must | Truck view shows the sheet header (supplier, material, contract, limits printed on the form) and one row per sample |
| QC-06 | Must | Inbound CPO at Bekasi fails when FFA is above 5 or moisture is above 0.5, because those limits are printed on F/QCO-009 and F/QCO-010. A palka sample outside that band rejects the vehicle |
| QC-07 | Must | IV outside 51–54 and DOBI at or below 2 are shown as watch limits on the vessel form. They do not by themselves reject the vehicle |
| QC-08 | Must | Those inbound numbers are a rule record for Bekasi. A site without that rule does not inherit it |
| QC-09 | Should | Refinery and fractionation quality (F/QCO-002, F/QCO-003) appear on the matching production section for the same date |
| QC-10 | Should | Outbound truck and vessel results (F/QCO-013, F/QCO-020) appear as release status on the movement view |
| QC-11 | Must | The user can filter storage, vessel, truck, and movements by date |
| QC-12 | Later | Chemical and ingredient certificates feed the supporting-materials ladder |

**Acceptance.** A Bekasi storage row keeps spec pending. A Bekasi inbound CPO sample with FFA above 5 or moisture above 0.5 shows rejected. The same numbers on a site with no inbound rule stay spec pending.

### 4.4 Utility

**Purpose.** Show the steam, power, fuel, water, and effluent results each site records, and attach the utility intensity the production report needs (energy per tonne of feed) without forcing every site onto the Priscolin boiler set.

The Priscolin briefing registers ten utility forms. Several production sheets also carry a utility block (steam, power, and gas on F/RFA-004(A); steam, power, and water on F/RFA-004(B)). Both paths are valid sources. The field map says which form owns which meter, so the same steam total is not counted twice.

| Form | Subject |
| --- | --- |
| F/UTI-004 | Fuel use, boiler Taihu 15 T/H |
| F/UTI-005 | Boiler chemical use |
| F/UTI-006 | Water meter display |
| F/UTI-010 | Coal logsheet |
| F/UTI-011(a), F/UTI-011(b) | Registered. Duty confirmed at mapping |
| F/UTI-012 | Boiler water analysis |
| F/WTP-001 | WTP and WWTP water analysis |
| F/WTP-006 | RO cleaning realisation and verification |
| F/WWTP-001 | WWTP operation |

| ID | Priority | Requirement |
| --- | --- | --- |
| UT-01 | Must | Utility readings that already sit on a mapped production sheet (steam, power, gas, water, compressor) appear on the Daily Production Report for that process unit and date |
| UT-02 | Must | Each reading carries its unit. Power ratio and gas ratio are consumption divided by feed, and they stay blank when feed is blank or zero |
| UT-03 | Should | A Utility module lists the site’s utility assets (boilers, meters, water plant, effluent plant) from master data, not from a fixed Priscolin list |
| UT-04 | Should | For each asset and date, show the mapped measures: fuel, chemical, meter reading, water result, effluent result |
| UT-05 | Should | A measure supplied both on the production sheet and on a utility log is taken from the source the map marks as the owner. The other copy remains visible on its own form trail |
| UT-06 | Should | Group view compares specific consumption (energy per tonne of feed, steam per tonne of feed) across sites that have that concept mapped |
| UT-07 | Later | Boiler water and effluent parameters use the same parameter catalog as QC, with limits configured per site |
| UT-08 | Later | Coal, diesel, and boiler-chemical ladders join the supporting-materials pattern: opening, received, used, closing |

**Acceptance.** For a Priscolin refinery day taken from F/RFA-004(A), steam, power, and gas match the sheet. A site with no boiler form shows an empty utility module and a coverage line, and the production report still renders.

### 4.5 Refinery and Fractionation

**Purpose.** Show how each process unit ran: what it consumed, what it made, where the oil went, and the quality and downtime recorded against that unit.

This module is the process view. The Daily Production Report in section 4.6 is the consolidated morning report that reads the same facts. The two screens must show the same tonnes for the same unit and date.

**Priscolin sources.**

| Form | Subject | Priority |
| --- | --- | --- |
| F/RFA-004(A) | Refinery day: CPO/RPO feed, RBDPO, PFAD, bleaching earth, phosphoric acid, utility, remarks | Must |
| F/RFA-004(B) | Fractionation day: RBDPO/ROL feed, olein, stearin, utility, remarks | Must |
| F/RFA-001 Quality report | In-process quality | Should |
| F/RFA-002 Pretreatment, bleaching, and filtration | Section log | Should |
| F/RFA-003 Deodorising and filtration | Section log | Should |
| F/RFA-010 Dry fractionation | Section log | Should |
| F/RFA-013 Lamps and glass control | Checklist | Later |
| F/RFA-015 Change product checklist | Checklist | Later |
| F/RFA-016 Start-up checklist | Checklist | Later |

**Priscolin process units** are plant configuration:

| Unit | Route | Yield rule | PFAD destination on this plant |
| --- | --- | --- | --- |
| Refinery 500 | The larger flowmeter. Feed to RBDPO, PFAD as co-product | Same-day yield applies | T16 |
| Refinery 150 | The smaller flowmeter. Same route | Same-day yield applies | T05 |
| Fractionation 400 | Olein and stearin | Same-day yield does not apply | — |
| Fractionation 500 | Olein and stearin | Same-day yield does not apply. Empty until the sheet supplies figures | — |
| Separator | Washed CPO | Same-day yield applies when feed, product, and co-product are all present | — |

Another plant configures its own units. A plant with one refinery line has one refinery section.

| ID | Priority | Requirement |
| --- | --- | --- |
| RF-01 | Must | The module lists the process units configured for the active plant |
| RF-02 | Must | For the selected dates, each unit shows feed, product, co-product, and the tanks named on the sheet |
| RF-03 | Must | Shift rows are kept. The day total is the sum of the shifts. A duplicated flowmeter span that repeats the same start and end is counted once |
| RF-04 | Must | Refinery yield and loss use the same-day formula. Fractionation shows the tonnes and leaves yield empty, with the reason available to the user |
| RF-05 | Must | Bleaching earth (bags, lot, grade) and phosphoric acid usage from F/RFA-004(A) show on the refinery section |
| RF-06 | Must | Remarks captured on the sheet show against the shift |
| RF-07 | Should | Section logs (pretreatment, deodorising, dry fractionation) show runtime and exceptions once mapped |
| RF-08 | Should | In-process quality from F/RFA-001 sits beside the unit for that date |
| RF-09 | Later | Start-up, change-product, and lamps-and-glass checklists appear as completion for that unit and date |
| RF-10 | Must | Downtime categories (scheduling, commercial, technical, utility) display when the sheet provides hours. They stay blank when it does not |

**Acceptance.** For 6 October 2026 at Priscolin, Refinery 500 feed, product, and PFAD match F/RFA-004(A), yield equals product divided by feed, and Fractionation 400 shows its tonnes with yield withheld.

### 4.6 Production — Daily Production Report

**Purpose.** Assemble one daily production report per site from the mapped forms, so the morning report is generated rather than retyped.

The report is a composition:

| Block | Facts it reads |
| --- | --- |
| Production by process unit | Feed, product, co-product, yield, loss from section 4.5 |
| Chemicals and utilities on the unit | Bleaching earth, phosphoric acid, power, gas, steam, water, compressor |
| Oil movement | Incoming, local sales, shipment, blend in, blend out, transfer in, transfer out, gain or loss, by commodity family, from tank-farm movement forms once mapped |
| Closing stock | Latest calibrated stock by the site’s stock groups, from Tank Farm |
| Supporting materials | Opening, used, received, closing kilograms, closing bags |
| Downtime and quality columns | From the refinery and QC forms when those columns are mapped |

Priscolin supporting materials, until a form supplies quantities, are the eight names already on the screen: BE SSA, BE SSB, BE SSM, Clariant 331S, Tonsil 331M, phosphoric acid min. 85%, vitamin A palmitate, and citric acid anhydrate. Another site configures its own list. Blank quantities stay blank.

| ID | Priority | Requirement |
| --- | --- | --- |
| PR-01 | Must | The user selects a date or a range. The range sums quantities. Yield and loss are recomputed from the summed feed, product, and co-product, and only where the unit’s yield rule allows it |
| PR-02 | Must | The summary lists each configured process unit with feed, product, product yield, co-product, co-product yield, loss, and loss yield |
| PR-03 | Must | Headline figures for the Bekasi refineries show feed and yield for Refinery 500 and Refinery 150. A plant with different units shows those units instead |
| PR-04 | Must | A unit page repeats the summary for that unit and adds chemicals, utilities, downtime, and quality |
| PR-05 | Must | Closing stock by commodity family uses the same calibration path as Tank Farm |
| PR-06 | Must | Oil-movement rows appear for the site’s commodity families. Cells without a mapped movement stay blank |
| PR-07 | Must | Supporting materials list the materials configured for the site, with opening, used, received, closing kilograms, and closing bags |
| PR-08 | Must | The report can be filtered to days that actually contain logsheet figures |
| PR-09 | Should | One action produces the daily report for the selected site and date as a spreadsheet matching the on-screen blocks |
| PR-10 | Should | A group daily view lists each assigned site’s feed, yield, and closing stock, with coverage |
| PR-11 | Later | The report records who generated it and the import versions it used, so a restatement after a correction is visible |

**Acceptance.** The Priscolin summary for 6–7 October 2026 reproduces the feed, product, co-product, and utility figures taken from F/RFA-004(A) and F/RFA-004(B). Fractionation yield stays empty. Supporting-material quantities stay empty until a form is mapped. Generating the spreadsheet does not change any stored fact.

### 4.7 Others

**Purpose.** Receive every remaining site form, and surface the ones that are checklists or registers as compliance, without forcing them into a tonne or a laboratory parameter.

This bucket is deliberate. The Priscolin register includes start-up checklists, change-product checklists, lamp and glass control, filter-bag changes, loading-pipe checks, retain samples, container inspection, isotank cleanliness, tank cleanliness, and laboratory housekeeping. Those forms matter. They are a poor fit for the stock and yield screens.

| ID | Priority | Requirement |
| --- | --- | --- |
| OT-01 | Must | Every active logsheet definition is imported on its schedule, including forms with no mapper |
| OT-02 | Must | A coverage screen lists each definition: form code, name, plant, mapper state, last success, last failure, and the count of unmapped fields on the latest run |
| OT-03 | Should | Checklist forms mapped to the compliance concept show, for a date, items completed, items missed, and remarks |
| OT-04 | Should | The user can open the stored submission for an unmapped form and read it as the sheet was received |
| OT-05 | Later | Department owners can pin a checklist to Tank Farm, QC, Utility, or Refinery so the exception shows on that module |

### 4.8 Master data that the modules depend on

| ID | Priority | Requirement |
| --- | --- | --- |
| MD-01 | Must | Maintain company, site, plant, and commodity. A company cannot be removed while a site points at it. The same rule applies down the chain: site with plants, plant with tanks, tank referenced by a sounding or a calibration |
| MD-02 | Must | Reject duplicate company codes, duplicate site names inside a company, duplicate plant names inside a site, duplicate commodity codes inside a company, and duplicate tank codes inside a plant |
| MD-03 | Must | Tank code is unique per plant |
| MD-04 | Must | Maintain the logsheet catalog: external id, form code, plant when the form is plant-specific, mapper, schedule |
| MD-05 | Must | Maintain tank calibration (capacity, bottom stock, volume table, ring bands) and the density lookup used to turn level into mass |
| MD-06 | Must | Maintain commodity aliases and, where the site needs them, stock groups and process units |
| MD-07 | Must | Maintain quality rules per site, commodity, and scope (storage or inbound). An empty rule yields spec pending |
| MD-08 | Should | When DataHub begins to send company, site, plant, and commodity, those records become read-only here. Tank farm, calibration, and the logsheet catalog stay editable here |

---

## 5. Multi-Site Access Control and User Personas

### 5.1 Personas

| Persona | Works where | Comes here to | Account |
| --- | --- | --- | --- |
| Group operations viewer | Head office | Compare stock, yield, quality holds, and utility intensity across the factories they are responsible for | Yes. Assigned to each site they may see. View on the operational modules |
| Site operations manager | One factory | Run the morning review: tanks, today’s production, exceptions | Yes. Assigned to that site. View on operational modules |
| Tank farm supervisor | One factory | Check levels, ullage, and which tanks need a fresh certificate | Yes. View on Tank Farm |
| QC supervisor | One or more laboratories | Review storage age, inbound rejects, and outbound release | Yes. View on QC. View on production quality where the role includes it |
| Production superintendent | One factory | Confirm the daily production report and the refinery and fractionation sections | Yes. View on Production and Refinery |
| Utility supervisor | One factory | Review boilers, water, and effluent | Yes. View on Utility |
| Master data administrator | Head office or site | Keep tanks, calibration, commodities, process units, quality limits, and the logsheet catalog aligned with the site | Yes. Edit on the master pages for the assigned sites |
| System administrator | IT | Create users, assign roles, assign sites, retire access | Yes. User and role administration |
| Operator, mechanic, lab analyst | The plant floor | Record the shift | No dashboard account. They use LogSheet Builder |

A person may hold more than one role. Permissions are the union of those roles, still limited to the sites on the account.

### 5.2 Access model

Access has two independent checks. Both must pass.

1. **Site assignment.** The user has an explicit list of sites. An empty list means no sites. It does not mean every site. The first administrator is given Bekasi explicitly.
2. **Page permission.** Each role grants view, edit, or delete on a page. Edit and delete are for master data and administration. Operational pages are view.

Company records sit above a site. Viewing a company requires at least one assigned site under that company. Editing a company requires the company permission as well.

| Page key | Who typically has view |
| --- | --- |
| Live operations, operations analytics | Group viewer, site manager, tank farm supervisor |
| Quality control, including storage, vessel, truck, movements | Group viewer, site manager, QC supervisor |
| Daily production and its process sections | Group viewer, site manager, production superintendent |
| Utility | Group viewer, site manager, utility supervisor |
| Refinery and fractionation | Group viewer, site manager, production superintendent |
| Companies, sites, plants, commodities | Master data administrator |
| Tank farm master, calibration, density | Master data administrator |
| Logsheet catalog and field maps | Master data administrator |
| Users and roles | System administrator |

Two system roles are seeded. Further roles are data, added from role administration.

| Role | Rights |
| --- | --- |
| Administrator | View, edit, and delete on every page. Still limited to the sites assigned to that user |
| Viewer | View on live operations, operations analytics, quality control, and daily production |

Recommended roles for the personas above (Site Manager, QC, Production, Utility, Tank Farm, Group Viewer, Master Data) are created as data when those people are enrolled. They are not extra roles hard-coded in the application.

### 5.3 Rules

| ID | Requirement |
| --- | --- |
| AC-01 | A user with no site assignment sees no operational data and no master rows |
| AC-02 | Tank, logsheet, plant, and quality data are visible only when that row’s site is assigned and the role can view the page |
| AC-03 | A group total includes only assigned sites |
| AC-04 | Passwords are stored as a hash. The seed administrator password comes from the environment and is not written back into a file |
| AC-05 | A system role cannot be deleted. A role that is still assigned to a user cannot be deleted |
| AC-06 | The last active administrator cannot be deactivated |
| AC-07 | User administration and role administration are themselves permission-gated. A Viewer does not receive those pages |
| AC-08 | Login is username and password. The session is an HttpOnly cookie. The browser does not store the token |
| AC-09 | Testing is not opened beyond the office network until login and site assignment are in place |
| AC-10 | Downstream Hub single sign-on is out of this release |

### 5.4 A second site, as a test of both the data model and the access model

Describe the next factory entirely as new rows:

- a site under the company, with its own timezone
- one or more plants
- that plant’s tanks, including a tank coded T01
- two logsheet definitions with new LogSheet Builder ids and their own field maps
- a user assigned only to that site, with the Viewer role

That user sees the new site and does not see Bekasi. A Bekasi viewer does not see the new site. Bekasi T01 and the new T01 both exist. No new table is created to hold the new site.

---

## 6. Cross-cutting behaviour

| Topic | Rule |
| --- | --- |
| Language | English and Indonesian for the full interface |
| Time | Business dates are the site’s calendar dates. Import schedules use the site timezone. Import timestamps are stored in UTC and shown in the site timezone |
| Numbers | Quantities keep the precision of the source. Sounding mass is shown to two decimal places of kilograms, matching the sounding workbook. Yield is shown as a percentage to one decimal place |
| Freshness | Each module states the latest successful import of the forms it depends on |
| Corrections | The correction is made in LogSheet Builder. Re-import replaces the fact. The previous payload can be retained with the ingest history for the trail |
| Gaps | A missed day is a gap on the chart and a failed or empty ingest run. Neighbouring days stay |
| Audit | Master edits record the user and the time. Fact rows record the submission they came from |
| Language of source data | Column titles and remarks stay in the language printed on the form. Canonical concepts stay in the catalog’s codes. The screen translates its own labels |

---

## 7. Delivery sequence

The mapping platform is part of the first cut. Screens that already exist for Priscolin are filled from mapped facts. Further departments switch on as their maps are confirmed.

| Step | Outcome |
| --- | --- |
| 1. Foundation | Organisation, logsheet catalog, submission copy, field map, and the first fact types (sounding, storage lab, production measure). Bekasi F/TNF-003 and F/QCO-001 mapped. A fictional second site can be described as rows |
| 2. Tank Farm and QC storage | Live operations, analytics, and storage certificates read the facts. Quantities match calibration. Retest and spec-pending behave as specified |
| 3. Daily production and refinery | F/RFA-004(A) and F/RFA-004(B) map onto the Priscolin process units. The daily report matches those sheets. Yield rules hold |
| 4. Gate and movement | F/QCO-009, F/QCO-010, and F/TNF-004 feed logistics, inbound verdicts, and the oil-movement block |
| 5. Access | Login, roles, and site assignment before the application is opened beyond the office network |
| 6. Utility and the remaining RFA and QC forms | Utility module, in-process quality, outbound release, supporting-material quantities |
| 7. Further sites | Each new factory is catalog, tanks, maps, and users. Coverage shows anything still unmapped |

---

## 8. Acceptance of the whole product

The first production cut is accepted when:

1. An authorised Bekasi user sees Tank Farm, QC storage, and the Daily Production Report from imported logsheets, in English and in Indonesian.
2. A re-import of the same sounding does not create a second row, and the corrected level replaces the previous one.
3. Storage verdicts remain spec pending, and Bekasi inbound CPO still fails above FFA 5 or moisture 0.5.
4. Fractionation tonnes display, and fractionation yield stays withheld.
5. A second site with its own form ids and its own T01 can be added as data, and a user assigned only to that site cannot see Bekasi.
6. A renamed column is handled by a new field-map version. A column with no concept is listed as unmapped and leaves the existing totals unchanged.
7. A group total shows how many assigned sites contributed.
8. Operators record their shift in LogSheet Builder. This dashboard has no data-entry path for that shift.

---

## Appendix A. Priscolin Bekasi logsheet register

Taken from the outline of the management briefing. The briefing body is a page image per form. Where a workbook has been exported into this workspace, the duty column uses that workbook. Forms whose bookmark title is only the document number keep that number until the form page is mapped.

**Tank Farm (5)**

| Code | Name |
| --- | --- |
| F/TNF-003 | Storage Tank Sounding Report |
| F/TNF-004 | Monitor Masuk dan Keluar Minyak (Komoditi) |
| F/TNF-005 | Checklist Pipa Pemuatan |
| F/TNF-002 | Logbook Pergantian Filter Bag |
| F/TNF-009 | Food Additive Logbook (Vitamin A) |

**Quality Control (17)**

| Code | Name |
| --- | --- |
| F/QCO-001 | Daily Storage Tank Analytical Result |
| F/QCO-002 | Daily Quality Refinery 150 MT & 500 MT Production Report |
| F/QCO-003 | Daily Quality Composite Fractionation |
| F/QCO-004 | Form Registrasi Retain Sample |
| F/QCO-006 | Form Container Inspection |
| F/QCO-008 | Truck / Isotank Cleanliness Status |
| F/QCO-009 | Analytical Result of Incoming Material by Vessel |
| F/QCO-010 | Analytical Result of Incoming Material by Truck |
| F/QCO-011 / 011-B | Analytical Result of Incoming Plant Chemical / Ingredient |
| F/QCO-012(A) | Registered in the briefing |
| F/QCO-012(B) | Registered in the briefing |
| F/QCO-013 | Analytical Result of Outgoing Shipment Product by Truck |
| F/QCO-014 | Cleanliness Storage Tank / Vessel Tank Inspection |
| F/QCO-018 | Form Transfer |
| F/QCO-020 | Analytical Result of Outgoing Shipment by Vessel |
| F/QCO-021 | Cleanliness Laboratory Room Checklist |
| F/QCO-022 | Cleanliness Equipment Laboratory Checklist |

**Utility (10)**

| Code | Name |
| --- | --- |
| F/UTI-004 | Form Pemakaian Bahan Bakar Boiler Taihu 15 T/H |
| F/UTI-005 | Logbook Pemakaian Chemical Boiler |
| F/UTI-006 | Monitoring Display Meter Air |
| F/UTI-010 | Logsheet Batu Bara |
| F/UTI-011(a) | Registered in the briefing |
| F/UTI-011(b) | Registered in the briefing |
| F/UTI-012 | Laporan Analisa Air Boiler |
| F/WTP-001 | Laporan Analisa Air WTP & WWTP |
| F/WTP-006 | Realization & Verification Cleaning RO |
| F/WWTP-001 | WWTP Operational |

**Refinery and Fractionation (9)**

| Code | Name |
| --- | --- |
| F/RFA-001 | Quality Report |
| F/RFA-002 | Logsheet Pretreatment, Bleaching & Filtration |
| F/RFA-003 | Logsheet Deodorizing & Filtration Section |
| F/RFA-004(A) | Refinery daily log: CPO/RPO feed, RBDPO, PFAD, bleaching earth, phosphoric acid, utility |
| F/RFA-004(B) | Fractionation daily log: RBDPO/ROL feed, olein, stearin, utility |
| F/RFA-010 | Logsheet Dry Fractionation |
| F/RFA-013 | Checklist Lamps and Glass Control |
| F/RFA-015 | Change Product Checklist |
| F/RFA-016 | Start Up Produksi Checklist |

Forty-one forms at one site is the reason the dashboard stores the sheet first and maps it second.

## Appendix B. Initial canonical catalog

| Code | Meaning | Typical unit |
| --- | --- | --- |
| `entity.tank` | Tank or bulk bin on a plant | code |
| `entity.shift` | Shift identity | text |
| `entity.commodity` | Product text, resolved through an alias | code |
| `entity.process_unit` | Refinery line, fractionator, separator, boiler | code |
| `sounding.level` | Liquid height | m |
| `sounding.temperature` | Product temperature | °C |
| `sounding.status` | Local operational status | text |
| `mass.quantity` | Calibrated mass, computed here when the sheet does not carry it | kg |
| `flow.total` | Flowmeter quantity for the shift | t |
| `role.feed` / `role.product` / `role.coproduct` | What the flow represents | — |
| `lab.ffa` | Free fatty acid | % |
| `lab.moisture` | Moisture / impurities as printed | % |
| `lab.iv` | Iodine value | — |
| `lab.dobi` | DOBI | — |
| `lab.pv` | Peroxide value | — |
| `lab.color_r` / `lab.color_y` | Lovibond colour | — |
| `util.steam` | Steam | as mapped |
| `util.power` | Electrical energy | kWh |
| `util.gas` | Gas | MMBtu |
| `util.water` | Water | as mapped |
| `util.fuel` | Boiler fuel | as mapped |
| `check.result` | Checklist item result | done / not done / n/a |

Further laboratory and utility codes are added when a mapped form needs them. A code is added once, for the group, and then used by any site’s field map.

## Appendix C. Bekasi rules that stay on Bekasi

These are confirmed from the current forms and screens. They are seed data for the Priscolin site. They are not default rules for the next factory.

- Inbound CPO: FFA maximum 5, moisture maximum 0.5, from the headers of F/QCO-009 and F/QCO-010.
- Palka IV 51–54 and DOBI above 2 are watch limits.
- Storage limits are not configured.
- Retest after two days applies to storage certificates.
- Refinery 500 is the larger flowmeter and its PFAD goes to T16. Refinery 150 is the smaller flowmeter and its PFAD goes to T05.
- Fractionation yield is not computed from same-day feed, product, and co-product.
- Stock utilisation groups include IV 64 as its own group.
- The live sounding form id is `f80caa03-a6b0-4ad7-b823-459b2f828ce3`. The daily analytical form id is `9e1e978f-18c0-42dc-a558-e28e65bdf5ce`.
