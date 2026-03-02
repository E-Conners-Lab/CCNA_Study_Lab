# CCNA StudyLab -- Deployment Guide

> **Last updated:** 2026-03-01
> **Version:** 1.0.0

Production deployment guide for the CCNA StudyLab project. Covers environment configuration, build process, Docker deployment, reverse proxy setup, SSL, backups, and security.

---

## Table of Contents

1. [Production Environment Variables](#production-environment-variables)
2. [Building for Production](#building-for-production)
3. [Database Setup](#database-setup)
4. [Docker Deployment](#docker-deployment)
5. [Reverse Proxy Setup](#reverse-proxy-setup)
6. [SSL and HTTPS](#ssl-and-https)
7. [Database Backups](#database-backups)
8. [Health Check Endpoints](#health-check-endpoints)
9. [Security Checklist](#security-checklist)

---

## Production Environment Variables

All variables must be set before starting the application in production.

| Variable | Required | Example Value | Description |
|----------|----------|---------------|-------------|
| `DATABASE_URL` | Yes | `postgresql://studylab:STRONG_PASSWORD@db-host:5432/ccna_studylab` | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | *(generated)* | JWT signing key. Generate with `openssl rand -base64 32` |
| `AUTH_URL` | Yes | `https://study.example.com` | Full public URL. Auth.js uses this for callback URLs and cookie settings |
| `TUTOR_ANTHROPIC_KEY` | No | `sk-ant-api03-...` | Anthropic API key for the AI Tutor feature |
| `LAB_ENGINE_URL` | No | `http://lab-engine:8100` | Internal URL of the lab engine service |
| `POSTGRES_PASSWORD` | Yes | *(strong password)* | PostgreSQL password (used by Docker Compose) |

### Generating AUTH_SECRET

```bash
openssl rand -base64 32
```

Use a unique value per environment. Never reuse the development secret in production.

### AUTH_URL

Set `AUTH_URL` to the full public URL of the application (including `https://`). Auth.js uses this to:

- Construct callback URLs for the credentials provider.
- Determine whether to use `__Secure-` prefixed cookies (HTTPS only).
- Generate correct redirect URIs.

```
AUTH_URL=https://study.example.com
```

---

## Building for Production

### Standard Build

```bash
cd apps/web
npm ci
npm run build
npm run start
```

The `next build` command creates an optimized production build in `.next/`. The `next start` command serves the application on port 3000 by default.

### Custom Port

```bash
PORT=8080 npm run start
```

### Required Environment at Build Time

The build process needs access to environment variables that affect code generation:

```bash
DATABASE_URL="" AUTH_SECRET="build-secret" npm run build
```

Setting `DATABASE_URL=""` allows the build to complete without a live database connection (the lazy connection pattern in `lib/db/index.ts` defers the connection to runtime).

---

## Database Setup

### Production PostgreSQL

1. Provision a PostgreSQL 16+ instance (managed service recommended for production).

2. Create the database and user:
   ```sql
   CREATE USER studylab WITH PASSWORD 'STRONG_PASSWORD';
   CREATE DATABASE ccna_studylab OWNER studylab;
   ```

3. Set the connection string:
   ```
   DATABASE_URL=postgresql://studylab:STRONG_PASSWORD@db-host:5432/ccna_studylab
   ```

4. Run migrations and seed:
   ```bash
   cd apps/web
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

### Connection Pool Settings

The application configures the connection pool in `lib/db/index.ts`:

| Setting | Value | Description |
|---------|-------|-------------|
| `max` | 10 | Maximum concurrent connections |
| `idle_timeout` | 20 | Seconds before idle connections are closed |
| `connect_timeout` | 10 | Seconds to wait for a new connection |

For production with higher traffic, consider increasing `max` or using an external connection pooler (PgBouncer).

### Migrations in CI/CD

The CI pipeline demonstrates the migration workflow:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

Run these as part of your deployment pipeline after the database is available but before the application starts.

---

## Docker Deployment

### Using Docker Compose

The provided `docker/docker-compose.yml` runs PostgreSQL and the lab engine:

```bash
# Set the PostgreSQL password
export POSTGRES_PASSWORD=STRONG_PASSWORD

# Start all services
docker compose -f docker/docker-compose.yml up -d
```

### Full Production Stack

For a complete deployment, add the web application to Docker Compose. Create a `docker/docker-compose.prod.yml`:

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ccna_studylab
      POSTGRES_USER: studylab
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U studylab"]
      interval: 10s
      timeout: 5s
      retries: 5

  lab-engine:
    build:
      context: ../services/lab-engine
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://studylab:${POSTGRES_PASSWORD}@postgres:5432/ccna_studylab
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8100/health"]
      interval: 15s
      timeout: 5s
      retries: 3

  web:
    build:
      context: ..
      dockerfile: apps/web/Dockerfile
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://studylab:${POSTGRES_PASSWORD}@postgres:5432/ccna_studylab
      AUTH_SECRET: ${AUTH_SECRET}
      AUTH_URL: ${AUTH_URL}
      LAB_ENGINE_URL: http://lab-engine:8100
      TUTOR_ANTHROPIC_KEY: ${TUTOR_ANTHROPIC_KEY:-}
    depends_on:
      postgres:
        condition: service_healthy
      lab-engine:
        condition: service_healthy

volumes:
  pgdata:
```

**Note:** The internal Docker network allows the web service to reach the lab engine at `http://lab-engine:8100` without exposing port 8100 to the host. Remove the `ports` mapping from the lab-engine service in production.

### Building Custom Images

```bash
# Build the lab engine
docker build -t ccna-studylab-labs:latest services/lab-engine/

# Build the web app (requires a Dockerfile in apps/web/)
docker build -t ccna-studylab-web:latest -f apps/web/Dockerfile .
```

---

## Reverse Proxy Setup

### Nginx Example

Place the web application behind a reverse proxy for SSL termination and static asset caching:

```nginx
server {
    listen 443 ssl http2;
    server_name study.example.com;

    ssl_certificate     /etc/ssl/certs/study.example.com.pem;
    ssl_certificate_key /etc/ssl/private/study.example.com.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name study.example.com;
    return 301 https://$host$request_uri;
}
```

### Key Configuration

- Set `AUTH_URL=https://study.example.com` so Auth.js generates correct callback URLs.
- If the lab engine is accessed via the proxy (not internally), update the CORS origins in `services/lab-engine/main.py`.
- The `X-Forwarded-Proto` header tells Next.js that the original request was HTTPS, which is required for secure cookies.

---

## SSL and HTTPS

### Secure Cookie Behavior

Auth.js v5 automatically uses `__Secure-` prefixed cookies when the application is served over HTTPS. This is determined by the `AUTH_URL` variable:

| `AUTH_URL` Scheme | Cookie Name | Requires HTTPS |
|-------------------|-------------|----------------|
| `http://` | `authjs.session-token` | No |
| `https://` | `__Secure-authjs.session-token` | Yes |

The middleware in `src/middleware.ts` checks for both cookie names, so the transition between HTTP (development) and HTTPS (production) is automatic.

### Certificate Setup

For production, use a certificate from a trusted CA. [Let's Encrypt](https://letsencrypt.org/) with Certbot is a common choice:

```bash
sudo certbot --nginx -d study.example.com
```

For internal or staging deployments, use a self-signed certificate. Note that `__Secure-` cookies require a certificate trusted by the browser.

---

## Database Backups

### Manual Backup

```bash
# Dump the database
docker exec ccna-studylab-db pg_dump -U studylab ccna_studylab > backup_$(date +%Y%m%d).sql

# Compressed backup
docker exec ccna-studylab-db pg_dump -U studylab -Fc ccna_studylab > backup_$(date +%Y%m%d).dump
```

### Automated Backups

Create a cron job for daily backups:

```bash
# /etc/cron.d/ccna-studylab-backup
0 2 * * * root docker exec ccna-studylab-db pg_dump -U studylab -Fc ccna_studylab > /backups/ccna_studylab_$(date +\%Y\%m\%d).dump 2>&1
```

### Restore

```bash
# From SQL dump
docker exec -i ccna-studylab-db psql -U studylab -d ccna_studylab < backup_20260301.sql

# From compressed dump
docker exec -i ccna-studylab-db pg_restore -U studylab -d ccna_studylab --clean < backup_20260301.dump
```

### Data Sensitivity

The database contains:

| Table | Sensitivity |
|-------|-------------|
| `users` | **High** -- email addresses and bcrypt password hashes |
| `flashcard_progress`, `exam_attempts` | Medium -- user study progress |
| `tutor_conversations`, `tutor_messages` | Medium -- AI chat history |
| `domains`, `objectives`, `flashcards`, `labs`, `practice_questions` | Low -- content (can be re-seeded) |

Encrypt backups at rest and restrict access to backup files.

---

## Health Check Endpoints

### Lab Engine

```bash
curl http://localhost:8100/health
```

Response:
```json
{
  "status": "healthy",
  "service": "lab-engine",
  "version": "1.0.0",
  "lab_types": ["ios-cli", "subnetting", "config-review", "python", "acl-builder"]
}
```

The Docker Compose health check runs this endpoint every 15 seconds with a 5-second timeout and 3 retries.

### PostgreSQL

The Docker Compose health check uses `pg_isready`:

```bash
docker exec ccna-studylab-db pg_isready -U studylab
```

Runs every 10 seconds with a 5-second timeout and 5 retries.

### Web Application

Next.js does not include a built-in health endpoint. For production monitoring, add a custom route at `app/api/health/route.ts` or check the application's root URL:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

A `200` or `308` (redirect to `/dashboard`) indicates the application is running.

---

## Security Checklist

### Environment Variables

- [ ] `AUTH_SECRET` is a unique, randomly generated value (at least 32 bytes).
- [ ] `AUTH_SECRET` is different from the development value.
- [ ] `POSTGRES_PASSWORD` is a strong, unique password (not the default `studylab_dev_2024`).
- [ ] `TUTOR_ANTHROPIC_KEY` is not committed to version control.
- [ ] `SKIP_AUTH` is **not** set in production (it disables authentication entirely).
- [ ] Environment variables are stored in a secrets manager, not in plain text files.

### API Keys

- [ ] The Anthropic API key (`TUTOR_ANTHROPIC_KEY`) has appropriate rate limits and spending caps configured in the Anthropic console.
- [ ] No API keys are exposed in client-side code or browser network requests.

### CORS

- [ ] The lab engine CORS origins in `services/lab-engine/main.py` list only the production domain.
- [ ] Remove `http://localhost:3000` from CORS origins in production.

### Network

- [ ] The lab engine port (8100) is **not** exposed to the public internet. Use internal Docker networking.
- [ ] The PostgreSQL port (5432/5433) is **not** exposed to the public internet.
- [ ] Only port 443 (HTTPS) and optionally port 80 (HTTP redirect) are publicly accessible.

### Authentication

- [ ] The default seed user (`student@ccna.lab` / `ccna123`) password has been changed or the account has been removed.
- [ ] HTTPS is enabled so that `__Secure-` cookies are used.
- [ ] JWT sessions have appropriate expiration (Auth.js defaults apply).

### Code Execution

- [ ] The lab engine's Python grader uses subprocess isolation with timeouts.
- [ ] User-submitted code runs in a sandboxed environment, not as root.
- [ ] The lab engine container has no access to sensitive host resources.

### Rate Limiting

- [ ] Consider adding rate limiting to API routes, especially:
  - `/api/chat` (AI Tutor -- each request costs API credits)
  - `/api/labs/[slug]/run` (code execution)
  - `/api/auth` (login attempts)

---

## See Also

- [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) -- All environment variables and their defaults
- [ARCHITECTURE.md](./ARCHITECTURE.md) -- System architecture and design decisions
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) -- Common issues and solutions
- [DEVELOPMENT.md](./DEVELOPMENT.md) -- Developer workflow reference
