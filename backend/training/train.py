"""Train and evaluate the CatatKod tier-1 ICD-11 multi-label classifier.

Pipeline: normalise() (shorthand expansion + negation scope) -> word + character TF-IDF
-> one-vs-rest logistic regression -> one decision threshold tuned on the validation split.

The held-out test split contains only independently written notes (never template-generated),
and is compared against two baselines on the same notes:
  * naive keyword matching (substring lookup, no negation handling)
  * CatatKod rules (lexicon matching on normalised, negation-aware text)
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from sklearn.multiclass import OneVsRestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import MultiLabelBinarizer

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent))
from nlp.catalogue import load_lexicon  # noqa: E402
from nlp.features import build_features  # noqa: E402
from nlp.normalise import normalise  # noqa: E402
from nlp.policy import apply as apply_policy  # noqa: E402
from nlp.rules import LexiconMatcher, naive_keyword_codes  # noqa: E402

DATA = ROOT / "data" / "labelled_notes.csv"
CATALOGUE = ROOT / "data" / "icd11_tier1_catalogue.json"
ARTIFACTS = ROOT / "artifacts"
REQUIRED_COLUMNS = {"note_id", "note_text", "gold_codes", "split", "review_status", "source_type"}
VALID_SPLITS = {"train", "validation", "test"}
C_GRID = [2.0, 8.0, 32.0]
THRESHOLDS = np.round(np.arange(0.15, 0.96, 0.05), 2)


def parse_codes(value: str) -> list[str]:
    return sorted({c.strip() for c in str(value).split(";") if c.strip()})


def policy_matrix(y, classes):
    """Apply the integral-symptom coding policy (nlp/policy.py) to a binary label matrix."""
    out = np.zeros_like(y)
    index = {c: j for j, c in enumerate(classes)}
    for i, row in enumerate(y):
        for code in apply_policy(classes[j] for j in np.flatnonzero(row)):
            out[i, index[code]] = 1
    return out


def metrics(y_true, y_pred, classes) -> dict:
    present = y_true.sum(axis=0) > 0  # macro-F1 only over codes that occur in this split
    return {
        "micro_precision": precision_score(y_true, y_pred, average="micro", zero_division=0),
        "micro_recall": recall_score(y_true, y_pred, average="micro", zero_division=0),
        "micro_f1": f1_score(y_true, y_pred, average="micro", zero_division=0),
        "macro_f1_present_codes": f1_score(y_true[:, present], y_pred[:, present], average="macro", zero_division=0),
        "exact_match": accuracy_score(y_true, y_pred),
        "codes_in_split": int(present.sum()),
    }


def build_model(c: float) -> Pipeline:
    return Pipeline([
        ("features", build_features()),
        ("clf", OneVsRestClassifier(LogisticRegression(C=c, solver="liblinear", class_weight="balanced", max_iter=2000))),
    ])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--allow-draft", action="store_true",
                        help="train on labels not yet clinician-reviewed (prototype only; results are not clinical evidence)")
    args = parser.parse_args()

    for path, hint in [(CATALOGUE, "python training/prepare_catalogue.py"), (DATA, "python training/build_dataset.py")]:
        if not path.exists():
            raise SystemExit(f"Missing {path.name}. Run: {hint}")
    catalogue = json.loads(CATALOGUE.read_text(encoding="utf-8"))
    allowed = sorted(row["code"] for row in catalogue)
    df = pd.read_csv(DATA, dtype=str, keep_default_na=False)

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise SystemExit(f"Missing CSV columns: {', '.join(sorted(missing))}")
    if df["note_id"].duplicated().any():
        raise SystemExit("note_id values must be unique.")
    if set(df["split"]) != VALID_SPLITS:
        raise SystemExit("Provide all three explicit splits: train, validation, test.")
    if not (df["review_status"] == "reviewed").all() and not args.allow_draft:
        raise SystemExit("Some labels are not review_status=reviewed. Re-run with --allow-draft for a prototype model.")

    df["labels"] = df["gold_codes"].map(lambda v: sorted(apply_policy(parse_codes(v))))
    unknown = {c for labels in df["labels"] for c in labels} - set(allowed)
    if unknown:
        raise SystemExit(f"Labels not in the tier-1 catalogue: {', '.join(sorted(unknown))}")
    df["normalised"] = df["note_text"].map(normalise)

    mlb = MultiLabelBinarizer(classes=allowed)
    parts = {s: df[df["split"] == s] for s in VALID_SPLITS}
    y = {s: mlb.fit_transform(parts[s]["labels"]) for s in VALID_SPLITS}

    train_support = y["train"].sum(axis=0)
    sparse = [code for code, n in zip(allowed, train_support) if n < 2]
    if sparse:
        raise SystemExit(f"Codes with <2 training positives: {', '.join(sparse)}")

    # Model selection on validation only: regularisation strength and one global threshold.
    best = None
    for c in C_GRID:
        model = build_model(c).fit(parts["train"]["normalised"], y["train"])
        proba = model.predict_proba(parts["validation"]["normalised"])
        for t in THRESHOLDS:
            f1 = f1_score(y["validation"], policy_matrix((proba >= t).astype(int), allowed), average="micro", zero_division=0)
            if best is None or f1 > best[0]:
                best = (f1, c, float(t), model)
        print(f"C={c:<5} best validation micro-F1 so far {best[0]:.3f} (C={best[1]}, threshold={best[2]})")
    _, best_c, threshold, model = best

    # Hybrid = rule matches plus ML predictions above a second (stricter) threshold, also tuned on validation.
    entries = load_lexicon()
    matcher = LexiconMatcher(entries)
    val_rules = mlb.transform([sorted(matcher.codes(t)) for t in parts["validation"]["note_text"]])
    val_proba = model.predict_proba(parts["validation"]["normalised"])
    hybrid_threshold = max(
        (float(t) for t in np.round(np.arange(0.5, 1.0, 0.025), 3)),
        key=lambda t: f1_score(y["validation"], policy_matrix(np.maximum(val_rules, (val_proba >= t).astype(int)), allowed),
                               average="micro", zero_division=0),
    )
    print(f"hybrid ML threshold (validation): {hybrid_threshold}")

    # Evaluate once on the held-out test split.
    test = parts["test"]
    test_proba = model.predict_proba(test["normalised"])
    ml_pred = policy_matrix((test_proba >= threshold).astype(int), allowed)
    naive_pred = policy_matrix(mlb.transform([sorted(naive_keyword_codes(t, entries)) for t in test["note_text"]]), allowed)
    rules_raw = mlb.transform([sorted(matcher.codes(t)) for t in test["note_text"]])
    rules_pred = policy_matrix(rules_raw, allowed)
    hybrid_pred = policy_matrix(np.maximum(rules_raw, (test_proba >= hybrid_threshold).astype(int)), allowed)

    results = {
        "naive_keyword_baseline": metrics(y["test"], naive_pred, allowed),
        "catatkod_rules": metrics(y["test"], rules_pred, allowed),
        "catatkod_ml": metrics(y["test"], ml_pred, allowed),
        "catatkod_ml_plus_rules": metrics(y["test"], hybrid_pred, allowed),
    }
    print(f"\n== Held-out test: {len(test)} independently written notes, {results['catatkod_ml']['codes_in_split']} codes present ==")
    print(f"{'system':<26}{'microP':>8}{'microR':>8}{'microF1':>9}{'macroF1':>9}{'exact':>8}")
    for name, m in results.items():
        print(f"{name:<26}{m['micro_precision']:>8.3f}{m['micro_recall']:>8.3f}{m['micro_f1']:>9.3f}{m['macro_f1_present_codes']:>9.3f}{m['exact_match']:>8.3f}")

    # Error listing for review (ML+rules system).
    errors = []
    for i, (_, row) in enumerate(test.iterrows()):
        gold, pred = set(row["labels"]), {allowed[j] for j in np.flatnonzero(hybrid_pred[i])}
        if gold != pred:
            errors.append({"note_id": row["note_id"], "note_text": row["note_text"], "gold": ";".join(sorted(gold)),
                           "missed": ";".join(sorted(gold - pred)), "extra": ";".join(sorted(pred - gold))})

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "classes": allowed, "threshold": threshold, "hybrid_threshold": hybrid_threshold}, ARTIFACTS / "icd11_tier1_classifier.joblib")
    pd.DataFrame(errors).to_csv(ARTIFACTS / "test_errors.csv", index=False)
    metadata = {
        "model_type": "normalise() + word/char TF-IDF + OneVsRest LogisticRegression",
        "C": best_c, "threshold": threshold, "hybrid_threshold": hybrid_threshold, "n_codes": len(allowed),
        "rows": {s: len(parts[s]) for s in VALID_SPLITS},
        "test_results": results,
        "labels_reviewed": bool((df["review_status"] == "reviewed").all()),
        "warning": "Research prototype trained on synthetic, unreviewed labels. Not clinically validated.",
    }
    (ARTIFACTS / "metadata.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(f"\nSaved model + metadata to {ARTIFACTS.relative_to(ROOT.parent)}/ ({len(errors)} test notes with errors -> test_errors.csv)")


if __name__ == "__main__":
    main()
