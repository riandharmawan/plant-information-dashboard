# Staging — First-Time 3-Server Deployment Runbook

Deploys Plant Information Dashboard from the **`sit`** branch onto **two shared ECS hosts + ApsaraDB RDS** in one private VPC. Staging is **internal only** (`http://172.28.92.56:3091`). A domain can be added later without rebuilding the frontend (`VITE_API_URL` stays `/api/v1`).

| # | Server | Role | Compose file | Host port(s) |
|---|--------|------|--------------|--------------|
| 1 | **ApsaraDB RDS** | PostgreSQL | — | `5432` (`172.28.92.57` whitelisted only) |
| 2 | **Backend** `172.28.92.57` | Node API only | `docker-compose.backend-api-only.yml` | **`3011`** → container `3010` (App IP only) |
| 3 | **Frontend / App** `172.28.92.56` | nginx + React SPA | `docker-compose.app.yml` | **`3091`** → container `80` (VPC / office) |

**Why not 3090 / 3010:** those host ports are already taken on this pair (`msd-fe` on App `:3090`, `project_management_backend_staging` on API `:3010`). Inside the PID containers the process ports stay `80` and `3010`. Only the **published host ports** change (`PID_FE_PORT`, `PID_API_PORT`).

**Deploy order is mandatory: RDS (data load) → Backend (migrate) → Frontend.**

**Subsequent code deploys:** `Backend/scripts/deploy-staging-api.sh` on the API host and `Backend/scripts/deploy-staging-frontend.sh` on the App host (`DEPLOY_BRANCH=sit`).

## Locked inventory (SIT)

| Name | Value |
|---|---|
| `RDS_HOST` | `pgm-d9jx9o06qae8gf3h.pgsql.ap-southeast-5.rds.aliyuncs.com` |
| `API_IP` | `172.28.92.57` |
| `APP_IP` / browser URL | `172.28.92.56` — open `http://172.28.92.56:3091` |
| `PID_API_PORT` | `3011` |
| `PID_FE_PORT` | `3091` |
| Repo directory | `/opt/plant-information-dashboard` on both ECS hosts |
| Branch | `sit` |

Do not attach a public IP for this app. `APP_PUBLIC` is the same as `APP_IP` until a hostname is added. When a domain arrives, add it to `CORS_ORIGIN` only.

---

## 0. Security Group (Alibaba Cloud ECS → Inbound)

| Port | Server | Source | Purpose |
|---|---|---|---|
| 22 | App + API | your office/VPN IP | SSH |
| **`3091`** | App `172.28.92.56` | VPC / office CIDR | SPA + proxied `/api/` |
| **`3011`** | Backend `172.28.92.57` | **`172.28.92.56/32` only** | nginx → API |
| 5432 | ApsaraDB | **`172.28.92.57/32` only** | Postgres (API → RDS) |

Never expose `3011` or `5432` to the internet. Do not change the existing `3090` / `3010` rules — other products use them. The browser only talks to the App server.

---

## 1. One-time prep on BOTH ECS servers

These hosts already run Docker (Jetty and other staging apps). **Do not reinstall Docker** and **do not reboot** for the Ubuntu “restart required” banner.

### 1.1 Check (always)

```bash
whoami
docker version
docker compose version
git --version
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}'
ss -lntup | grep -E ':3091|:3011|:3090|:3010 '
ls -ld /opt/plant-information-dashboard
```

Pass when:

- `docker version` shows Client **and** Server.
- You are `root` or in the `docker` group (no “permission denied”).
- **`:3091` on App and `:3011` on API are free.** Leave Jetty (`jps-api` `:3000`, `jps-fe` `:3080`) and every other container running.
- Occupied `:3090` (MSD) and `:3010` (Project Management / host nginx) are expected. Do not publish PID there.

**API host only** — restore needs the client tools, not a Postgres server:

```bash
psql --version
pg_restore --version
```

If those commands are missing:

```bash
apt-get update
apt-get install -y postgresql-client
```

### 1.2 Repo

If `/opt/plant-information-dashboard` is missing:

```bash
mkdir -p /opt/plant-information-dashboard
git clone https://github.com/riandharmawan/plant-information-dashboard.git /opt/plant-information-dashboard
cd /opt/plant-information-dashboard
git checkout sit && git pull origin sit
git log -1 --oneline
```

If the directory already exists:

```bash
cd /opt/plant-information-dashboard
git fetch origin
git checkout sit && git pull origin sit
git log -1 --oneline
```

Leave other products’ `/opt/...` trees alone.

### 1.3 ApsaraDB (before API deploy)

- Database `pid_db` and user `pid_user` created; **`timezone = Asia/Jakarta`** on the instance.
- Whitelist **`172.28.92.57`** on port **5432**.

```bash
pg_isready -h pgm-d9jx9o06qae8gf3h.pgsql.ap-southeast-5.rds.aliyuncs.com -p 5432
```

---

## 2. Load data into ApsaraDB (from local dev)

On **Windows dev** (repo root), with local `pid-db` running:

```powershell
.\Backend\scripts\staging-pg-dump-local.ps1
```

Or manually:

```powershell
docker exec pid-db pg_dump -U pid_user -d pid_db -Fc -f /tmp/pid_staging.dump
docker cp pid-db:/tmp/pid_staging.dump .\pid_staging.dump
```

Copy `pid_staging.dump` to the **API server** (SCP, not git):

```powershell
scp .\pid_staging.dump root@172.28.92.57:/opt/plant-information-dashboard/pid_staging.dump
```

On the **API server**:

```bash
cd /opt/plant-information-dashboard
export RDS_HOST='pgm-d9jx9o06qae8gf3h.pgsql.ap-southeast-5.rds.aliyuncs.com'
export RDS_USER='pid_user'
export RDS_DB='pid_db'
export PGPASSWORD='…'

bash Backend/scripts/staging-pg-restore-rds.sh pid_staging.dump
unset PGPASSWORD
```

Expected counts after restore (from local dev baseline): see [Backend/backups/staging-local-dump-baseline.txt](../../Backend/backups/staging-local-dump-baseline.txt) (`soundings=2488`, `schema_migrations=7`, `users=1`).

If the dump has no `admin` user, run **`npm run seed:admin`** after the API container is up (step 3).

---

## 3. Backend server (`172.28.92.57`) — API container

```bash
cd /opt/plant-information-dashboard
cp Backend/.env.staging.example Backend/.env
# Edit Backend/.env: POSTGRES_PASSWORD, JWT_SECRET, logsheet secrets.
# Keep PID_API_PORT=3011 and CORS_ORIGIN=http://172.28.92.56:3091
```

`PID_API_PORT` is the **host** publish port. `PORT=3010` stays the listen port inside the container.

**RDS password with `#` or `@`:** set a full **`DATABASE_URL`** in `Backend/.env` with URL-encoded password, or compose will build an invalid URL (see Jetty `APSARADB-STAGING-CUTOVER.md`).

```bash
export DEPLOY_BRANCH=sit
export RUN_MIGRATE=1
bash Backend/scripts/deploy-staging-api.sh deploy
```

Optional admin bootstrap:

```bash
docker compose --env-file Backend/.env -f docker-compose.backend-api-only.yml exec -T pid-api npm run seed:admin
```

Health (host port **3011**):

```bash
curl -s http://127.0.0.1:3011/api/v1/health
```

---

## 4. Frontend / App server (`172.28.92.56`)

`Frontend/nginx.alicloud-app.conf` already points at `172.28.92.57:3011`. Confirm; do not `sed` it back to `:3010`.

```bash
cd /opt/plant-information-dashboard
grep server Frontend/nginx.alicloud-app.conf
# expect: server 172.28.92.57:3011;

cp .env.staging.example .env
# PID_FE_PORT=3091, VITE_DATA_SOURCE=api, VITE_API_URL=/api/v1
```

```bash
export DEPLOY_BRANCH=sit
bash Backend/scripts/deploy-staging-frontend.sh deploy
```

Open **`http://172.28.92.56:3091`**. Log in (dev dump: same password as local; or `admin` / `admin123` after `seed:admin`). Change that password after first login.

---

## 5. Smoke test

On the App host:

```bash
curl -s -o /dev/null -w "SPA %{http_code}\n"  http://localhost:3091/
curl -s -o /dev/null -w "API %{http_code}\n"  http://localhost:3091/api/v1/health
```

From a laptop on the VPC / VPN:

```bash
curl -s -o /dev/null -w "SPA %{http_code}\n"  http://172.28.92.56:3091/
curl -s -o /dev/null -w "API %{http_code}\n"  http://172.28.92.56:3091/api/v1/health
```

Browser: login → Tank Farm → QC → Daily Production.

If localhost on the App host is `200` but the laptop fails, the App security group is not allowing your office/VPN CIDR on **`3091`**.

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
- `CORS_ORIGIN` — every origin users open the app from (today `http://172.28.92.56:3091`; add the hostname later).
- `COOKIE_SECURE=false` for HTTP staging; `true` once on HTTPS.
- Logsheet credentials — API `Backend/.env` only.

---

## Reference (Jetty Planning System patterns)

- [JPS STAGING-3-SERVER-DEPLOY-RUNBOOK.md](../../../Jetty%20Planning%20system/Docs/Guide/STAGING-3-SERVER-DEPLOY-RUNBOOK.md)
- [JPS APSARADB-STAGING-CUTOVER.md](../../../Jetty%20Planning%20system/Docs/Guide/APSARADB-STAGING-CUTOVER.md) — `DATABASE_URL` and special characters in passwords
