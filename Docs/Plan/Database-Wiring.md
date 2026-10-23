# What is in the database

The app that reads the database is `http://localhost:5176`. The API is `http://127.0.0.1:3010/api/v1`. Site id is `bekasi`. Plant id is `priscolin-proj-bekasi`. Table rules are in `Docs/DATABASE-DESIGN.md`.

## Already in the database and already on the screen

| Form | Tables | Rows | Screen |
| --- | --- | --- | --- |
| F/TNF-003 sounding | `soundings` | 2,407 | Tank Farm. Level, temperature, and status are stored. Kilograms are computed from calibration. |
| F/QCO-001 storage analytical | `storage_certificates`, `certificate_parameters` | 225 certificates, 1,464 tests | Quality Control, Storage Tanks. Live Ops uses these for FFA, M&I, and retest age. `lab_results` is empty and is not the source. |
| F/QCO-002 refinery quality | `refinery_quality_days` and its readings, streams, and parameters | 7 days (14–20 Oct 2026), 147 readings, Refinery 150 only | `/qc/refinery` and the quality table on Refinery 150. Routes: `GET /sites/bekasi/qc/refinery`, `/refinery/history`, `/refinery/hourly`, `/refinery/ledger`. |

## In the database, not on any screen

| Form | Tables | Rows | What is missing |
| --- | --- | --- | --- |
| F/RFA-004(A) refinery daily log | `production_days`, `production_flows`, `production_materials`, `production_utilities`, `production_remarks` | 2 days, both `refinery150`: 19 Oct and 20 Oct. 16 flow lines, 7 material lines, 12 utility lines, 2 remarks. | No API route. Daily Production still builds its numbers from `Frontend/src/data/logsheets.json`. |
| F/RFA-004(B) fractionation daily log | same production tables | 0 rows. Units `fractionation400` and `fractionation500` exist. | No workbooks were downloaded for this range, so there is nothing to show. |
| F/TNF-004 oil in/out | `oil_movement_days`, `oil_movements` | 23 days, 22 Sep–20 Oct 2026, 211 visits. | No API route. `GET /sites/bekasi/qc/movements` still reads the old `gate_movements` table (488 rows). Direction and tonnes are not stored. The screen derives direction from the seals. |

`refinery500` exists as a process unit and has no production rows.

## Wiring to do

- Daily Production, Refinery 150, Refinery 500, Fractionation 400, and Fractionation 500 should read `production_days` and its child tables. Refinery 500 and both fractionation units will be blank for this extract.
- The oil in/out screen should read `oil_movements`, not `gate_movements`.
- Do not recompute a flowmeter total. Store and show the printed number. A blank stays null.
