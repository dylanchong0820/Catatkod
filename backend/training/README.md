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
| `independent_notes.csv` | 160 Malay/Manglish notes written by SEA-LION from English condition names only (60 dev, 100 test) |
| `independent_notes_english.csv` | 100 English-only notes written the same way (40 dev, 60 test) |
| `llm_training_notes_*_llama.csv` | 180 training notes by Llama-SEA-LION-70B (kept only if `verify_notes.py` finds nothing missing) |
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
| Naive keyword matching (no negation) | 0.828 | 0.912 | 0.868 | 0.891 | 0.752 |
| CatatKod rules (normalised + negation) | 0.963 | 0.949 | 0.956 | 0.946 | 0.914 |
| CatatKod classifier | 0.880 | 0.854 | 0.867 | 0.868 | 0.714 |
| **CatatKod rules + classifier** | **0.944** | **0.978** | **0.961** | **0.960** | **0.895** |

All scores in this file use the coding policy in `nlp/policy.py` (symptoms covered by a coded diagnosis are
not coded separately), applied identically to gold labels and to every system's predictions.

**Caveat — these numbers are optimistic.** The test notes were written by the same author as the lexicon,
so they share its vocabulary. A credible number needs test notes written by people who have never seen
the lexicon (nursing contacts, teammates), ideally reviewed by a clinician.

## Independent evaluation (notes CatatKod's author did not write)

The test set above shares vocabulary with the lexicon, because the same person wrote both. To measure that
bias, `training/generate_independent_notes.py` had **Gemma-SEA-LION-v4-27B** write 160 nurse-style notes. It
was given only the English WHO titles of the findings to include (and one finding to deny), never the
Malay lexicon. The notes were split once into **60 dev** notes (inspected to find gaps) and **100 test**
notes (never inspected; only their aggregate score was read). Score with `python training/evaluate_independent.py`.

| System (100 independent test notes) | micro-P | micro-R | micro-F1 | macro-F1 | exact match |
|---|---|---|---|---|---|
| Naive keyword matching | 0.595 | 0.615 | 0.604 | 0.552 | 0.220 |
| CatatKod before fixes | 0.770 | 0.654 | 0.707 | 0.642 | 0.430 |
| CatatKod after dev-driven fixes | 0.809 | 0.709 | 0.756 | 0.707 | 0.490 |
| CatatKod with dev notes added to training | 0.812 | 0.726 | 0.767 | 0.727 | 0.520 |
| CatatKod + confusable-pair training notes | 0.814 | 0.732 | 0.771 | 0.730 | 0.540 |
| CatatKod bilingual (+ English variants and English dev notes) | 0.809 | 0.782 | 0.795 | 0.769 | 0.550 |
| **CatatKod final (+ coding policy, + Llama training notes)** | **0.858** | **0.777** | **0.815** | **0.781** | **0.590** |

Fixes made from the dev notes: post-negation (*"kencing manis xde"*), trailing-plus positives (*"COVID+"*),
general shorthand (*mkn, ckp, doc, dr, sdh, bg*), 83 new lexicon phrases across 31 codes (584 -> 667) (*constip, bentol2,
DM1, hypoT, batu kencing, infeksi usus, x tahan kencing, missed period, ASOM, TB hx…*), and new
doctor-impression styles in the synthetic generator (*"dr ckp …", "doc cnfrm", "(old case)"*), and
"confusable pair" training notes that combine codes sharing a word (*batuk* + *darah tinggi* is not *batuk berdarah*).

**How to read this:** ~0.77 is the more honest estimate of real-world accuracy today, and recall (0.73) is the
weak side: about a quarter of findings written in unfamiliar wording are still missed. Caveats: the notes are
LLM-written, not real clinic notes, and SEA-LION sometimes added a finding it was not asked for (e.g. *demam*),
which counts against CatatKod. Our labelling policy also codes symptoms alongside diagnoses (e.g. red eye
with conjunctivitis), while these notes are labelled only with what was requested. Both effects lower the score.


### English-only notes

A second independent set: 100 English-only notes from Gemma-SEA-LION (`--style english`; 40 dev, 60 test).
Before this, the lexicon was Malay-first; 486 English variants (everyday wording, WHO terms, plurals and past
tenses, e.g. *tired, runny nose, vomited, foamy urine, cannot sleep*) were added across all 121 codes, plus
English shorthand and negation in the normaliser (*h/o, freq, wt, D&V, denied, without, absent, ruled out,
negative for, no h/o*) and slash/hyphen splitting (*heavy/irregular*, *flu-like*).

| System (60 English test notes) | micro-P | micro-R | micro-F1 | macro-F1 | exact match |
|---|---|---|---|---|---|
| Naive keyword matching | 0.475 | 0.882 | 0.618 | 0.735 | 0.150 |
| CatatKod before English work | 0.714 | 0.682 | 0.698 | 0.656 | 0.233 |
| CatatKod bilingual | 0.690 | 0.891 | 0.778 | 0.846 | 0.367 |
| **CatatKod final (+ coding policy, + Llama training notes)** | **0.803** | **0.891** | **0.845** | **0.873** | **0.583** |

Mixed Malay-English notes need nothing special: every phrase is matched independently, and the Malay set above
is already Manglish. Caveat: the English notes are noisier than the Malay ones. SEA-LION often added findings it
was not asked for (*SOB, wheezing*) and wrote some requested diagnoses as uncertain (*?Pneumonia*), which our
policy does not code; both count against CatatKod, mostly as lower precision. One intermediate version scored
0.800 on this set; with 60 notes a ±0.02 difference is noise, so the final version is reported.


### Round 3: coding policy, LLM training notes, and two things that didn't work

| Change | English test F1 | Malay test F1 | Kept? |
|---|---|---|---|
| Before this round (bilingual) | 0.778 | 0.795 | |
| **Coding policy** (`nlp/policy.py`): a coded diagnosis covers its usual symptoms (scabies → itching/rash, UTI → dysuria, vertigo → not also dizziness), as in standard ICD coding practice | 0.835 | 0.815 | yes |
| **+164 Llama-SEA-LION-70B training notes** (written by a different model than the Gemma test notes; 16 dropped by the completeness check) | **0.845** | **0.815** | yes |
| Multilingual sentence embeddings (multilingual-e5-small) added to the classifier, compared on the independent dev notes | no change (dev 0.847 → 0.847) | | no: adds ~500 MB and PyTorch for nothing |
| LLM "verifier" to relabel/filter the test sets | 2 of 60 English notes judged clean | | no: it flagged requested findings as extra and any "?" as uncertain; only its "missing finding" check is used (for training notes) |

The coding policy is a draft clinical mapping and needs review by a clinician or certified coder. The API
returns the suppressed symptoms as `coveredSymptoms`, and the note page shows them under *Diliputi oleh diagnosis*.

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

- Asked for ICD-11 codes from memory, the LLM is almost always wrong (micro-F1 0.035). 54 of its answers are
  not real ICD-11 codes at all, and most of the rest are wrong categories (e.g. `MB23` for frequent urination,
  `MG10` for cough). Scoring leniently at the 4-character stem level (so `MG29` matches `MG29.01`) only raises
  it to 0.090, so this is not a strict-scoring artefact.
- Even when handed the 121-code list plus catalogue suggestions, it reaches 0.649 micro-F1 vs **0.961** for
  CatatKod; about 40% of its suggestions are wrong (precision 0.594) vs 6% for CatatKod (0.944). (Before the coding
  policy these were 0.725 vs 0.950; its wrong diagnoses now also suppress symptoms it had right.)
- On one note (HW030, ankle sprain) the model reasoned for 4,000 tokens without answering; it is scored as an
  empty answer. Gemini rows are pending: the free-tier quota ran out after 18 of 210 calls.
- Same caveat as above: the test notes share vocabulary with CatatKod's lexicon, which favours CatatKod.

<!-- llm-benchmark:start -->
### CatatKod vs. a plain-prompted LLM (same 105 held-out notes, 79 codes present)

| System | micro-P | micro-R | micro-F1 | macro-F1 | exact match |
|---|---|---|---|---|---|
| Naive keyword matching (no negation) | 0.828 | 0.912 | 0.868 | 0.891 | 0.752 |
| CatatKod rules | 0.963 | 0.949 | 0.956 | 0.946 | 0.914 |
| CatatKod classifier | 0.880 | 0.854 | 0.867 | 0.868 | 0.714 |
| **CatatKod rules + classifier** | **0.944** | **0.978** | **0.961** | **0.960** | **0.895** |
| Sealion `aisingapore/Nemotron-SEA-LION-v4.8-120B-A12B`, plain prompt (any ICD-11 code) | 0.029 | 0.044 | 0.035 | 0.025 | 0.019 |
| Sealion `aisingapore/Nemotron-SEA-LION-v4.8-120B-A12B`, plain prompt (choose from 121 tier-1 + catalogue suggestions) | 0.594 | 0.715 | 0.649 | 0.652 | 0.543 |

LLM rows: `training/benchmark_llm.py`, temperature 0, no lexicon or normaliser, one call per note; the prompt states the labelling policy above. Codes outside tier 1 count as false positives. Out-of-tier-1 / not-a-real-ICD-11-code answers: sealion:open: 191 / 54; sealion:tier1: 34 / 0.
<!-- llm-benchmark:end -->
