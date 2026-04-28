# NMMS Tracker — MGNREGA Attendance Monitor

Daily attendance tracker for MGNREGA workers via NMMS App — Jharkhand.  
Photos are downloaded locally — no dependency on MGNREGA server for display.

## Stack
- **Frontend / API** — Next.js 14 (App Router, standalone build)
- **Database** — PostgreSQL 16
- **Scraper** — Python 3.12 + BeautifulSoup + Playwright
- **Deployment** — Docker Compose (Synology NAS / any Linux server)
- **Timezone** — Asia/Kolkata (IST) throughout

---

## Ports

| Service | Host Port | Container Port |
|---------|-----------|----------------|
| Web App | **4782**  | 3000           |
| PostgreSQL | internal only | 5432    |

Access the app at: `http://your-nas-ip:4782`

---

## Local Development

### 1. Start PostgreSQL
```bash
docker run -d --name nmms-pg \
  -e POSTGRES_DB=nmms_db \
  -e POSTGRES_USER=nmms \
  -e POSTGRES_PASSWORD=nmms_dev_123 \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. Setup app
```bash
cd mgnrega-tracker
cp .env.example .env          # edit DATABASE_URL for local postgres
npm install
npx prisma migrate dev --name init
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
npm run dev
```
App runs at `http://localhost:3000`

### 3. Run scraper locally
```bash
cd scraper
pip install -r requirements.txt
playwright install chromium
PHOTOS_DIR=../public/photos python3 scraper.py --date 2026-04-28 --api-url http://localhost:3000
```

---

## Production Deployment — Synology NAS

### Prerequisites
- Synology NAS with **Container Manager** (DSM 7.2+) or Docker package
- SSH access enabled
- Port **4782** open in NAS firewall

---

### Step 1 — Clone repo on NAS

SSH into your NAS:
```bash
ssh admin@your-nas-ip
```

Create project directory and clone:
```bash
mkdir -p /volume1/docker/nmms-tracker
cd /volume1/docker/nmms-tracker
git clone https://github.com/rajatpoddar/NMMS-Tracker.git .
cd mgnrega-tracker
```

---

### Step 2 — Set password

Copy the example env file and set a strong password:
```bash
cp .env.example .env
```

Edit `.env` — change `YOUR_PASSWORD_HERE` to a strong password:
```bash
vi .env
```

Also set the same password in `docker-compose.yml` or use the env variable:
```bash
export POSTGRES_PASSWORD="YourStrongPassword123!"
```

---

### Step 3 — Build and start

```bash
docker-compose up -d --build
```

First build takes ~5-10 minutes (downloads Playwright, builds Next.js).

Check status:
```bash
docker-compose ps
```

Expected output:
```
NAME              STATUS
nmms-postgres     Up (healthy)
nmms-webapp       Up (healthy)
nmms-scraper      Up
```

App is live at: `http://your-nas-ip:4782`

---

### Step 4 — Set up Cron (Automatic Daily Scraping)

The scraper container already has a built-in cron job that runs at **06:30 IST every day**.

#### Option A — Built-in Docker cron (Recommended, already configured)

The `nmms-scraper` container runs cron automatically. No extra setup needed.

Verify cron is running:
```bash
docker exec nmms-scraper crontab -l
```

View scraper logs:
```bash
docker exec nmms-scraper tail -f /var/log/scraper/scraper.log
```

Or from host:
```bash
docker logs nmms-scraper -f
```

#### Option B — Synology Task Scheduler (Alternative)

If you prefer Synology's built-in scheduler instead of Docker cron:

1. Open **DSM** → **Control Panel** → **Task Scheduler**
2. Click **Create** → **Scheduled Task** → **User-defined script**
3. Fill in:
   - **Task name**: `NMMS Daily Scraper`
   - **User**: `root`
   - **Schedule**: Daily at **06:30**
4. In **Task Settings** → **Run command**, paste:
   ```bash
   docker exec nmms-scraper python3 /app/scraper/scraper.py --api-url http://webapp:3000
   ```
5. Click **OK**

> **Note**: Option A (built-in cron) is preferred. Use Option B only if you want to manage the schedule from DSM UI.

---

### Step 5 — Manual scrape (any date)

```bash
# Today
docker exec nmms-scraper python3 /app/scraper/scraper.py --api-url http://webapp:3000

# Specific date
docker exec nmms-scraper python3 /app/scraper/scraper.py \
  --date 2026-04-28 \
  --api-url http://webapp:3000
```

---

## Useful Commands

```bash
# View all container logs
docker-compose logs -f

# View only scraper logs
docker-compose logs -f scraper

# View scraper cron log
docker exec nmms-scraper tail -100 /var/log/scraper/scraper.log

# Restart everything
docker-compose restart

# Stop everything
docker-compose down

# Stop and delete all data (DESTRUCTIVE)
docker-compose down -v

# Update to latest code
git pull
docker-compose up -d --build
```

---

## How Photos Work

1. Scraper fetches each MR detail page from MGNREGA portal
2. Downloads morning + afternoon photos to `/app/data/photos/` (Docker volume)
3. Stores local path `/api/photos/filename.jpeg` in database (not external URL)
4. Next.js serves photos via `GET /api/photos/[filename]`
5. Photos are cached — re-scraping same date won't re-download existing photos

This avoids hotlinking blocks from the MGNREGA server entirely.

---

## Data Volume (Jharkhand, one day)

| Metric | Value |
|--------|-------|
| Muster Rolls | ~3,468 |
| Panchayats | ~599 |
| Blocks | ~167 |
| Districts | 24 |
| Scrape time | ~90 minutes |
| Photo storage | ~5-10 MB/day |

---

## Docker Volumes

| Volume | Purpose | Location on NAS |
|--------|---------|-----------------|
| `nmms-tracker_pg_data` | PostgreSQL data | Docker managed |
| `nmms-tracker_photos_data` | Downloaded photos | Docker managed |
| `nmms-tracker_scraper_logs` | Cron/scraper logs | Docker managed |

To find volume path on NAS:
```bash
docker volume inspect nmms-tracker_photos_data
```
