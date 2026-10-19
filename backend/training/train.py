"""Train and evaluate a baseline multi-label TF-IDF ICD-10 classifier."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import classification_report, f1_score, precision_score, recall_score, accuracy_score
from sklearn.multiclass import OneVsRestClassifier
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.preprocessing import MultiLabelBinarizer
from sklearn.svm import LinearSVC

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "labelled_notes.csv"
CATALOGUE = ROOT / "data" / "icd10_catalogue.json"
ARTIFACTS = ROOT / "artifacts"
REQUIRED_COLUMNS = {"note_id", "note_text", "gold_codes", "split", "review_status", "source_type"}
VALID_SPLITS = {"train", "validation", "test"}


def parse_codes(value: str) -> list[str]:
    if not isinstance(value, str) or not value.strip():
        raise ValueError("gold_codes must contain one or more codes separated by ';'")
    return sorted({item.strip().upper() for item in value.split(";") if item.strip()})


def main() -> None:
    if not CATALOGUE.exists():
        print("Run: python training/prepare_catalogue.py", file=sys.stderr)
        raise SystemExit(2)
    if not DATA.exists():
        print(f"Create {DATA} from labelled_notes_template.csv and add reviewed examples.", file=sys.stderr)
        raise SystemExit(2)

    catalogue = json.loads(CATALOGUE.read_text(encoding="utf-8"))
    allowed_codes = {row["code"] for row in catalogue}
    df = pd.read_csv(DATA, dtype=str, keep_default_na=False)
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise SystemExit(f"Missing CSV columns: {', '.join(sorted(missing))}")
    if df.empty:
        raise SystemExit("Dataset is empty.")
    if df["note_id"].duplicated().any():
        raise SystemExit("note_id values must be unique.")
    if (df["note_text"].str.strip() == "").any():
        raise SystemExit("note_text cannot be empty.")
    if not set(df["split"]).issubset(VALID_SPLITS):
        raise SystemExit("split must be train, validation, or test.")
    if set(df["split"]) != VALID_SPLITS:
        raise SystemExit("Provide all three explicit splits: train, validation, test.")
    if not (df["review_status"] == "reviewed").all():
        raise SystemExit("Every example must have review_status=reviewed before training.")
    if not set(df["source_type"]).issubset({"synthetic", "deidentified_authorized"}):
        raise SystemExit("source_type must be synthetic or deidentified_authorized.")

    df["labels"] = df["gold_codes"].map(parse_codes)
    used_codes = {code for labels in df["labels"] for code in labels}
    unknown = used_codes - allowed_codes
    if unknown:
        raise SystemExit(f"Labels not in the approved catalogue: {', '.join(sorted(unknown))}")

    train_df = df[df["split"] == "train"]
    val_df = df[df["split"] == "validation"]
    test_df = df[df["split"] == "test"]
    if len(train_df) < 20:
        raise SystemExit("Need more reviewed training rows before fitting even a baseline (minimum 20).")
    if val_df.empty or test_df.empty:
        raise SystemExit("Validation and test splits must each contain at least one row.")

    # Every target code needs positive and negative training examples; otherwise its
    # classifier cannot learn a meaningful distinction.
    train_labels = [set(labels) for labels in train_df["labels"]]
    sparse_codes = []
    for code in sorted(allowed_codes):
        positives = sum(code in labels for labels in train_labels)
        negatives = len(train_labels) - positives
        if positives < 2 or negatives < 2:
            sparse_codes.append(f"{code} (positive={positives}, negative={negatives})")
    if sparse_codes:
        raise SystemExit("Insufficient train examples per code; need at least 2 positive and 2 negative notes per code: " + ", ".join(sparse_codes))

    mlb = MultiLabelBinarizer(classes=sorted(allowed_codes))
    y_train = mlb.fit_transform(train_df["labels"])
    y_val = mlb.transform(val_df["labels"])
    y_test = mlb.transform(test_df["labels"])

    features = FeatureUnion([
        ("word", TfidfVectorizer(analyzer="word", ngram_range=(1, 2), lowercase=True, strip_accents=None, min_df=1, sublinear_tf=True)),
        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), lowercase=True, min_df=1, sublinear_tf=True)),
    ])
    model = Pipeline([
        ("features", features),
        ("classifier", OneVsRestClassifier(LinearSVC(class_weight="balanced"))),
    ])
    model.fit(train_df["note_text"], y_train)

    def report(name: str, x: pd.Series, y_true) -> None:
        pred = model.predict(x)
        print(f"\n== {name} ({len(x)} notes) ==")
        print(f"micro precision: {precision_score(y_true, pred, average='micro', zero_division=0):.3f}")
        print(f"micro recall:    {recall_score(y_true, pred, average='micro', zero_division=0):.3f}")
        print(f"micro F1:        {f1_score(y_true, pred, average='micro', zero_division=0):.3f}")
        print(f"macro F1:        {f1_score(y_true, pred, average='macro', zero_division=0):.3f}")
        print(f"exact match:     {accuracy_score(y_true, pred):.3f}")
        print(classification_report(y_true, pred, target_names=mlb.classes_, zero_division=0))

    report("validation", val_df["note_text"], y_val)
    report("test (held out)", test_df["note_text"], y_test)

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    model_path = ARTIFACTS / "icd10_tfidf_classifier.joblib"
    joblib.dump({"model": model, "classes": list(mlb.classes_), "catalogue": catalogue}, model_path)
    metadata = {
        "model_type": "word+character TF-IDF + OneVsRest LinearSVC",
        "training_rows": len(train_df),
        "validation_rows": len(val_df),
        "test_rows": len(test_df),
        "catalogue_codes": sorted(allowed_codes),
        "warning": "Research prototype. Review test errors and validate clinically before use. LinearSVC scores are not calibrated probabilities.",
    }
    (ARTIFACTS / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nSaved model: {model_path}")
    print("Do not interpret model scores as calibrated probabilities or clinical certainty.")


if __name__ == "__main__":
    main()
