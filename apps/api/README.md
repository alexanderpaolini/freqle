# @freqle/api

Python 3 API service scaffold for the freqle monorepo.

Python requirement: 3.10-3.12.

## Local setup

From repo root:

```bash
cp .env.example .env
pnpm api:setup
pnpm api:dev
```

The API runs on [http://localhost:8000](http://localhost:8000).

## Useful commands

```bash
pnpm api:lint
pnpm api:test
```

## Endpoints

- `GET /health`: basic service health.
- `POST /cosine_similarity`: cosine similarity for `text1` and `text2`.

Example:

```bash
curl -X POST http://localhost:8000/cosine_similarity \
  -H "content-type: application/json" \
  -d '{"text1":"apple is a fruit","text2":"banana is a fruit"}'
```

Notes:

- The API validates text length (max `2000` characters).
- Similarity is returned as raw float (no API-side rounding).
