# freqle

Daily guessing game where players infer what real-world dataset a hashmap preview represents.

Example puzzle preview:

```txt
28: 1
30: 4
31: 7
```

## Monorepo layout

- `apps/web`: Next.js app (existing game UI + web routes)
- `apps/api`: Python 3 FastAPI service scaffold
- Root `package.json` scripts namespace by app (`web:*`, `api:*`)

## Requirements

- Node.js 20+
- pnpm 10+
- Python 3.10-3.12 (for `apps/api`)
- PostgreSQL 16+ (or Docker Compose)

## Local setup

1. Install JS dependencies:

```bash
pnpm install
```

2. Create root env file (used by both web and api scripts):

```bash
cp .env.example .env
```

3. Start Postgres:

```bash
docker compose up -d postgres
```

4. Generate Prisma client and push schema for web:

```bash
pnpm web:db:generate
pnpm web:db:push
```

5. Start the web app:

```bash
pnpm web:dev
```

6. Initialize Python API virtualenv and start it:

```bash
pnpm api:setup
pnpm api:dev
```

Local URLs:

- Web: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:8000](http://localhost:8000)
- API health: [http://localhost:8000/health](http://localhost:8000/health)

## Web app scripts

```bash
pnpm web:dev
pnpm web:build
pnpm web:start
pnpm web:lint
pnpm web:format
pnpm web:db:generate
pnpm web:db:push
pnpm web:puzzle:upsert-day -- --help
pnpm web:user:set-admin -- --help
```

Back-compat aliases remain available:

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm format
pnpm db:generate
pnpm db:push
pnpm puzzle:upsert-day -- --help
pnpm user:set-admin -- --help
```

## Python API scripts

```bash
pnpm api:setup
pnpm api:dev
pnpm api:lint
pnpm api:test
```

## Docker (web + api + postgres)

Build and run all services:

```bash
docker compose up --build -d
```

On first run, initialize DB schema:

```bash
docker compose run --rm web pnpm web:db:push
```

Compose reads `.env` directly.

Docker passes env from root `.env` via `env_file` for all services.
No env key/value mappings are defined in `docker-compose.yml`.

For Docker, set these in `.env`:
- `DATABASE_URL=postgresql://freqle:freqle@postgres:5432/freqle?schema=public`
- `COSINE_API_BASE_URL=http://api:8000`

The API container persists model/cache files in a Docker volume (`freqle-api-cache`) to avoid repeated cold downloads across restarts.

## Discord OAuth callback URL

Configure this redirect URI in your Discord app:

```txt
http://localhost:3000/api/auth/callback/discord
```

## Notes

- `DATABASE_URL` must be a PostgreSQL connection string (for example `postgresql://...`), not `prisma+postgres://...`.
