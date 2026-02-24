# freqle

Daily guessing game where players infer what real-world dataset a hashmap preview represents.

Example puzzle preview:

```txt
28: 1
30: 4
31: 7
```

Players submit guesses, get scored feedback + hint nudges, and can compare results with friends.

## Tech stack

- Next.js 16 (App Router)
- React 19
- Prisma + PostgreSQL (`@prisma/adapter-pg`)
- NextAuth (Discord)
- Tailwind + shadcn/ui
- OpenRouter for guess judging

## Core features

- Daily puzzles loaded from database by `YYYY-MM-DD`
- Puzzle schema: `key`, `dateKey`, `subject`, `answer`, `data`
- Subject label shown above puzzle preview
- Anonymous play with local storage + sign-in sync
- Account settings (`display hints`, display name, delete account)
- Friend IDs + add friend dialog + friends results in results modal
- Share links with social metadata
- Admin page (`/admin`) with calendar-based create/edit/delete
- Limits:
  - max guess length: `100`
  - max attempts per day: `100`
- If there is no puzzle today, UI shows:
  - `No puzzle today :(`
  - `Check back tomorrow`
  while still rendering login/auth controls

## Requirements

- Node.js 20+
- pnpm 10+
- PostgreSQL 16+ (or Docker Compose)

## Local setup

1. Install dependencies:

```bash
pnpm install
```

2. Start Postgres:

```bash
docker compose up -d postgres
```

3. Create env file:

```bash
cp .env.example .env
```

4. Fill required env vars:

- `NEXTAUTH_URL` (usually `http://localhost:3000`)
- `NEXTAUTH_SECRET`
- `DATABASE_URL`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `OPENROUTER_API_KEY`

Optional:

- `OPENROUTER_MODEL`
- `OPENROUTER_SITE_URL`
- `OPENROUTER_APP_NAME`

5. Generate Prisma client and push schema:

```bash
pnpm db:generate
pnpm db:push
```

6. Start dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Puzzle management

Create/update a day’s puzzle:

```bash
pnpm puzzle:upsert-day -- --date 2026-02-24 --json '{"key":"puzzle-2026-02-24","subject":"economics-us-inflation","answer":"United States monthly inflation rate","data":{"1":3,"2":8}}'
```

You can also pass `--file` JSON input:

```bash
pnpm puzzle:upsert-day -- --date 2026-02-24 --file ./today.json
```

Expected puzzle JSON shape:

```json
{
  "key": "puzzle-2026-02-24",
  "subject": "economics-us-inflation",
  "answer": "United States monthly inflation rate",
  "data": {
    "1": 3,
    "2": 8
  }
}
```

## Admin access

Grant admin to a user:

```bash
pnpm user:set-admin -- --id <player_id>
```

Alternative selectors:

```bash
pnpm user:set-admin -- --external-id <external_user_id>
pnpm user:set-admin -- --friend-id <friend_code>
```

Revoke admin:

```bash
pnpm user:set-admin -- --id <player_id> --unset
```

Admin UI is available at [http://localhost:3000/admin](http://localhost:3000/admin) for admin users.

## Docker (production mode)

Build and run app + Postgres:

```bash
docker compose up --build -d
```

On first run, initialize DB schema:

```bash
docker compose run --rm app pnpm db:push
```

Optional app env overrides use `APP_*` vars:

- `APP_NEXTAUTH_URL`
- `APP_NEXTAUTH_SECRET`
- `APP_DISCORD_CLIENT_ID`
- `APP_DISCORD_CLIENT_SECRET`
- `APP_OPENROUTER_API_KEY`
- `APP_OPENROUTER_MODEL`
- `APP_OPENROUTER_SITE_URL`
- `APP_OPENROUTER_APP_NAME`

## Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm format
pnpm db:generate
pnpm db:push
pnpm puzzle:upsert-day -- --help
pnpm user:set-admin -- --help
```

## Discord OAuth callback URL

Configure this redirect URI in your Discord app:

```txt
http://localhost:3000/api/auth/callback/discord
```

## Notes

- `DATABASE_URL` must be a PostgreSQL connection string (for example `postgresql://...`), not `prisma+postgres://...`.

