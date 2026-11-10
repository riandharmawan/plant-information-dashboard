# Staging rollout: Stock Overview, Bontang and Tanjung Pura

This is an **update** of an existing staging (see [STAGING-3-SERVER-DEPLOY-RUNBOOK.md](STAGING-3-SERVER-DEPLOY-RUNBOOK.md) for the servers, ports and first-time setup). It brings staging from the old dump (`schema_migrations=7`) up to branch `sit` and switches on the two gauge sites.

| Server | What | Address |
| --- | --- | --- |
| API host | Node API, cron for the gauge poller | `172.28.92.57` |
| App host | nginx and the React app | `172.28.92.56`, open `http://172.28.92.56:3091` |
| ApsaraDB | PostgreSQL `pid_db` | `pgm-d9jx9o06qae8gf3h.pgsql.ap-southeast-5.rds.aliyuncs.com` |

## 0. What goes to staging, and what does not

- **Code and migrations** go through git (`sit`) and the two deploy scripts.
- **The Bontang and Tanjung Pura gauge data** (tanks, latest readings, samples, capacities, product groups, gauge addresses) goes as **one JSON file** made on your PC and loaded on the API host with `import-gauge-data.js` (step 6). It only touches those two sites' gauge rows, never users, roles or Bekasi data, and it can be repeated safely.
- **Do not** restore `pid_staging.dump` for this. The restore script runs `pg_restore --clean`, which replaces everything in staging with what is on your PC.

The poller then carries on from the imported rows every 15 minutes, with no duplicate tanks.

## 1. Push the branch (your PC)

`sit` is ahead of `origin/sit`. Staging pulls from origin, so push first. Only committed work goes. Your uncommitted variance work does not.

```bash
git status -sb
git push origin sit
```

## 2. Check staging before deploying (API host)

```bash
cd /opt/plant-information-dashboard
psql "$DATABASE_URL" -c "SELECT id, hub_code, is_activated FROM sites WHERE hub_code IN ('SITE-0009','SITE-0017','SITE-0026');"
psql "$DATABASE_URL" -c "SELECT id FROM schema_migrations ORDER BY id;"
psql "$DATABASE_URL" -c "SELECT count(*) FROM users;"
```

Expected:

- The three sites exist. The **ids should be `bontang`, `tanjung-pura` and `bekasi`**. Migration 013 and the gauge screens rely on those two ids. If the ids differ, stop and tell me what they are.
- `schema_migrations` stops at 007. Migrations 008 to 014 will be applied.
- `users` is not 0. This is your proof that you must not restore the dump.

Take a backup first (RDS snapshot, or `pg_dump -Fc` from the API host).

## 3. Deploy the API (API host)

```bash
cd /opt/plant-information-dashboard
export DEPLOY_BRANCH=sit
export RUN_MIGRATE=1
bash Backend/scripts/deploy-staging-api.sh deploy
curl -s http://127.0.0.1:3011/api/v1/health
```

What the migrations do on staging:

| Migration | Effect |
| --- | --- |
| 010 | Adds company and site activation. A site that has logsheets or users stays on. **Others are off** until you switch them on (step 5). |
| 011, 012 | Gauge tables, tank capacity, product groups. |
| 013 | Site modules. Bontang and Tanjung Pura get only the Tank farm module, every other site keeps all. |
| 014 | New page right `management-stock`, given to Administrator, plus a **Management Viewer** role. |

`.env` needs no new secrets. `JWT_SECRET` must stay the same, because gauge passwords are encrypted with it (the two sites here need none).

## 4. Deploy the frontend (App host)

```bash
cd /opt/plant-information-dashboard
export DEPLOY_BRANCH=sit
bash Backend/scripts/deploy-staging-frontend.sh deploy
```

## 5. Switch the sites on and give people access (browser)

Sign in as an Administrator.

1. **Master, Company** and **Master, Site**: make sure the companies and sites for Bontang (SITE-0009) and Tanjung Pura (SITE-0017) are **activated**.
2. **Administration, Users**: give each user the sites they should see.
3. **Administration, Roles**: for management users, give them the **Management Viewer** role (it holds only Stock Overview, view). Operators keep their normal roles.

## 6. Load the Bontang and Tanjung Pura data (your PC, then the API host)

**On your PC** (repo root, dev database running), make the file:

```bash
cd Backend
node scripts/export-gauge-data.js --sites=bontang,tanjung-pura --out=backups/gauge-data-bontang-tj-pura.json
```

It prints the row counts (about 105 tanks, 150 samples). The file holds no passwords and no user ids, and it is ignored by git. Send it to the API host:

```bash
scp Backend/backups/gauge-data-bontang-tj-pura.json root@172.28.92.57:/opt/plant-information-dashboard/Backend/backups/
```

**On the API host**, a dry run first. It does everything and then rolls back:

```bash
cd /opt/plant-information-dashboard
mkdir -p Backend/backups
docker compose --env-file Backend/.env -f docker-compose.backend-api-only.yml cp Backend/backups/gauge-data-bontang-tj-pura.json pid-api:/app/backups/gauge-data-bontang-tj-pura.json
docker compose --env-file Backend/.env -f docker-compose.backend-api-only.yml exec -T pid-api   node scripts/import-gauge-data.js backups/gauge-data-bontang-tj-pura.json
```

Every table should show "in file" and "written" counts, and the last line must say "Rolled back". If it says "Failed", nothing was saved. Read the message. The usual cause is that a site id is missing (the sites must exist on staging with the ids `bontang` and `tanjung-pura`). Then save it:

```bash
docker compose --env-file Backend/.env -f docker-compose.backend-api-only.yml exec -T pid-api   node scripts/import-gauge-data.js backups/gauge-data-bontang-tj-pura.json --apply
```

The file already holds the Tanjung Pura capacities (29 tanks), so you do **not** need `load-tank-capacities.js`. Use that script only to change them later.

## 7. Check the gauge systems and read them (browser)

The import in step 6 already adds these four addresses, so after it you only need to check them (**Test connection**, **Poll now**). If you add them by hand first, the import will update them rather than duplicate them. Open **Master, Tank gauging**, pick the site, and **Add gauge system** (no sign-in is needed for these).

| Site | Address | Notes |
| --- | --- | --- |
| Bontang | `http://172.16.250.15` | NXA820_BT_1 |
| Bontang | `http://172.16.250.16` | NXA820_BT_2 |
| Bontang | `http://172.16.11.77` | NXA820_BT_3 |
| Tanjung Pura | `http://172.16.11.28` | One gateway with four units (TS-01 to TS-04), 60 tanks. The domain `http://atg-pura.kpndomain.com` reaches the same gateway. |

First check the API host can reach them:

```bash
for h in 172.16.250.15 172.16.250.16 172.16.11.77 172.16.11.28; do
  curl -s -m 10 -o /dev/null -w "$h %{http_code}\n" http://$h/index.esp
done
```

Anything other than `200` or `302` means a network rule is missing between the API host and the gauge, and has to be fixed before polling.

Then, for each row: **Test connection**, then **Poll now**. The tanks and readings should appear within a minute or two. The first poll also reads each tank's capacity from the gauge (Bontang) and takes longer.

## 8. Schedule the poller (API host)

Use the two cron lines in [TANK-GAUGING-POLLER-CRON.md](TANK-GAUGING-POLLER-CRON.md#schedule-it): the poll every 15 minutes and the purge once a day. Then check the log after the next quarter hour:

```bash
tail -n 20 /var/log/pid-tank-gauging-poll.log
```

## 9. Check it

1. **Tank & Stock Dashboard** for Bontang and Tanjung Pura shows tanks, "Live" badge and fill levels.
2. **Management, Stock Overview** (as an Administrator or a Management Viewer) shows three sites. A site that has not been polled for over an hour is marked as old data.
3. A user without the Tank farm module for a site does not see that site in the overview.

## 10. Things that can go wrong

- **Bekasi plant move.** On dev, the Bekasi logsheet data was moved to plant `PLT-0087` with `Backend/scripts/move-plant-data.js`. Staging still has the data on the old plant. Run it as a dry run first. It pauses foreign key checks, which needs a database superuser, and the RDS user may not be one. Do this only if a Bekasi screen looks empty after the deploy, and tell me before applying.
- **Poll says a host is unreachable.** See the `curl` check in step 7.
- **Rollback.** `bash Backend/scripts/deploy-staging-api.sh rollback` (and the frontend equivalent). Migrations are not reversed. The new tables and columns are additive, so an older version of the app keeps working.
