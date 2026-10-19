# CatatKod NLP pipeline (ICD-11)

Research prototype. Labels are synthetic and **not clinician-reviewed**; nothing here is clinically validated.

## Architecture

```
note ─► nlp/normalise.py   shorthand expansion (pt, hx, ari, smlm…), reduplication (sikit2),
        │                  negation/uncertainty scope: "takde demam" → neg_demam, "?denggi" → unc_denggi
        ├─► Tier 1 (121 codes, trained)
        │     nlp/rules.py     lexicon phrase matching on normalised text → codes + evidence spans
        │     classifier       word+char TF-IDF → one-vs-rest logistic regression (training/train.py)
        │     final = rule matches ∪ classifier predictions above a strict threshold
        └─► Tier 2 (all ~17k diagnostic ICD-11 codes, untrained)
              nlp/retrieval.py Malay→English glossary + tier-1 titles → TF-IDF search over WHO titles
nlp/pipeline.py  analyze(note) → {codes, negated, duration, expandedNote, catalogueSuggestions}
```

Tier 1 covers common primary-care symptoms, NCDs and acute infections. Tier 2 gives browseable
candidates for anything else (e.g. *panau* → 1F2D.0 Pityriasis versicolor, *bisul* → 1B75.0 Furuncle).
Every output is a suggestion for nurse/clinician confirmation.

## Data files (`training/data/`)

| File | What |
|---|---|
| `icd11_mms_simple_tabulation_en.csv` | Full WHO ICD-11 MMS export (2026-10-12) |
| `tier1_lexicon.txt` | **Edit this to add codes.** `CODE \| kind \| Malay label \| phrase; phrase; …` |
| `starter_labelled.csv` | The 60 starter notes with ICD-11 labels |
| `handwritten_notes.csv` | 135 more independently written notes |
| `generated_notes.csv` | 3,000 template notes from the lexicon (training only) |
| `labelled_notes.csv` | Merged dataset with fixed train/validation/test splits |

**Labelling policy:** code every finding or condition the note states as present; never code negated
(*takde demam*) or suspected (*?denggi*, *r/o TB*) ones. Symptoms are coded even alongside a diagnosis.

## Run

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python training/prepare_catalogue.py      # validate lexicon against WHO catalogue
python training/generate_synthetic.py     # 3,000 template training notes
python training/build_dataset.py          # merge + split
python training/train.py --allow-draft    # train, tune on validation, evaluate on test once
python -m nlp.pipeline "pt dtg c/o kencing berbuih, kaki bengkak 3 ari, hx kencing manis"
```

## Adding codes

1. Look the code up in the WHO CSV (prefer the leaf, often the `.Z` "unspecified" child).
2. Add a line to `tier1_lexicon.txt` with at least 3 colloquial phrases. `prepare_catalogue.py` rejects
   unknown codes and phrases shared between codes.
3. Add a few hand-written notes using it to `handwritten_notes.csv` so it appears in evaluation.
4. Re-run the four commands above.

## Current results (held-out test: 105 hand-written notes, 82 codes present)

| System | micro-P | micro-R | micro-F1 | macro-F1 | exact match |
|---|---|---|---|---|---|
| Naive keyword matching (no negation) | 0.832 | 0.952 | 0.888 | 0.910 | 0.705 |
| CatatKod rules (normalised + negation) | 0.958 | 0.952 | 0.955 | 0.947 | 0.876 |
| CatatKod classifier | 0.907 | 0.940 | 0.923 | 0.950 | 0.752 |
| **CatatKod rules + classifier** | **0.942** | **0.982** | **0.962** | **0.971** | **0.876** |

**Caveat — these numbers are optimistic.** The test notes were written by the same author as the lexicon,
so they share its vocabulary. A credible number needs test notes written by people who have never seen
the lexicon (nursing contacts, teammates), ideally reviewed by a clinician.

## CatatKod vs. a plain-prompted LLM

`training/benchmark_llm.py` asks an LLM for ICD-11 codes on the same held-out notes (no lexicon, no
normaliser) in two variants: any ICD-11 code, and choose only from the 121 tier-1 codes plus each note's
tier-2 catalogue suggestions. It scores with the same `metrics()` as `train.py`. Responses are cached in
`artifacts/llm_cache.json`; results go to `artifacts/llm_benchmark.json`.

```bash
export GEMINI_API_KEY=...            # or put it in backend/.env; GEMINI_MODEL defaults to gemini-3.8-flash
export SEALION_API_KEY=...           # optional; SEALION_MODEL defaults to aisingapore/Gemma-SEA-LION-v4-27B-IT
python training/benchmark_llm.py --update-readme   # fills the table below
# SEA-LION free tier = 10 requests/minute; Gemini free tier = 20 requests/day for gemini-3.8-flash
SEALION_MODEL=aisingapore/Nemotron-SEA-LION-v4.8-120B-A12B python training/benchmark_llm.py --providers sealion --rpm 9 --update-readme
```

**Reading the results (run 2026-10-19, SEA-LION v4.8 120B — the largest SEA-LION model available):**

- Asked for ICD-11 codes from memory, the LLM is almost always wrong (micro-F1 0.032). 54 of its answers are
  not real ICD-11 codes at all, and most of the rest are wrong categories (e.g. `MB23` for frequent urination,
  `MG10` for cough). Scoring leniently at the 4-character stem level (so `MG29` matches `MG29.01`) only raises
  it to 0.090, so this is not a strict-scoring artefact.
- Even when handed the 121-code list plus catalogue suggestions, it reaches 0.725 micro-F1 (0.866 at stem level)
  vs **0.962** for CatatKod; about 30% of its suggestions are wrong (precision 0.698) vs 6% for CatatKod (0.942).
- On one note (HW030, ankle sprain) the model reasoned for 4,000 tokens without answering; it is scored as an
  empty answer. Gemini rows are pending: the free-tier quota ran out after 18 of 210 calls.
- Same caveat as above: the test notes share vocabulary with CatatKod's lexicon, which favours CatatKod.

<!-- llm-benchmark:start -->
### CatatKod vs. a plain-prompted LLM (same 105 held-out notes, 82 codes present)

| System | micro-P | micro-R | micro-F1 | macro-F1 | exact match |
|---|---|---|---|---|---|
| Naive keyword matching (no negation) | 0.832 | 0.952 | 0.888 | 0.910 | 0.705 |
| CatatKod rules | 0.958 | 0.952 | 0.955 | 0.947 | 0.876 |
| CatatKod classifier | 0.907 | 0.940 | 0.923 | 0.950 | 0.752 |
| **CatatKod rules + classifier** | **0.942** | **0.982** | **0.962** | **0.971** | **0.876** |
| Sealion `aisingapore/Nemotron-SEA-LION-v4.8-120B-A12B`, plain prompt (any ICD-11 code) | 0.029 | 0.036 | 0.032 | 0.022 | 0.019 |
| Sealion `aisingapore/Nemotron-SEA-LION-v4.8-120B-A12B`, plain prompt (choose from 121 tier-1 + catalogue suggestions) | 0.698 | 0.753 | 0.725 | 0.686 | 0.533 |

LLM rows: `training/benchmark_llm.py`, temperature 0, no lexicon or normaliser, one call per note; the prompt states the labelling policy above. Codes outside tier 1 count as false positives. Out-of-tier-1 / not-a-real-ICD-11-code answers: sealion:open: 191 / 54; sealion:tier1: 34 / 0.
<!-- llm-benchmark:end -->
