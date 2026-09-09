# Analytics Platform Backend

This directory contains the initial FastAPI platform foundation. The existing React CSV dashboard remains the active user-facing application and is not connected to this API yet.

## Startup

From `backend/`:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

The API health check is available at `http://127.0.0.1:8000/health`.

## Environment

Configuration is loaded from environment variables and an optional local `.env` file. See `.env.example` for the supported names:

- `DATABASE_URL`: PostgreSQL connection URL.
- `SECRET_KEY`: application session signing secret.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: Google OpenID Connect client credentials.
- `COOKIE_SECURE`: set to `true` when serving over HTTPS in production.
- `AI_API_KEY`: reserved for a future provider adapter; unused in this phase.
- `STORAGE_*`: reserved for future object storage; unused in this phase.

Never commit `.env`, credentials, API keys, or private certificates.

## Database and migrations

The initial migration is reversible and creates only the platform foundation tables. It does not connect to a production database or run automatically.

```bash
alembic upgrade head
alembic downgrade base
```

Set `DATABASE_URL` before running either command. Do not run migrations against production until the connection has been explicitly verified.

## Tests

```bash
pytest
python3 -m py_compile app/main.py app/core/config.py app/models/platform.py
```

## Current scope

Included: a health endpoint, Google OpenID Connect login, signed HttpOnly sessions, protected organization-scoped project/history APIs, environment-based configuration, SQLAlchemy models, PostgreSQL-oriented Alembic migrations, and organization-scoped ownership columns and indexes.

Not included: invitations, uploads, object storage, file extraction, CSV engine migration, workers, AI, OCR, dashboard migration, or UI redesign. The current frontend continues to run independently when this backend is stopped.
