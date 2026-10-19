# CatatKod NLP training pipeline (starter)

This is a reproducible training/evaluation scaffold, not a trained or clinically validated model. Because the project currently has ICD-10 descriptions but no labelled notes, the model cannot be trained until `data/labelled_notes.csv` contains reviewed examples.

## Current CatatKod catalogue

The catalogue has been populated with the project's selected list. The two ranges supplied by the project owner were expanded into individual entries, resulting in 49 entries:

- `Z68.30` through `Z68.45`
- `Z91.120` through `Z91.128`

**Before using this catalogue for clinical coding, verify it against the exact authoritative code-set/version used by the intended Malaysian workflow.** Some supplied labels describe a range generally rather than each individual code. This scaffold preserves the supplied scope and wording; format validation is not clinical validation. Do not train or deploy based on an unverified code list.

## 1. Prepare the code catalogue

Create `data/icd10_catalogue.txt`, one code per line, using:

```text
CODE | English description | Malay description
E11 | Type 2 diabetes mellitus | Diabetes mellitus jenis 2
I10 | Essential (primary) hypertension | Hipertensi primer
```

Descriptions may be left blank if you only have the code, but include them if available. Only add codes in the approved first-release subset. Verify the code set and descriptions against the source you are authorised to use. Do not assume that a code is appropriate just because a symptom keyword appears.

Validate/import the catalogue:

```bash
python training/prepare_catalogue.py
```

This creates `data/icd10_catalogue.json` and rejects malformed/duplicate codes. It does not verify clinical correctness against an external coding authority.

## 2. Create labelled examples

Copy `data/labelled_notes_template.csv` to `data/labelled_notes.csv`. One row per note:

- `note_id`: non-identifying unique ID.
- `note_text`: fictional/synthetic or authorised de-identified shorthand note.
- `gold_codes`: one or more approved catalogue codes separated by `;`.
- `split`: `train`, `validation`, or `test`.
- `review_status`: use `reviewed` only after a qualified reviewer has checked the labels.
- `source_type`: `synthetic` or `deidentified_authorized`.

Never include names, identity numbers, phone numbers, addresses, dates of birth, or other direct identifiers. Do not send identifiable notes to an external LLM. Keep close paraphrases or notes derived from the same template in the same split to avoid leakage.

For a first experiment, aim for at least 150–300 reviewed examples across the selected codes. Because the current catalogue contains 49 entries, that total may be too sparse for reliable per-code results; ensure every included code has independently reviewed examples and report codes with insufficient support. This is a prototype target, not a guarantee of accuracy. Try to include multiple independently authored examples per code and hard negatives/negations. A code with too few examples is not ready for reliable classification.

## 3. Install dependencies

From `backend/` in a virtual environment:

```bash
pip install -r requirements.txt
```

The training dependencies are included in `requirements.txt`.

## 4. Train and evaluate

```bash
python training/prepare_catalogue.py
python training/train.py
```

The training script requires reviewed examples and explicit train/validation/test splits. It saves a model under `training/artifacts/` and reports micro/macro precision, recall and F1, exact-match accuracy, plus per-code metrics on the held-out test set. Do not tune on the test set; use validation results to improve the pipeline, then rerun the final test once.

The initial model is a TF-IDF word/character n-gram multi-label classifier. It is a baseline custom NLP model, not a large language model. The existing rules and LLM should be evaluated separately and as a combined system on the same held-out notes before any model is allowed to influence user-facing suggestions.

## 5. Next integration step

Do not automatically use the trained classifier in clinical suggestions yet. First inspect held-out errors and calibrate per-code thresholds. Then add the model as a candidate generator in `backend/app.py`, keeping ICD-10 whitelist validation, negation/context checks, evidence extraction, and clinician confirmation. Predictions must remain suggestions, not diagnoses. Do not deploy a model trained on toy or unreviewed examples as clinically reliable.
