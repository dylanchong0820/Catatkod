# CatatKod backend (ICD-11)

Flask REST API for the CatatKod React UI. `/api/analyze` runs the ICD-11 MMS pipeline in `nlp/` (normaliser, 121-code tier-1 lexicon rules + trained classifier, TF-IDF search over the full WHO catalogue; see `training/README.md`) and keeps the `AnalysisResult` contract in `src/lib/analyze.ts`. Every code is a suggestion for a nurse to confirm, never a final code.

## Local setup

```bash
cd backend
python -m venv .venv
# macOS/Linux
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python training/train.py --allow-draft   # first time only: builds training/artifacts/icd11_tier1_classifier.joblib
python app.py                            # http://localhost:5001
```

The classifier file is gitignored, so a fresh clone has no model until you run `train.py`. Without it the API still works using lexicon rules + catalogue search only (`/api/health` reports `"modelLoaded": false`, and `modelScore` is `null`). Port 5001 is the default because macOS AirPlay Receiver occupies 5000; set `PORT` to change it and point the frontend at it with `VITE_API_BASE_URL`.

Set `DATABASE_URL` to a PostgreSQL connection string for persistent operational metrics. If it is absent, local development uses SQLite. The API stores only a SHA-256 note fingerprint, input length, number of candidates, provider name and latency; it does not persist raw note text.

For optional Gemini enrichment, set `GEMINI_API_KEY`. Without it, custom normalisation and deterministic candidate extraction still work. Gemini may only choose from the 121 tier-1 codes plus that note's `catalogueSuggestions`, must cite an exact substring of the original note that is not inside a negated phrase, and cannot add a parent/child of a code already suggested. It may add candidates (`source: "gemini"`) but cannot remove pipeline candidates. A clinician must review all suggestions.

## API

- `GET /api/health`
- `POST /api/analyze` with `{"note":"pt dtg komplen kencing berbuih, kaki bengkak 3 ari, hx kencing manis"}` → codes MF96.Z, MG29.01, 5A11. Response keys:
  - `codes[]`: `id, code, labelMs, labelEn, evidence, start, end, source, modelScore`. `source` is `rules`, `model`, `rules+model` or `gemini`; `start`/`end` are `-1` when a model-only code has no evidence span.
  - `negated[]`, `duration`, `expandedNote` (unchanged)
  - `catalogueSuggestions[]`: `code, labelEn, score, tier1` from the full catalogue, not auto-selected
  - `codeSystem`: `"ICD-11 MMS"`
- `GET /api/icd11/search?q=panau&limit=10` → `{"query", "codeSystem", "results": [{code, labelEn, labelMs, score, tier1}]}`. Malay or English queries over all ~17k diagnostic ICD-11 codes, for the nurse's manual search.

## Deployment

Deploy the `backend/` directory as a Python web service (e.g. Render). Build command: `pip install -r requirements.txt`. Start command: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 90`. Add `DATABASE_URL`, `FRONTEND_ORIGINS`, and optionally `GEMINI_API_KEY` as provider environment variables. Do not commit secrets. Update the frontend's `VITE_API_BASE_URL` to the deployed API URL and rebuild the frontend.

## Important limitations

This is a hackathon prototype, not a validated medical device or official KKM system. Training labels are synthetic and not clinician-reviewed, and the ICD-11 version approved for Malaysian use must be confirmed before deployment. Do not use real patient information. Authentication, role-based authorization, database-backed patient/record CRUD, and durable record-amendment workflows are not part of this first integration milestone and must be implemented before handling real clinical records.
