# Daily Production Report — logsheet pull guide

Guidance for the job that fills the Daily Production Report from Priscolin Bekasi logsheets.

The report on the platform is a sample. It is not a daily pull. This document says which forms the job must read, which report block each form fills, and which cells stay blank even after every registered form is imported.

Source of the form list: `Docs/LogSheet/E-Logsheet_Management_Brief_Priscolin_Bekasi.pdf` (bookmark register, 41 forms). The form pages in that brief are images. A column is confirmed only when the workbook for that form is opened and mapped. Do not invent a column from the form title.

## What the job produces

One report per plant per business date, then a range total when the user selects more than one date.

| Report block | Filled by |
| --- | --- |
| Production by process unit | F/RFA-004(A), F/RFA-004(B), and F/RFA-002 if it carries the separator |
| Chemicals and utilities on the unit | The same production sheets. Utility logs only when the production sheet has no meter of its own |
| Oil movement | F/TNF-004 |
| Stock ladder | F/TNF-003, plus production and movement already pulled |
| Supporting materials | Partial. See the section that stays blank |
| Downtime and quality | QC and section logs, after the four core forms are arriving every day |

A missing figure stays `-`. The job does not write zero for a form that was not submitted.

## Pull order

### 1. Core pull — these four forms

Ship the automation on these four before adding anything else. They cover the summary, the day ledger, stock, and oil movement.

| Form | Name on the brief | Report block | Platform today |
| --- | --- | --- | --- |
| F/RFA-004(A) | Refinery daily log | Refinery 500 and Refinery 150: feed, RBDPO, PFAD, loss, bleaching-earth bags, phosphoric acid, power, gas, steam | Sample only, 6–7 Oct 2026. Not a daily pull |
| F/RFA-004(B) | Fractionation daily log | Fractionation 400 and 500: RBDPO feed, olein, stearin, and power, steam, water when the meters on that sheet are usable | Sample tonnes for Fractionation 400 on 6 Oct only |
| F/TNF-003 | Storage Tank Sounding Report | Closing stock in kg for the report date. Opening stock from the previous business day's sounding | Closing is live, and it is the latest sounding, not the sounding of the selected production date |
| F/TNF-004 | Monitor Masuk dan Keluar Minyak (Komoditi) | Incoming, local sales, shipment, blend in, blend out, transfer in, transfer out, gain or loss, by commodity | The whole oil-movement block is `-` |

Yield and loss are calculated. They are not a fifth form.

| Rule | Formula |
| --- | --- |
| Refinery 500 | The larger flowmeter. PFAD sent to T.16 belongs to this unit |
| Refinery 150 | The smaller flowmeter. PFAD sent to T.05 belongs to this unit |
| Duplicate rows | A flowmeter span that repeats the same start and end is counted once. Shift rows are kept. The day total is the sum of the shifts |
| Refinery and separator yield | Product ÷ feed, and co-product ÷ feed. Blank when feed is missing or zero |
| Loss | Feed − product − co-product. Show a negative loss. Do not hide it |
| Fractionation yield | Leave blank. Olein discharged today is not from today's feed |
| Range total | Sum the quantities, then recompute yield from those sums. Do not average the daily yields |
| Power ratio | kWh ÷ feed tonnes. Blank when feed is missing or zero |
| Gas ratio | mmBtu ÷ feed tonnes. Same blank rule |
| Steam ratio | Leave blank. The steam figure on the log has no confirmed unit, so a ratio would be wrong |
| Bleaching earth | Keep bags. Do not convert bags to kilograms |
| Closing stock | Sounding metres to kilograms through the existing tank calibration used by Live Ops. For the generated report, use the sounding of that business date |
| Opening stock | Closing stock of the previous business date. Production on the ladder is the day's product. Used comes from movement out. Leave a cell `-` until its source row exists |

Acceptance for the core pull, Priscolin, 6–7 Oct 2026:

| Check | Expected |
| --- | --- |
| Refinery 500, 6 Oct | Feed 392 t, RBDPO 375 t, PFAD 16.25 t, yield 95.7%, loss 0.75 t |
| Refinery 500, 7 Oct | Feed 415 t, RBDPO 395 t, PFAD 19.17 t, yield 95.2%, loss 0.83 t |
| Refinery 500, 6–7 Oct total | Feed 807 t, RBDPO 770 t, yield 95.4%, loss 1.58 t. Yield recomputed from the sums |
| Refinery 150, 6 Oct | Feed 120.503 t, RBDPO 115 t, PFAD 8.3 t, loss −2.797 t |
| Fractionation 400, 6 Oct | Feed 62 t, olein 162 t, stearin 76.33 t. Yield and loss `-` |
| Fractionation 400, 7 Oct | Every figure `-` |
| 8 Oct | F/RFA-003 may exist for the deodoriser shift. It adds no tonnes. The production day stays `-` |

### 2. Second pull — open these after the core job is daily

Do not block the report on these. Add each one only after its workbook has been opened and a column map exists.

| Form | Name on the brief | What to map |
| --- | --- | --- |
| F/QCO-002 | Daily Quality Refinery 150 MT & 500 MT Production Report | Quality columns on the refinery pages. Workbooks for 14–20 Oct 2026 are in `Docs/exports/daily-quality-refinery`. The field map, the Quality Control screen, and the Daily Production block are specified in `Docs/FSD/FSD-Refinery-Quality.md` |
| F/QCO-003 | Daily Quality Composite Fractionation | Quality columns on the fractionation pages |
| F/QCO-009 | Analytical Result of Incoming Material by Vessel | Incoming quality. Use the tonnes only if F/TNF-004 does not carry them |
| F/QCO-010 | Analytical Result of Incoming Material by Truck | Same rule as F/QCO-009 |
| F/QCO-013 | Analytical Result of Outgoing Shipment Product by Truck | Release quality on shipment. Tonnes stay with F/TNF-004 |
| F/QCO-020 | Analytical Result of Outgoing Shipment by Vessel | Same rule as F/QCO-013 |
| F/QCO-011 / 011-B | Analytical Result of Incoming Plant Chemical / Ingredient | Received quantity for the supporting-materials ladder |
| F/TNF-009 | Food Additive Logbook (Vitamin A) | Vitamin A used. It does not give opening or closing stock |
| F/RFA-002 | Logsheet Pretreatment, Bleaching & Filtration | Only candidate for Separator: washed CPO and citric acid. No separator form is in the register. Read the sheet before replacing any `-` |
| F/RFA-010 | Logsheet Dry Fractionation | Candidate for olein grade, PMF, and Fractionation 500 when F/RFA-004(B) has only one olein total |
| F/RFA-001 | Quality Report | Separator FFA, moisture, and DOBI when F/QCO-002 does not cover them |
| F/UTI-006 | Monitoring Display Meter Air | Water, only when F/RFA-004 does not already carry that meter |
| F/UTI-004 | Form Pemakaian Bahan Bakar Boiler Taihu 15 T/H | Solar or other boiler fuel, only when that column is not already on F/RFA-004(A) |

When the same meter is on a production sheet and on a utility log, the field map names one owner. The other copy stays on its own form trail and is not added into the report total.

### 3. Do not pull these into the report job

They can be stored as submissions. They do not fill Daily Production.

| Forms | Why they stay out |
| --- | --- |
| F/RFA-013, F/RFA-015, F/RFA-016 | Lamps and glass, change-product, and start-up checklists |
| F/TNF-002, F/TNF-005 | Filter-bag log and loading-pipe checklist |
| F/QCO-004, F/QCO-006, F/QCO-008, F/QCO-014, F/QCO-021, F/QCO-022 | Retain sample, container, cleanliness, and laboratory housekeeping |
| F/QCO-012(A), F/QCO-012(B) | Registered without a name. Map them only after the form page is identified |
| F/UTI-005, F/UTI-010, F/UTI-011(a), F/UTI-011(b), F/UTI-012, F/WTP-001, F/WTP-006, F/WWTP-001 | Boiler chemical, coal, boiler water, and effluent. They belong on a utility screen |
| F/RFA-003 | Deodorising and filtration shift log. It explains a shift. It does not add the day's tonnes |
| F/QCO-018 | Form transfer. Use it only if F/TNF-004 does not already carry transfers |

## Cells that stay blank

These are not waiting on a form in the register of 41.

| Cell | Why it stays `-` |
| --- | --- |
| Supporting-material opening and closing | The register has usage and receipts (F/RFA-004(A) bags and phosphoric acid, F/TNF-009, F/QCO-011). It has no store ledger, so opening and closing cannot be generated. The eight names on the screen stay listed: BE SSA `912.001.004`, BE SSB `912.001.Z05`, BE SSM `912.001.006`, Clariant 331S, Tonsil 331M, phosphoric acid min. 85%, vitamin A palmitate `926.601`, citric acid anhydrate `912.005.002` |
| Bleaching-earth grades (SSA, SSB, SSM, Clariant 331S, 331M) | Stay blank unless F/RFA-004(A) actually has a grade column. The sample log has a bag total only |
| Solar and FAME | No form is named for them. Fill them only if a column appears on F/RFA-004(A) or F/UTI-004 |
| Separator feed, washed CPO, citric acid, downtime | No separator form is registered. F/RFA-002 is the candidate. Until that workbook is mapped, the separator page stays `-` |
| Downtime hours (scheduling, commercial, technical, utility) | No downtime form is registered. Fill the hours only when a mapped sheet has them |
| Plan versus actual | Typed into the old management workbook. It is not a logsheet |
| Fractionation yield and fractionation loss | Rule, not a missing extract. Tonnes are shown. Yield and loss stay `-` |
| Steam ratio, water, compressor | Water and compressor stay `-` until a mapped column with a unit exists. Steam quantity can be stored. Its ratio stays `-` |

## Job behaviour

1. Import each business day's submission for the four core forms. Keep the raw sheet. Map fields in a second step.
2. A day with no submission is a row of `-`. It is not omitted from a range the user selected, and it is not stored as zero.
3. Re-running the job for a date replaces that date's mapped facts and records which import version was used. It does not change other dates.
4. The report screen reads the mapped facts. Generating or refreshing the report does not edit the stored submission.
5. After F/RFA-004(A) and F/RFA-004(B) are daily, stop using the hardcoded 6–8 Oct sample in the application.
6. Attach F/TNF-003 stock to the report date. The current screen shows the latest sounding for every selected day. The job must not copy that shortcut.
