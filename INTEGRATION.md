# CatatKod backend integration notes

## What changed

- Added `backend/`, a Flask JSON API with a health endpoint and `/api/analyze`.
- Added a custom preprocessing and rule-based extraction layer, including a narrow ICD-10 catalogue, duration extraction, and several explicit negation patterns.
- Added optional Gemini enrichment. It is disabled unless `GEMINI_API_KEY` is configured. LLM suggestions are constrained to the in-code catalogue and exact evidence from the original note.
- Added a PostgreSQL-compatible SQLAlchemy table for non-identifying analysis operational metrics. Raw note text is not stored in this table.
- Added `src/lib/api.ts`; the existing `NotePage` now calls the API and displays an inline error if the API is unreachable. The existing page design and `AnalysisResult` shape are preserved.
- Added `.env.example`, `backend/.env.example`, `backend/Procfile`, and `render.yaml` deployment scaffolding.

## Local run

Terminal 1:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python app.py
```

Terminal 2, from project root:

```bash
cp .env.example .env.local
# Set VITE_API_BASE_URL=http://localhost:5000 in .env.local
pnpm install
pnpm dev
```

The original project uses `pnpm-lock.yaml`, not `package-lock.json`.

## Deploy

1. Push the project to a Git repository.
2. Create the backend service and PostgreSQL database using `render.yaml` or equivalent settings.
3. Set `FRONTEND_ORIGINS` to the exact deployed frontend origin (no trailing slash). Do not leave only localhost in production.
4. Add `GEMINI_API_KEY` as a backend secret if enabling LLM enrichment.
5. Deploy the frontend separately. Set `VITE_API_BASE_URL` to the deployed backend URL at frontend build time, then rebuild/redeploy.
6. Verify `GET /api/health`, then submit a synthetic note from the CatatKod note page.

## Current scope and important gaps

This milestone connects the note-analysis interaction to the hosted-API pattern and sets up PostgreSQL for non-identifying analysis metrics. **It does not yet move patients, clinical records, drafts, amendments, or login to PostgreSQL**: those are still held in the current browser store/localStorage and the current login remains a prototype. Do not use real patient data or expose the current prototype to real clinical workflows. Before production, add server-side authentication, role-based access control, encrypted transport and backups, privacy review, full database-backed patient/record endpoints, durable amendment audit history, and clinician-reviewed validation against a labelled dataset. The current ICD-10 catalogue and rules are not a comprehensive or clinically validated coding system.

## API contract

`POST /api/analyze`

Request:

```json
{"note":"pt dtg komplen kencing berbuih, kaki bengkak 3 ari, hx kencing manis"}
```

Response keys remain compatible with the frontend:

- `codes`: `id`, `code`, `labelMs`, `labelEn`, `evidence`, `start`, `end`
- `negated`: `text`, `start`, `end`, `meaningMs`
- `duration`: `{ "value": 3, "unit": "hari" }` or `null`
- `expandedNote`: normalized text
