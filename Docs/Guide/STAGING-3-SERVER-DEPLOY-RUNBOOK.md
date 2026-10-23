# Staging — First-Time 3-Server Deployment Runbook

Deploys Plant Information Dashboard from the **`sit`** branch onto **two ECS hosts + ApsaraDB RDS** in one private VPC:

| # | Server | Role | Compose file | Host port(s) |
|---|--------|------|--------------|--------------|
| 1 | **ApsaraDB RDS** | PostgreSQL | — | `5432` (API IP whitelisted only) |
| 2 | **Backend** | Node API only | `docker-compose.backend-api-only.yml` | `3010` (app IP only) |
| 3 | **Frontend / App** | nginx + React SPA | `docker-compose.app.yml` | `3090` (public) |

**Deploy order is mandatory: RDS (data load) → Backend (migrate) → Frontend.**

**Subsequent code deploys:** `Backend/scripts/deploy-staging-api.sh` on the API host and `Backend/scripts/deploy-staging-frontend.sh` on the App host (`DEPLOY_BRANCH=sit`).

Substitute placeholders throughout:

| Placeholder | Meaning | Example |
|---|---|---|
| `RDS_HOST` | ApsaraDB endpoint | `pgm-….pgsql.ap-southeast-5.rds.aliyuncs.com` |
| `API_IP` | Backend server private IP | `172.28.92.57` |
| `APP_IP` | App server private IP | `172.28.92.56` |
| `APP_PUBLIC` | App public IP / DNS users hit | `203.0.113.10` |
| `APP_PORT` | App host port | `3090` |

**Repo directory (both ECS hosts):** `/opt/plant-information-dashboard`

---

## 0. Security Group (Alibaba Cloud ECS → Inbound)

| Port | Server | Source | Purpose |
|---|---|---|---|
| 22 | App + API | your office/VPN IP | SSH |
| `3090` | App | users / internet | SPA + proxied `/api/` |
| 3010 | Backend | **`APP_IP/32` only** | API (nginx → API) |
| 5432 | ApsaraDB | **`API_IP/32` only** | Postgres (API → RDS) |

Never expose 3010 or 5432 to the internet. The browser only talks to the App server.

---

## 1. One-time prep on BOTH ECS servers

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin postgresql-client
sudo usermod -aG docker $USER && newgrp docker

sudo mkdir -p /opt/plant-information-dashboard && sudo chown $USER:$USER /opt/plant-information-dashboard
git clone https://github.com/riandharmawan/plant-information-dashboard.git /opt/plant-information-dashboard
cd /opt/plant-information-dashboard
git checkout sit && git pull origin sit
```

**ApsaraDB (before API deploy):**

- Database `pid_db` and user created; **`timezone = Asia/Jakarta`** on the instance.
- Whitelist **API** private IP on port **5432**.

---

## 2. Load data into ApsaraDB (from local dev)

On **Windows dev** (repo root):

```powershell
.\Backend\scripts\staging-pg-dump-local.ps1
```

Or manually:

```powershell
docker exec pid-db pg_dump -U pid_user -d pid_db -Fc -f /tmp/pid_staging.dump
docker cp pid-db:/tmp/pid_staging.dump .\pid_staging.dump
```

Copy `pid_staging.dump` to the **API server** (SCP, not git).

On the **API server** (install `postgresql-client` if needed):

```bash
export RDS_HOST='pgm-….rds.aliyuncs.com'
export RDS_USER='pid_user'
export RDS_DB='pid_db'
export PGPASSWORD='…'

bash Backend/scripts/staging-pg-restore-rds.sh pid_staging.dump
```

Expected counts after restore (from local dev baseline): see [Backend/backups/staging-local-dump-baseline.txt](../../Backend/backups/staging-local-dump-baseline.txt) (`soundings=2488`, `schema_migrations=7`, `users=1`).

If the dump has no `admin` user, run **`npm run seed:admin`** after the API container is up (step 3).

---

## 3. Backend server (`API_IP`) — API container

```bash
cd /opt/plant-information-dashboard
cp Backend/.env.staging.example Backend/.env
# Edit Backend/.env: RDS_HOST, POSTGRES_*, JWT_SECRET, CORS_ORIGIN (app URLs), logsheet secrets.

export DEPLOY_BRANCH=sit
export RUN_MIGRATE=1
bash Backend/scripts/deploy-staging-api.sh deploy
```

**RDS password with `#` or `@`:** set a full **`DATABASE_URL`** in `Backend/.env` with URL-encoded password, or compose will build an invalid URL (see Jetty `APSARADB-STAGING-CUTOVER.md`).

Optional admin bootstrap:

```bash
docker compose --env-file Backend/.env -f docker-compose.backend-api-only.yml exec -T pid-api npm run seed:admin
```

Health:

```bash
curl -s http://127.0.0.1:3010/api/v1/health
```

---

## 4. Frontend / App server (`APP_IP`)

```bash
cd /opt/plant-information-dashboard

sed -i 's/172.28.92.57:3010/API_IP:3010/' Frontend/nginx.alicloud-app.conf

cp .env.staging.example .env
# PID_FE_PORT=3090, VITE_DATA_SOURCE=api, VITE_API_URL=/api/v1

export DEPLOY_BRANCH=sit
bash Backend/scripts/deploy-staging-frontend.sh deploy
```

Open **`http://APP_PUBLIC:3090`**. Log in (dev dump: same password as local; or `admin` / `admin123` after `seed:admin`).

---

## 5. Smoke test

```bash
curl -s -o /dev/null -w "SPA %{http_code}\n"  http://localhost:3090/
curl -s -o /dev/null -w "API %{http_code}\n"  http://localhost:3090/api/v1/health
```

Browser: login → Tank Farm → QC → Daily Production.

---

## 6. Updating staging later

```bash
# App server (frontend-only releases)
cd /opt/plant-information-dashboard
export DEPLOY_BRANCH=sit
bash Backend/scripts/deploy-staging-frontend.sh deploy

# API server (backend or migrations)
cd /opt/plant-information-dashboard
export DEPLOY_BRANCH=sit
export RUN_MIGRATE=1
bash Backend/scripts/deploy-staging-api.sh deploy
```

---

## 7. Rollback

```bash
# App host
bash Backend/scripts/deploy-staging-frontend.sh rollback

# API host (migrations not reversed)
bash Backend/scripts/deploy-staging-api.sh rollback
```

---

## Secrets checklist (never commit)

- `POSTGRES_PASSWORD` / `DATABASE_URL` on API server only.
- `JWT_SECRET` — API server only.
- `CORS_ORIGIN` — every origin users open the app from.
- `COOKIE_SECURE=false` for HTTP staging; `true` once on HTTPS.
- Logsheet credentials — API `Backend/.env` only.

---

## Reference (Jetty Planning System patterns)

- [JPS STAGING-3-SERVER-DEPLOY-RUNBOOK.md](../../../Jetty%20Planning%20system/Docs/Guide/STAGING-3-SERVER-DEPLOY-RUNBOOK.md)
- [JPS APSARADB-STAGING-CUTOVER.md](../../../Jetty%20Planning%20system/Docs/Guide/APSARADB-STAGING-CUTOVER.md) — `DATABASE_URL` and special characters in passwords
