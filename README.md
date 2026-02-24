# freqle

Daily Wordle-style hashmap guessing game built with Next.js.

You are shown a hashmap preview:

```txt
28: 1
30: 4
31: 7
```

You must guess what real-world dataset that map represents.

Puzzles are stored in PostgreSQL and assigned to specific `YYYY-MM-DD` date keys.

## Features

- Next.js App Router app scaffolded via `create-next-app`
- shadcn/ui component system (Radix + Tailwind) for app interface primitives
- Optional Discord authentication using `next-auth`
- Daily puzzle flow with unlimited tries or give-up, plus localStorage cache
- Login-after-play sync (anonymous local attempts can be saved to DB later)
- Account settings popup for username updates and full account/data deletion
- OpenRouter-based closeness scoring for incorrect guesses
- Custom 9-char share links on home route (example: `/?share=465r7tyig`) with social metadata and automatic friend-linking
- Share support for both solved and gave-up results
- Componentized home UI (`components/*`) for maintainable feature iteration
- Results center modal with avg/median + tries distribution chart and one-click `Share`

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Start PostgreSQL:

```bash
docker compose up -d
```

3. Create your env file:

```bash
cp .env.example .env.local
```

4. Fill required values in `.env.local`:

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

5. Push Prisma schema to your local DB:

```bash
pnpm db:push
```

6. Assign a puzzle to today (required before gameplay):

```bash
pnpm puzzle:upsert-day -- --date "$(date +%F)" --preset month-day-counts
```

7. Run locally:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Formatting

```bash
npm run format
# or
pnpm format
```

## Database Scripts

```bash
pnpm db:generate
pnpm db:push
pnpm puzzle:upsert-day -- --help
```

## Discord OAuth callback URL

In your Discord OAuth app, configure redirect URI:

```txt
http://localhost:3000/api/auth/callback/discord
```
