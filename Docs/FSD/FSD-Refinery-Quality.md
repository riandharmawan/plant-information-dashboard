# Functional Specification

## Refinery quality — F/QCO-002

| | |
| --- | --- |
| Document ID | PID-FSD-003 |
| Version | 1.1 |
| Date | 20 October 2026 |
| Status | Draft for review |
| Audience | Product owners, laboratory, production, IT architecture, engineering |
| Parent | `Docs/FSD/FSD-Plant-Information-Dashboard.md` sections 3, 4.3, and 4.6 |
| Source form | F/QCO-002, Daily Quality Refinery 150 MT & 500 MT Production Report |
| Evidence | `Docs/exports/daily-quality-refinery`, production dates 14–20 October 2026 |

This document says how the platform stores that form, how Quality Control shows it, and which of its figures appear on the Daily Production Report. It follows the three layers in the parent specification: the sheet is kept as submitted, a field map turns columns into laboratory results, and the screens read those results.

LogSheet Builder remains the place a result is typed and the place a wrong result is corrected. This dashboard does not add a second lab-entry screen.

---

## 1. What the retrieved sheets contain

Seven workbooks were opened. Each file is one production day for one plant. The banner on every file reads **Plant : Refinery 150 MTD**. The live plant filter on the form offers All Plant and Refinery 150 MTD. Refinery 500 does not appear in this extract. The form title names both plants. The mapper must follow the plant printed on the sheet. It must not copy Refinery 150 results onto Refinery 500.

The business date is **Date of Production**. **Date of Report** is the following calendar day on every file in this set (a 14 Oct production is reported on 15 Oct). Screens and the Daily Production Report use the production date. The report date is shown as the date the laboratory issued the sheet.

The body is one wide table, TABLE 1 (MAIN). A row is one clock time. Most hours carry a finished-good check. The raw-material panel, the bleaching check, the by-product, and the spent-earth result are written on only a few of those hours. A blank cell, and a cell that contains only `-`, means the test was not recorded. It is stored as empty. It is never stored as zero.

| Production date | Readings | Oils in the rows | Finished goods | From tank | Notes |
| --- | --- | --- | --- | --- | --- |
| 14 Oct 2026 | 23 | CPO | RPO/RBDPO | T.11 | By-product result present, name cell empty, destination T.05 |
| 15 Oct 2026 | 24 | CPO | RPO/RBDPO | T.12 | Banner also lists CPKO. No CPKO row was recorded |
| 16 Oct 2026 | 25 | CPO, RPS/RBDPS | RPO/RBDPO, RRPS/RRBDPS | T.12, T.15 | Two finished goods on one day |
| 17 Oct 2026 | 24 | RPS/RBDPS, CPO | RRPS/RRBDPS, RPO/RBDPO | T.15, T.12 | Changeover remarks |
| 18 Oct 2026 | 24 | CPO | RPO/RBDPO | T.12 | |
| 19 Oct 2026 | 24 | CPO | RPO/RBDPO | T.12 | Two hours have no finished-good result |
| 20 Oct 2026 | 3 | CPO | RPO/RBDPO | T.12 | Morning only. No bleaching, by-product, or spent earth |

Across the week, finished-good FFA and colour red and yellow are filled on nearly every hour. Raw-material FFA, moisture, DOBI, IV, PV, AV, and Totox are usually one sample a day, two on 17 Oct when the feed oil changed. Bleaching colour and the break test appear three or four times a day. By-product FFA and moisture, and spent-earth moisture and oil content, appear once on a full day. Colour blue and the W/B column are empty on every row of this week. They stay on the map so a later value is kept.

Flow rate sits beside the tank. The numbers in this week are between 4.5 and 6.2. The sheet does not print a unit. Flow rate is context for the hour. It is not a laboratory parameter, and it is not the day’s feed in tonnes. Feed tonnes stay on F/RFA-004(A).

---

## 2. Capture

### 2.1 Submission

The existing pull (`Frontend/scripts/sync-refinery-quality.mjs`) already saves one workbook per production day that has at least one reading, under `Docs/exports/daily-quality-refinery`. The application import reads that workbook. It does not call `parse-logsheets.mjs`.

One submission is one site, one form, one production date, one process unit. Re-import replaces that submission and rebuilds its results. Other dates stay as they were.

The day header stored with the submission:

| Field | Source | Rule |
| --- | --- | --- |
| Production date | `Date of Production` | Business date. Required. A sheet whose production date does not match the requested day is not stored as that day |
| Report date | `Date of Report` | Shown. Not used as the business date |
| Plant text | `Plant :` | Mapped to the site’s process unit. `Refinery 150 MTD` is Refinery 150. `Refinery 500 MTD` is Refinery 500. Any other text keeps the submission and withholds the facts |
| Declared oils | `Oil Type` on the banner | A list the laboratory printed. It is not a result. An oil named here and absent from the rows is shown as declared and not tested |

### 2.2 Reading

One sheet row whose first cell is a time (`HH:MM`) is one reading.

Business key, inside this form:

> production date + process unit + time + sheet row order

The row order is part of the key so two samples at the same clock time are both kept. This week has no repeated time. A re-import of the same sheet replaces the same keys.

A reading carries:

| Field | Column | Stored as |
| --- | --- | --- |
| Time | Time | Clock time on the production date, site timezone |
| From tank | From Tank | Tank text, then the plant’s tank when the code matches |
| Flow rate | Flow Rate | Number. Unit left unlabeled until the laboratory confirms it |
| Remark | Remarks, the last group | Text. Several remark columns to the right of that cell are empty in this export and are ignored |

Tank text is normalised before lookup. `T.11` and `T11` are the same tank. `T.05` is T05. A code that is not on the plant roster is kept as printed and listed for the master-data owner. It does not create a tank. In this week that includes `CR.401`, `CR.402`, and destinations written `RFI T.03`, `RFI T.04`, `RFI T.05`, `RFI T.07`, and `RFI T.08`.

### 2.3 Streams on the same hour

Each reading can hold up to five streams. A stream is stored when its commodity, a destination tank, or any parameter is present. A parameter cell that is blank or `-` does not create a result.

| Stream | Columns | What the hour usually holds |
| --- | --- | --- |
| Raw material | Oil Type, FFA %, M&I %, DOBI, IV, PV, AV, Totox, R, Y, B | Oil type on many hours. The full panel on one hour, sometimes two |
| Bleaching oil | R, Y, W/B, Break Test | A few hours. Break Test is the words Clear / clear |
| Finished good | Finish Good, FFA, M&I, IV, PV, R, Y, W/B, To Tank, Remarks | Name, FFA, colour R and Y, and destination on most hours |
| By-product | By Product, FFA%, M&I %, To Tank | Usually one hour. The name can be empty while FFA is filled |
| Spent earth | M&I %, OC % | Usually one hour |

The by-product name is taken from its own cell. A destination of T.05 does not by itself name the oil PFAD. On 14 Oct the name is empty, FFA is 87.296, moisture is 0.215, and the destination is T.05. That result is stored as a by-product with no commodity. On 15–19 Oct the name cell says PFAD.

### 2.4 Parameter map

These codes extend Appendix B of the parent specification. `lab.av`, `lab.totox`, `lab.color_b`, `lab.color_wb`, `lab.oc`, and `lab.break_test` are added once, for the group. A site that does not use them is unaffected.

| Sheet header | Stream | Concept | Unit |
| --- | --- | --- | --- |
| FFA %, FFA, FFA% | the stream of that column | `lab.ffa` | % |
| M&I %, M&I | the stream of that column | `lab.moisture` | % |
| DOBI | raw material | `lab.dobi` | — |
| IV | raw material, finished good | `lab.iv` | — |
| PV | raw material, finished good | `lab.pv` | — |
| AV | raw material | `lab.av` | — |
| Totox | raw material | `lab.totox` | — |
| R | raw material, bleaching, finished good | `lab.color_r` | — |
| Y | raw material, bleaching, finished good | `lab.color_y` | — |
| B | raw material | `lab.color_b` | — |
| W/B | bleaching, finished good | `lab.color_wb` | — |
| OC % | spent earth | `lab.oc` | % |
| Break Test | bleaching | `lab.break_test` | text |
| Oil Type, Finish Good, By Product | that stream | `entity.commodity` | alias |
| To Tank | finished good, by-product | `entity.tank` | code |
| Flow Rate | the reading | `process.flow_rate` | unlabeled |

Commodity text resolves through the company alias. `RPO/RBDPO` aliases to RBDPO. `RPS/RBDPS` and `RRPS/RRBDPS` alias to RBDPS. `CPO` and `PFAD` alias to those commodities. `CPKO` is kept if a row ever carries it. An unknown text stays on the result and is listed as an unresolved commodity. It does not create a commodity.

Break test is stored in the case the sheet used and displayed in a single capitalisation. `clear` and `Clear` are the same result.

### 2.5 What is not calculated at capture

- Finished-good FFA is not averaged.
- Colour is not averaged.
- Flow rate is not summed into feed tonnes.
- A missing parameter is not written as zero.
- No pass or fail is stored. Limits for refinery streams are not on this form.

---

## 3. Quality Control

**Purpose.** Give the laboratory and the production superintendent the refinery log in the same shape as the Tank & Stock Dashboard: a snapshot of the latest day in the selected range, the daily low and high of finished FFA across that range, and the full hour roster.

**Place.** A page under Quality Control, titled Refinery quality. It uses the Tank & Stock header, summary figures, a daily low–high chart, and the roster. It does not use a separate week index or a set of stream chips. English and Indonesian labels follow the rest of the module. The date range is kept on the URL.

**Who.** A user who can view Quality Control. The screen is read-only.

### 3.1 Page structure

The page follows the Tank & Stock Dashboard, with the hour in place of the tank.

| Tank & Stock | Refinery quality |
| --- | --- |
| Title, site, latest sounding day in the range, date range | Title, site, latest production day in the range, date range |
| Four figures for that sounding day | Four figures for that production day: hours logged, finished FFA low–high, feed FFA, by-product FFA |
| Commodity stock bars | A daily chart of finished FFA. Each day is the low and the high of that day’s hourly results. It is not an average. The chart names the finished oil |
| Tank roster, table or cards, filtered by oil family | Hour roster, table or cards, filtered by oil |
| A number opens that tank’s history across the range | A day on the chart opens that day’s hourly finished FFA, with feed, bleach, by-product, and spent earth as samples on the same hours |

The roster is the latest production day inside the range, the same way Tank & Stock shows the latest sounding day. Changing the range moves that day. A day with no submission leaves the roster empty and the figures blank. It is not filled with zeros.

An oil named on the banner and absent from the rows stays on the stored day as declared and not tested. It is not drawn on the finished-FFA chart. 15 Oct names CPKO and no row tests it.

### 3.2 The hour roster

Table is the default. Cards are the other view. Both list every hour of the snapshot day.

| Column | Content |
| --- | --- |
| Time | Clock time |
| From tank | Feed tank |
| Flow | The number on the sheet, with no unit |
| Feed oil | Raw-material oil |
| Feed FFA, M&I, DOBI | Filled on the hours that carry the sample. Other hours stay blank |
| Finished oil | Finished-good name |
| Finished FFA | The hourly result |
| Colour | R and Y |
| To tank | Finished-good destination |
| Remark | The hour note, when the sheet has one |

A column that is empty for every hour of the snapshot day is omitted. Colour B and W/B stay off the table until a day contains them. Bleaching, by-product, and spent earth appear on the hourly dialog for the day that was clicked, and on an hour card when that hour has them.

The oil filter keeps hours whose feed oil or finished oil is selected. Sorting works on every header. Empty values sort last.

A card shows the time, the finished oil, finished FFA, colour, the destination tank, and the feed sample when that hour has one.

### 3.3 Daily chart and the hour dialog

The chart on the page is finished FFA for the selected range. Each day contributes its low and its high. Days are not averaged, and two finished oils are not blended. When the oil filter is on all oils, the line is the finished oil with the most hourly results. When the filter names one finished oil, the line is that oil.

Clicking a day opens the quantity dialog for that production date. The dialog draws finished FFA by hour, in sheet order. An hour on the sheet with no finished FFA breaks the line. An hour that was not logged is absent. Feed FFA, bleach R, by-product FFA, and spent-earth oil content sit in lanes under the line, at the hour they were sampled. They are not drawn on the FFA axis. A lane with no sample says so.

### 3.4 Limits

No cell is coloured as a failure. The parent rule holds: a verdict exists only after the laboratory configures a limit for that site, that commodity, and the refinery-process scope. Until then every value is shown as recorded, and the screen does not say pass or fail.

Inbound CPO limits (FFA 5, moisture 0.5) do not apply to this form. Those limits belong to F/QCO-009 and F/QCO-010.

---

## 4. Daily Production Report

**Purpose.** Put the day’s refinery quality beside that unit’s tonnes, in the shape of the morning report. The hourly log stays in Quality Control.

The summary page is unchanged. It remains one row per process unit for the selected range, with feed, product, co-product, yield, and loss. Quality is not added to that table. The plant name already opens the unit page with the same dates. The quality block lives on that unit page.

### 4.1 Where it appears

| Page | What F/QCO-002 fills |
| --- | --- |
| Refinery 150 | The quality block below, for days whose sheet says Refinery 150 |
| Refinery 500 | Nothing from this extract. The block is present and every cell stays `-` until a sheet names that unit |
| Fractionation 400, Fractionation 500 | Nothing. Those pages wait for F/QCO-003 |
| Separator | Nothing. Separator FFA, moisture, and DOBI stay on their own source |
| Supporting materials | Nothing. Spent-earth moisture is a laboratory result, not a stock movement |
| Summary | Unchanged |

### 4.2 The block

One table, titled Quality. One row per production date in the range. When the day has two finished goods, that date has one row per finished good. The tonne row above it stays a single day row from F/RFA-004(A). Quality does not split the mass balance.

| Column | Rule |
| --- | --- |
| Date | Production date |
| Feed oil | Raw-material oil on that day. Two oils become two names on the same cell, in the order they appear |
| Feed FFA | The raw-material FFA samples. One sample is one number. Two samples are both numbers. They are not averaged |
| Feed M&I | Same rule |
| Feed DOBI | Same rule |
| Finished oil | The finished-good name for that row |
| Finished FFA | The low and the high of the hourly FFA values. A single hour shows that number |
| Colour | The low and the high of colour R, and of colour Y, written as R and Y |
| To tank | The destinations seen for that finished good, once each |
| By-product | The name when the sheet gives one. Empty when the name cell is empty |
| By-product FFA | The sample, when present |
| By-product M&I | The sample, when present |

Bleaching, spent earth, AV, Totox, PV, IV, flow rate, and the hourly times stay on the Refinery quality page. The finished-good name opens that page with the range set to that production date, so the roster is that day. The morning report stays readable.

A Total row, when the range has more than one day, leaves every quality cell `-`. Quality is not summed and not averaged across days.

A day inside the range with no F/QCO-002 submission shows `-` in every quality cell. The tonne row for that day is unchanged.

### 4.3 Worked day

14 October 2026, Refinery 150, taken from `F-QCO-002_2026-10-14.xlsx`:

| Cell | Value |
| --- | --- |
| Feed oil | CPO |
| Feed FFA | 4.258 |
| Feed M&I | 0.358 |
| Feed DOBI | 2.793 |
| Finished oil | RPO/RBDPO |
| Finished FFA | 0.042–0.063, from 20 hourly results |
| Colour | R 2–2.2, Y 20–22 |
| To tank | T.22, CR.401 |
| By-product | `-` (the name cell is empty) |
| By-product FFA | 87.296 |
| By-product M&I | 0.215 |

16 October 2026 has two finished-good rows, RPO/RBDPO and RRPS/RRBDPS, and the feed oils CPO and RPS/RBDPS.

---

## 5. Requirements

| ID | Priority | Requirement |
| --- | --- | --- |
| RQ-01 | Must | Import F/QCO-002 as one submission per production date and process unit, and keep the workbook as received |
| RQ-02 | Must | Map TABLE 1 by the columns in section 2.4. A renamed header is a new map version. Columns already stored keep the version they were read with |
| RQ-03 | Must | Store each timed row as a reading, and each present stream as results. Blank and `-` create no result |
| RQ-04 | Must | Use Date of Production as the business date. Store Date of Report beside it |
| RQ-05 | Must | Bind the plant text to the process unit. Leave Refinery 500 empty while the sheet names only Refinery 150 |
| RQ-06 | Must | Resolve tank and commodity through the existing alias rules. Keep an unknown code on the result and list it. Do not create the tank or the commodity |
| RQ-07 | Must | Re-import of a production date replaces that date’s readings and results |
| RQ-08 | Must | Add the Refinery quality page described in section 3, in English and Indonesian, using the Tank & Stock page structure |
| RQ-09 | Must | Show the latest production day in the range as the roster, with a daily low–high finished-FFA chart, a table and a card view, and an oil filter. Hide a column that is empty for that whole day |
| RQ-10 | Must | Show a banner oil that has no row as declared and not tested |
| RQ-11 | Must | Leave every refinery result without a pass or fail until a limit exists for that site, commodity, and scope |
| RQ-12 | Must | On the Refinery 150 page of Daily Production, show the quality block in section 4.2 for the same date range |
| RQ-13 | Must | Show finished FFA and colour as low and high. Show a once-a-day sample as that sample. Leave the Total row of the quality block empty |
| RQ-14 | Must | Keep the Daily Production summary table as it is |
| RQ-15 | Must | Link the finished-good name on Daily Production to Refinery quality with the range set to that production date |
| RQ-16 | Must | A day on the finished-FFA chart opens that day’s hourly chart. Spot samples stay off the FFA axis |
| RQ-17 | Should | Show the hour-level remarks on the Quality Control day |
| RQ-18 | Should | List unresolved tanks and commodities on the ingest run for that submission |
| RQ-19 | Later | When the laboratory publishes a refinery limit, apply it on the Quality Control day and on the production quality block, for that site only |

---

## 6. Acceptance

Using the workbooks already pulled for 14–20 October 2026:

1. Seven submissions exist, all on Refinery 150. Refinery 500 has no results, and its production page still shows `-` for quality.
2. 14 Oct finished FFA displays as 0.042–0.063. The feed sample is FFA 4.258, M&I 0.358, DOBI 2.793. The by-product FFA 87.296 is kept, and the by-product name stays empty.
3. 15 Oct lists CPKO as declared and not tested. The hourly rows are CPO and RPO/RBDPO.
4. 16 Oct shows two finished goods, RPO/RBDPO and RRPS/RRBDPS, on the production quality block and on the Quality Control day.
5. 20 Oct shows three readings. Bleaching, by-product, and spent earth are empty, and those chips have no rows.
6. A second import of 14 Oct does not add a twenty-fourth reading.
7. The Daily Production summary for any range still shows one row per plant and does not show FFA.
8. No refinery number is marked failed.

---

## 7. Still outside this form

| Item | Where it remains |
| --- | --- |
| Refinery feed, RBDPO, and PFAD tonnes | F/RFA-004(A) |
| Fractionation quality | F/QCO-003, after that workbook is mapped |
| Separator FFA, moisture, and DOBI | The separator’s own source. F/RFA-001 if F/QCO-002 does not cover it |
| Storage certificates and the two-day retest | F/QCO-001 |
| Inbound reject rules | F/QCO-009 and F/QCO-010 |
| Refinery 500 quality | The same form, on the day a sheet names that plant |
| Pass and fail for RBDPO or PFAD | A limit the laboratory configures. This form does not print one |
