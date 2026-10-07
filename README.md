# Autoboard Business Dashboard

Autoboard turns business files into a responsive, customizable dashboard. It detects useful measures, dates, and business dimensions; generates KPI cards and charts; and can request grounded recommendations from Gemini through a secure backend.

The bundled Superstore dataset remains available as a complete sales analytics demo.

## What it does

- Generates a dashboard from CSV, TSV, XLSX, PDF, or DOCX files.
- Detects business signals such as revenue, profit, customers, orders, quantity, category, region, and dates.
- Builds adaptive KPIs, trend charts, business breakdowns, and a data preview.
- Lets the user change the primary measure, comparison dimension, and date field.
- Shows sales, profitability, customer, forecasting, and Gemini analysis workspaces.
- Processes quick previews in the browser; uploaded files are not sent to Gemini.
- Sends only a bounded calculated summary to the authenticated Gemini endpoint.
- Includes light/dark themes and responsive layouts.

Legacy `.xls` and `.doc` files should be saved as `.xlsx` and `.docx` before upload. Image-only PDFs require OCR, which is not part of the browser preview.

## Technology

Frontend:

- React 18, TypeScript, Vite, and Tailwind CSS
- Recharts for visualization
- Papa Parse for CSV/TSV
- JSZip/XML extraction for XLSX and DOCX
- PDF.js for selectable PDF text
- Poppins typography

Backend:

- FastAPI and SQLAlchemy
- PostgreSQL-oriented Alembic migrations
- Authenticated project, ingestion, profiling, analytics, forecast, and history APIs
- Server-side Gemini integration through `GEMINI_API_KEY`

## Run the frontend

```bash
cd webapp
npm install
npm run dev
```

Build the production bundle:

```bash
npm run build
```

## Run the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Set `GEMINI_API_KEY` in `backend/.env` to enable the **Analyze with Gemini** action. The key remains server-side. Do not place it in a Vite variable or commit it.

The backend also expects `DATABASE_URL`, `SECRET_KEY`, Google OAuth values, and the frontend/backend URLs documented in [`backend/.env.example`](backend/.env.example).

## Verification

Frontend:

```bash
cd webapp
npm run build
npm audit --omit=dev
```

Backend:

```bash
cd backend
.venv/bin/pytest -q
```

## Repository layout

```text
Sales-Data-Dashboard/
├── backend/          FastAPI, ingestion, analytics, Gemini, and tests
├── data/             Raw and processed Superstore data
├── notebooks/        Data exploration and cleaning notebooks
├── webapp/           React dashboard application
└── .github/          GitHub Pages workflow
```

## Deployment note

The static dashboard can be deployed to GitHub Pages. Authenticated ingestion and Gemini features require the FastAPI backend to be hosted separately and `VITE_API_URL` to point to it at build time.

## Author

Haider Imran — [GitHub](https://github.com/haiderimran019)
