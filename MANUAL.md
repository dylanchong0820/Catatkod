# CatatKod — Instruction Manual

How to set up, run, demo, improve and evaluate CatatKod. Every command is run from a terminal on macOS.
Commands assume you start in the project folder:

```bash
cd ~/Downloads/codefest_26/catatkod
```

> Prototype only: synthetic data, not clinically validated. Never put real patient information into it.

---

## 1. What's in the project

```
catatkod/
├── MANUAL.md                 ← this file
├── src/                      ← web app (React). The note page is src/app/pages/NotePage.tsx
├── backend/
│   ├── app.py                ← API server the web app talks to
│   ├── .env                  ← your API keys (you create this; never committed)
│   ├── nlp/                  ← the NLP engine
│   │   ├── normalise.py      ← shorthand expansion + negation ("takde demam")
│   │   ├── rules.py          ← matches lexicon phrases in a note
│   │   ├── retrieval.py      ← searches all ~17,000 ICD-11 codes
│   │   ├── policy.py         ← which symptoms a diagnosis covers (not coded twice)
│   │   └── pipeline.py       ← analyze(note): puts it all together
│   └── training/
│       ├── data/tier1_lexicon.txt        ← ★ the Malay phrase list (edit this most)
│       ├── data/handwritten_notes.csv    ← hand-labelled notes
│       ├── data/independent_notes.csv    ← notes written by SEA-LION (60 dev / 100 test)
│       ├── data/icd11_mms_simple_tabulation_en.csv  ← full WHO ICD-11 catalogue
│       ├── prepare_catalogue.py, generate_synthetic.py, build_dataset.py, train.py
│       ├── evaluate_independent.py, generate_independent_notes.py, benchmark_llm.py
│       ├── artifacts/        ← trained model + results (JSON)
│       └── README.md         ← technical details and full results tables
└── assets/                   ← images used in README.md
```

**How a note is coded:** note → `normalise` (expand shorthand, mark negations) → **Tier 1**: lexicon rules +
trained model over 121 common codes → **Tier 2**: search across the full ICD-11 catalogue for anything else →
nurse confirms.

---

## 2. One-time setup

You need **Python 3** and **Node.js** (both already on this Mac).

**Backend (Python):**

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd ..
```

**Frontend (web app):**

```bash
npx -y pnpm@10.34.3 install
```

**Train the model once** (the model file isn't stored in git, so a fresh copy has none). Takes ~1 minute:

```bash
cd backend
.venv/bin/python training/prepare_catalogue.py
.venv/bin/python training/generate_synthetic.py
.venv/bin/python training/build_dataset.py
.venv/bin/python training/train.py --allow-draft
cd ..
```

**API keys (optional)** — only needed for the LLM benchmark and for generating new test notes. The app itself
works without any key. Create the file `backend/.env` (the name must be exactly `.env`, not `backend.env`):

```
GEMINI_API_KEY=your-gemini-key
SEALION_API_KEY=your-sealion-key
```

`backend/.env.example` lists every setting. `.env` is gitignored, so keys never get committed.

---

## 3. Run the app

**Easiest (Mac): double-click `Start CatatKod.command`** in the project folder in Finder. It opens a Terminal
window, sets up anything missing the first time (Python packages, web packages, the trained model), starts the
API and the web app, and opens CatatKod in your browser. Keep that window open while you use the app; close it
or press Ctrl + C to stop. If macOS says it can't be opened (only for copies downloaded as a zip), right-click
it → **Open** → **Open** once.

**Manually**, in two terminal windows:

Use **two terminal windows**.

**Terminal 1 — API** (port 5001):

```bash
cd ~/Downloads/codefest_26/catatkod/backend
.venv/bin/python app.py
```

**Terminal 2 — web app** (port 8443):

```bash
cd ~/Downloads/codefest_26/catatkod
npx -y pnpm@10.34.3 dev
```

Open **http://localhost:8443** in a browser.

Check the API is up: open http://localhost:5001/api/health. You should see `"status":"ok"` and
`"modelLoaded":true`. If `modelLoaded` is `false`, run the training step in section 2.

Stop either server with **Ctrl + C**. After you change the lexicon or retrain, **restart the API** so it loads
the new version (the web app reloads by itself).

---

## 4. Demo walkthrough

1. **Log in:** any staff ID and password work (e.g. `KKM10248` / `demo`). It's a prototype login. You stay
   signed in if the page reloads; tick *Kekalkan sesi* to stay signed in after closing the browser too.
2. On **Utama**, search a patient (e.g. *Ahmad*), open them, click **Lawatan baharu**.
3. Type a note in the empty box and click **Cari kod** (or Ctrl + Enter). Good demo note:
   `pt dtg komplen kencing berbuih, kaki bengkak 3 ari, hx kencing manis. takde demam`
4. Point out:
   - each code's **evidence** (highlighted words) → MF96.Z, MG29.01, 5A11
   - **Tidak dikodkan**: *takde demam* is a denial, so fever is not coded
   - **Kod lain yang mungkin**: full-catalogue suggestions. Try adding *bisul kat punggung* → Furuncle
   - the **Cari kod ICD-11** search box for any code by keyword
   - **Diliputi oleh diagnosis**: try `imp tonsilitis, sakit tekak, demam`: sore throat is covered by
     tonsillitis, so it isn't coded twice
5. Untick a code if wrong, then **Sahkan** to confirm. The nurse is always in control.

Before the pitch: rehearse, record a backup video, and start both servers before going on stage.

---

### Where patients and records are saved

Patients, visit records, drafts and amendments are saved to the API's database: an SQLite file at
`backend/instance/catatkod_dev.db` on the computer running the API. The page footer shows the status:

- *Rekod disimpan dalam pangkalan data*: saved to the database.
- *Pangkalan data tidak dapat dihubungi…*: the API isn't running; changes are kept in this browser and sent to
  the database automatically when it's back.

The first time the app connects to an empty database, it fills it with the demo patients. To start over with the
demo data, stop the API, delete `backend/instance/catatkod_dev.db`, and clear the site's data in your browser. To
use a hosted PostgreSQL instead, set `DATABASE_URL` in `backend/.env`. Look inside with
`sqlite3 backend/instance/catatkod_dev.db "select id, status, record_date from clinical_record;"`.

The analysis step (`/api/analyze`) still stores no note text, only a fingerprint and timing. There is no real
login or access control yet, so only synthetic data belongs in this database.

## 5. Use the NLP without the web app

**From the terminal** (prints the full JSON result):

```bash
cd backend
.venv/bin/python -m nlp.pipeline "batuk 3 hari, takde demam, hx darah tinggi"
```

**Through the API** (while the API is running):

```bash
curl -s -X POST http://localhost:5001/api/analyze -H "Content-Type: application/json" -d '{"note":"batuk 3 hari, takde demam"}'
```

```bash
curl -s "http://localhost:5001/api/icd11/search?q=panau"
```

`/api/analyze` returns: `codes` (each with `code`, `labelMs`, `labelEn`, `evidence`, `source` = rules / model /
rules+model, `modelScore`), `negated`, `duration`, `expandedNote`, `catalogueSuggestions`.

---

## 6. Improve accuracy: add phrases and codes

The lexicon `backend/training/data/tier1_lexicon.txt` is where most improvements happen. One line per code:

```
CODE    | kind | Malay label   | phrase; phrase; phrase
MF96.Z  | S    | Kencing berbuih | kencing berbuih; air kencing berbuih; kencing buih; proteinuria
```

- **kind:** `S` symptom, `H` chronic condition / history, `D` acute diagnosis / doctor's impression
- **phrases:** written the way notes really look: Malay, English and Manglish, shorthand, common typos, plurals
  and past tenses (*vomit; vomited; vomiting*). Lowercase.
- Don't add a phrase that is a negation itself unless the meaning needs it (e.g. *tak lalu makan*).

**Add a phrase:** append it to the right line with `; `.

**Add a new code:**
1. Find it in the WHO list: open `backend/training/data/icd11_mms_simple_tabulation_en.csv` (Excel works) and
   search the English title, or browse https://icd.who.int/browse/latest-release/mms/en. Prefer the most
   specific code; for vague notes use the "unspecified" one ending in `.Z`.
2. Add a line with at least 3 phrases.
3. Write 2–3 example notes using it in `handwritten_notes.csv` (columns: `note_id,note_text,gold_codes,source`;
   codes separated by `;`; source `handwritten`). Use a new ID like `HW136`.

**Then rebuild and retrain** (always these four, in this order):

```bash
cd backend
.venv/bin/python training/prepare_catalogue.py      # checks every code exists + no phrase clashes
.venv/bin/python training/generate_synthetic.py     # new training notes from the lexicon
.venv/bin/python training/build_dataset.py
.venv/bin/python training/train.py --allow-draft    # trains + prints test scores
```

`prepare_catalogue.py` stops with an error if a code doesn't exist in ICD-11 or a phrase is used by two codes.
Fix the line it names and rerun. Then **restart the API**.

**Labelling rule** (use it for every note you label): code everything the note says is *present*; never code
what's *denied* (*takde demam*) or only *suspected* (*?denggi*, *r/o TB*).

**Coding policy for symptoms that belong to a diagnosis** (`backend/nlp/policy.py`): when a note has a confirmed
diagnosis, symptoms that are a normal part of it are not coded separately (scabies covers itching and rash;
UTI covers painful urination; tonsillitis covers sore throat; vertigo replaces dizziness). The app shows these
under **Diliputi oleh diagnosis**. The rule is applied automatically to labels and predictions, so you can still
label every finding you see. To change it, edit the `INTEGRAL` table: one line per diagnosis, listing the
symptom codes it covers. It's a draft and should be checked by a clinician or certified coder.

---

## 7. Check accuracy

| Command | What it tells you |
|---|---|
| `.venv/bin/python training/train.py --allow-draft` | Retrains, then scores on 105 held-out hand-written notes (optimistic: same author as the lexicon) |
| `.venv/bin/python training/evaluate_independent.py` | Scores the current model on the 100 SEA-LION-written test notes (**the honest number**) |
| `.venv/bin/python training/evaluate_independent.py --errors` | Also lists mistakes on the 60 **dev** notes, to find missing phrases |
| `.venv/bin/python training/evaluate_independent.py --data english` | Same, on the 60 English-only test notes |

Run them from `backend/`. Results are saved in `backend/training/artifacts/` (`metadata.json`,
`independent_eval.json`, `test_errors.csv`).

**Golden rule:** look at **dev** mistakes to decide what to fix; never read the **test** notes, or the test
score stops being honest.

**What the scores mean:**
- **Precision**: of the codes it suggested, how many were right (low = nurse deletes wrong codes)
- **Recall**: of the codes it should find, how many it found (low = nurse adds missed codes)
- **F1**: both combined, 0–1, higher is better
- **Exact match**: % of notes where every code was exactly right

Current: **0.96** F1 on our test set, **0.82** on independent Malay/Manglish notes and **0.85** on independent
English-only notes (keyword matching: 0.62 / 0.64). Mixed Malay-English notes work the same way.

---

## 8. Compare against an LLM (needs keys)

```bash
cd backend
SEALION_MODEL=aisingapore/Nemotron-SEA-LION-v4.8-120B-A12B .venv/bin/python training/benchmark_llm.py --providers sealion --rpm 9 --update-readme
```

```bash
.venv/bin/python training/benchmark_llm.py --providers gemini --update-readme
```

- **Rate limits:** SEA-LION free tier = 10 requests/minute (always use `--rpm 9`); Gemini free tier = 20
  requests/day, while the benchmark needs 210, so Gemini needs billing enabled or several days.
- Answers are **cached** in `artifacts/llm_cache.json`; rerunning only makes the missing calls, so it's safe
  to stop and restart. If it says "rerun to resume", just run the same command again.
- `--update-readme` writes the results table into `backend/training/README.md`.

## 9. Make more independent test notes (needs SEA-LION key)

```bash
cd backend
.venv/bin/python training/generate_independent_notes.py --rpm 9
```

Writes `training/data/independent_notes.csv` (160 notes, ~18 minutes). Add `--style english` for English-only
notes (`independent_notes_english.csv`, 100 notes). Changing `--seed` or the `MODEL` /
`PROMPT` inside the script gives a different batch, e.g. Llama-SEA-LION 70B, or patient-voice / dialect notes.
Keep the laptop awake while it runs.

## 10. Add AI-written training notes (needs SEA-LION key)

More varied training notes from a different AI writer (Llama-SEA-LION 70B, so the Gemma-written test notes
stay independent):

```bash
cd backend
.venv/bin/python training/generate_independent_notes.py --style english --train-notes 100 --seed 311 --model aisingapore/Llama-SEA-LION-v3-70B-IT --rpm 9
.venv/bin/python training/verify_notes.py --data data/llm_training_notes_english_llama.csv --rpm 9
```

`verify_notes.py` asks Gemma-SEA-LION whether each note actually contains the findings it was supposed to;
notes with a missing finding are skipped automatically by `build_dataset.py` (their labels would be wrong).
Use a new `--seed` for each new batch and `--style malay` for Malay notes. Then rebuild and retrain (section 6).

## 11. Troubleshooting

| Problem | Fix |
|---|---|
| `Address already in use` / `Port 5001 is in use` | An old API is still running. Find it: `lsof -iTCP:5001 -sTCP:LISTEN`, then `kill <PID>`. (macOS AirPlay uses port 5000, which is why we use 5001.) |
| Web app says the API is unreachable | Start the API (section 3); check http://localhost:5001/api/health |
| Footer says the database is unreachable | Start the API (section 3). Changes made meanwhile are kept in the browser and sent automatically once it's back |
| Logged out unexpectedly | The prototype login lasts for the browser tab; tick *Kekalkan sesi* when logging in to keep it longer |
| `"modelLoaded": false` | Run the training commands in section 2, then restart the API |
| `No LLM API key found` | Create `backend/.env` — exact name `.env`, inside `backend/` (section 2) |
| Gemini `HTTP 429 … quota` | Free daily quota used up; wait ~24 h or enable billing |
| Gemini `HTTP 404 … no longer available` | Set `GEMINI_MODEL=` to a current model in `backend/.env` |
| A script seems stuck | Usually rate-limit waiting. Ctrl + C and rerun: cached answers are kept |
| `prepare_catalogue.py` error | The message names the code/phrase; fix that line in the lexicon |
| Changes don't show in the app | Restart the API after editing the lexicon, policy or retraining |

---

## 12. Limits to be honest about

- All data is synthetic; nothing is clinically validated. Codes are suggestions for a nurse to confirm.
- 0.96 is optimistic (same author wrote lexicon and test notes); 0.82 to 0.85 on independent notes is the fairer figure.
- Biggest weakness: wording it has never seen. The cure is more varied notes from more writers.
- Before real use: clinician-reviewed labels, real de-identified notes, PDPA review, proper login and audit trail.
