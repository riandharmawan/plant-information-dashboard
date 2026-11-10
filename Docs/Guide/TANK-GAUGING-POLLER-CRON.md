# Tank gauging: set up and schedule the poller

Bontang and Tanjung Pura read their tanks from TankVision (NXA) gauge units instead of logsheets. This is the same approach as Jetty Planning System. The scripts run **once per call**. The **schedule is cron on the backend host**, not a timer inside the app.

| Job | Script | How often | What it writes |
| --- | --- | --- | --- |
| Poll | `Backend/scripts/run-tank-gauging-poll.js` | every 15 minutes | `tank_gauging_latest`, `tank_gauging_samples`, then the daily rounds into `soundings` |
| Purge | `Backend/scripts/purge-tank-gauging-samples.js` | once a day | archives and deletes old samples, logged in `tank_gauging_purge_log` |

The latest reading is never purged, and the daily rounds live in `soundings`, so purging samples does not lose history.

## What happens on each poll

1. For each gauge system that is switched on, read its tank list and add any new tank (a tank keeps its identity by host, unit and number, so renaming it on the gauge does not create a second one).
2. Read the live values: level, temperature, density, volume, mass, flow, product and status. Store the latest reading and one sample per tank.
3. For each site, when a round time has passed (default **06:30** and **14:30**, in the site's own timezone), save the nearest reading within 30 minutes as that day's round. Yesterday and today are checked every run, so a missed poll is filled in later.
   - A reading the unit marks as no data, failed or invalid is not turned into a round. A tank that reads a level of 0 with nothing else to back it up is skipped too.

The units are slow, about one to two seconds a call, and the poller reads them one after another. Do not poll faster than every five minutes.

## Before you start

1. Migration `011_tank_gauging.sql` is applied. The deploy script runs it. You can also run `npm run migrate` in `Backend`.
2. The backend host can reach every gauge address. Test from the host:

   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" http://172.16.250.15/index.esp
   ```

3. The site is switched on in Master, Site, and the people who set this up have **Master tanks, edit** rights.
4. `Backend/.env` has `JWT_SECRET`. Gauge passwords are encrypted with it, so it must not change later.

## Add the gauge systems

Open **Master, Tank gauging**, pick the site, and use **Add gauge system**.

| Site | Address | Sign-in |
| --- | --- | --- |
| Bontang (SITE-0009) | `http://172.16.250.15`, `http://172.16.250.16`, `http://172.16.11.77` | none |
| Bontang, OLEO unit | `http://172.16.250.17` | user and password. Add it when the unit is back online. |
| Tanjung Pura (SITE-0017) | `http://172.16.11.28` (or `http://atg-pura.kpndomain.com`, the same gateway) | none |

Enter passwords on the screen only. They are stored encrypted and never shown again.

Use **Test connection** on each row. It reads the tank list and shows how many units and tanks it found. Then use **Poll now** once to see the tanks and readings appear.

> **Tanjung Pura** is one gateway (TC-01) holding four units (TS-01 to TS-04) that each number their tanks from 1. The poller reads each unit in turn by name (`DATATYPE=39` with `REMOTE=<unit>`), so one source covers all 60 tanks. Use `http://172.16.11.28`, which needs no sign-in. The gauge gives no capacity, so load it from the stock report with `node scripts/load-tank-capacities.js scripts/tank-capacities/tanjung-pura.json` (see [STAGING-ROLLOUT-BONTANG-TJ-PURA.md](STAGING-ROLLOUT-BONTANG-TJ-PURA.md)).

## Schedule it

On the backend host (`172.28.92.57`), as the user that runs Docker:

```bash
sudo touch /var/log/pid-tank-gauging-poll.log /var/log/pid-tank-gauging-purge.log
sudo chown "$USER" /var/log/pid-tank-gauging-poll.log /var/log/pid-tank-gauging-purge.log
crontab -e
```

Add:

```cron
# Tank gauging poll: every 15 minutes
*/15 * * * * cd /opt/plant-information-dashboard && docker compose --env-file Backend/.env -f docker-compose.backend-api-only.yml exec -T pid-api node scripts/run-tank-gauging-poll.js >> /var/log/pid-tank-gauging-poll.log 2>&1

# Sample purge: every day at 02:20
20 2 * * * cd /opt/plant-information-dashboard && docker compose --env-file Backend/.env -f docker-compose.backend-api-only.yml exec -T pid-api node scripts/purge-tank-gauging-samples.js >> /var/log/pid-tank-gauging-purge.log 2>&1
```

Change how often it runs by editing the first field, for example `*/10` for every 10 minutes. The round times are not in cron. They are set on the Tank gauging page under **Daily rounds**.

Only one poll runs at a time. If a run is still going when the next starts, the new one exits quietly.

## Check that it works

```bash
cd /opt/plant-information-dashboard

# One poll by hand. Prints a JSON summary. Exit code 1 means a gauge system failed.
docker compose --env-file Backend/.env -f docker-compose.backend-api-only.yml exec -T pid-api node scripts/run-tank-gauging-poll.js --siteId=bontang

tail -n 40 /var/log/pid-tank-gauging-poll.log
```

- On the Tank gauging page, each gauge system shows its last poll, whether it worked, and the last error.
- Rounds appear in Live Ops after the first round time has passed and a poll has run. Until then the Tank gauging page shows the latest readings.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `Tank list HTTP 204 (empty)` | The unit was not ready. It is retried once. If it stays, the unit may be busy or the address is wrong. |
| `... did not answer` or a timeout | The host cannot reach the gauge. Check the network from the backend host, not from your PC. |
| `live values HTTP 200` with no readings | The unit wants a sign-in. Set the sign-in type on the gauge system. |
| `This host has 4 units ...` | A controller with several units (Tanjung Pura). Not set up yet, as noted above. |
| Tank shows `NODATA` or `Fail` | The gauge itself has no valid reading. No round is saved for it. |
| Many `INIT` statuses | Normal. The units report real density and mass with `INIT`. Those values are used. |
| No rounds for a site | Check that a round time has passed, that a poll ran within the last 30 minutes of it, and that the site's timezone is right in Master, Site. |

## Retention

| Setting | Default | Meaning |
| --- | --- | --- |
| `TANK_GAUGING_SAMPLE_ACTIVE_DAYS` | 30 | samples older than this are archived |
| `TANK_GAUGING_SAMPLE_ARCHIVE_DAYS` | 7 | archived samples older than this are deleted |

Set them in `Backend/.env` and pass them to the container if you change them.
