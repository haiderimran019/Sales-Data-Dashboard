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

Ingestion endpoints require the authenticated session: `GET /api/ingestion/supported-types`, `POST /api/projects/{project_id}/versions/{version_id}/files`, `GET /api/projects/{project_id}/versions/{version_id}/files`, `GET /api/files/{file_id}`, and `GET /api/files/{file_id}/extraction`. Upload processing is synchronous in this development phase and returns bounded extraction metadata rather than full datasets.

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

The Alembic migrations are reversible and extend the platform foundation with auth/history and generic file extraction metadata. They do not connect to a production database or run automatically.

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

Included: a health endpoint, Google OpenID Connect login, signed HttpOnly sessions, protected organization-scoped project/history APIs, protected multi-file ingestion for CSV/XLSX/PDF/DOCX/PPTX/images, bounded normalized previews, environment-based configuration, SQLAlchemy models, PostgreSQL-oriented Alembic migrations, and organization-scoped ownership columns and indexes.

Ingestion and deterministic profiling are synchronous in development and use `LocalStorage` behind a replaceable storage boundary. Tabular profiles use the bounded extraction preview; responses identify `profile_scope` so estimated statistics are not presented as exact. The quality score is transparent: `100 - min(45, missing_percentage*0.45) - min(25, duplicate_percentage*0.25) - min(10, outlier_percentage*0.10) - min(20, invalid_percentage*0.20)`. OCR, object storage, background workers, semantic AI interpretation, forecasting, CSV engine migration, dashboard migration, and invitations are not included. The current frontend continues to run independently when this backend is stopped.

Analytics is also synchronous in this phase. `POST /api/projects/{project_id}/versions/{version_id}/analyze` creates a reproducible, version-scoped plan and persists bounded result artifacts. Results expose their calculation inputs, warnings, and `exact` or `estimated` scope. Supported deterministic artifacts include descriptive metrics, grouped aggregations, time series with period-over-period change, rolling averages, distributions, Pearson correlation, potential IQR anomalies, and descriptive group comparisons. No causal claims or AI interpretations are generated.

The AI analyst is provider-agnostic at the application boundary and currently has one Gemini adapter selected by `AI_PROVIDER=gemini`. `GEMINI_API_KEY` is server-only and is sent to the provider through a request header; it is never exposed to the frontend. `POST /api/projects/{project_id}/versions/{version_id}/ai-insights` builds bounded context from profiles and analytical artifacts, validates structured output, rejects unsupported predictions, and persists classified insight items. The context excludes raw tabular rows, limits document excerpts and artifact counts, records truncation, and preserves exact/estimated scope. AI output is interpretation and recommendation only; deterministic analytics remain the source of numerical truth.

Forecasting is deterministic and synchronous in this phase. `POST /api/projects/{project_id}/versions/{version_id}/forecasts` creates a bounded forecast artifact using seasonal-naive when sufficient history exists, otherwise a linear trend. It aggregates duplicate periods, detects daily/weekly/monthly frequency, returns confidence bounds and a simple holdout MAE, and reports unavailable prerequisites explicitly. Forecast artifacts are included in the bounded AI context and are the only basis for `PREDICTION` labels.
