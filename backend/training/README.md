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
export GEMINI_API_KEY=...            # or put it in backend/.env; GEMINI_MODEL defaults to gemini-2.5-flash
export SEALION_API_KEY=...           # optional; SEALION_MODEL defaults to aisingapore/Gemma-SEA-LION-v4-27B-IT
python training/benchmark_llm.py --update-readme   # fills the table below
```

<!-- llm-benchmark:start -->
*Not run yet — no API key was available. Run the command above to fill this table.*
<!-- llm-benchmark:end -->
