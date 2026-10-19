# CatatKod backend (integration milestone 1)

Flask REST API for the existing React/TypeScript CatatKod UI. The `/api/analyze` response preserves the `AnalysisResult` contract expected by `src/lib/analyze.ts`.

## Local setup

```bash
cd backend
python -m venv .venv
# macOS/Linux
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python app.py
```

Set `DATABASE_URL` to a PostgreSQL connection string for persistent operational metrics. If it is absent, local development uses SQLite. The API stores only a SHA-256 note fingerprint, input length, number of candidates, provider name and latency; it does not persist raw note text.

For optional Gemini enrichment, set `GEMINI_API_KEY`. Without it, custom normalisation and deterministic candidate extraction still work. LLM suggestions are restricted to the small in-code ICD-10 catalogue and must cite an exact substring from the original note. The LLM may add candidates but cannot remove rule candidates. A clinician must review all suggestions.

## API

- `GET /api/health`
- `POST /api/analyze` with `{"note":"pt dtg komplen kencing berbuih, kaki bengkak 3 ari, hx kencing manis"}`

## Deployment

Deploy the `backend/` directory as a Python web service (e.g. Render). Build command: `pip install -r requirements.txt`. Start command: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 90`. Add `DATABASE_URL`, `FRONTEND_ORIGINS`, and optionally `GEMINI_API_KEY` as provider environment variables. Do not commit secrets. Update the frontend's `VITE_API_BASE_URL` to the deployed API URL and rebuild the frontend.

## Important limitations

This is a hackathon prototype, not a validated medical device or official KKM system. The in-code catalogue is intentionally narrow and is not a substitute for a verified ICD-10 source. Do not use real patient information. Authentication, role-based authorization, database-backed patient/record CRUD, and durable record-amendment workflows are not part of this first integration milestone and must be implemented before handling real clinical records.
