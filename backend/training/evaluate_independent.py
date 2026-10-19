"""Score CatatKod on the independent SEA-LION-written notes (data/independent_notes.csv).

Uses the already-trained model (no retraining on these notes) and the same metrics() as train.py.
Reports dev and test separately; only the test number should be quoted. --errors prints dev mistakes
so lexicon gaps can be fixed without ever looking at the test notes.

  python training/evaluate_independent.py            # scores, writes artifacts/independent_eval.json
  python training/evaluate_independent.py --errors   # also list dev-split mistakes
  python training/evaluate_independent.py --data english   # English-only independent notes
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import MultiLabelBinarizer

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT.parent))
from nlp.catalogue import load_lexicon  # noqa: E402
from nlp.normalise import normalise  # noqa: E402
from nlp.rules import LexiconMatcher, naive_keyword_codes  # noqa: E402
from train import ARTIFACTS, CATALOGUE, metrics, parse_codes  # noqa: E402

DATA = ROOT / "data" / "independent_notes.csv"
OUT = ARTIFACTS / "independent_eval.json"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--errors", action="store_true", help="print dev-split mistakes (never test)")
    parser.add_argument("--label", default="current", help="name for this run in independent_eval.json")
    parser.add_argument("--data", default="malay", help="'malay', 'english', or a path to a CSV with the same columns")
    args = parser.parse_args()
    data = {"malay": DATA, "english": ROOT / "data" / "independent_notes_english.csv"}.get(args.data, Path(args.data))

    allowed = sorted(row["code"] for row in json.loads(CATALOGUE.read_text(encoding="utf-8")))
    bundle = joblib.load(ARTIFACTS / "icd11_tier1_classifier.joblib")
    entries = load_lexicon()
    matcher = LexiconMatcher(entries)
    mlb = MultiLabelBinarizer(classes=allowed)
    df = pd.read_csv(data, dtype=str, keep_default_na=False)

    report = {}
    print(f"{'split':<6}{'system':<26}{'microP':>8}{'microR':>8}{'microF1':>9}{'macroF1':>9}{'exact':>8}")
    for split in ["dev", "test"]:
        part = df[df["split"] == split]
        gold = mlb.fit_transform(part["gold_codes"].map(parse_codes))
        proba = bundle["model"].predict_proba(part["note_text"].map(normalise))
        rules = mlb.transform([sorted(matcher.codes(t)) for t in part["note_text"]])
        systems = {
            "naive_keyword_baseline": mlb.transform([sorted(naive_keyword_codes(t, entries)) for t in part["note_text"]]),
            "catatkod_rules": rules,
            "catatkod_ml": (proba >= bundle["threshold"]).astype(int),
            "catatkod_ml_plus_rules": np.maximum(rules, (proba >= bundle["hybrid_threshold"]).astype(int)),
        }
        report[split] = {name: metrics(gold, pred, allowed) for name, pred in systems.items()}
        report[split]["n_notes"] = len(part)
        for name, m in report[split].items():
            if name == "n_notes":
                continue
            print(f"{split:<6}{name:<26}{m['micro_precision']:>8.3f}{m['micro_recall']:>8.3f}{m['micro_f1']:>9.3f}"
                  f"{m['macro_f1_present_codes']:>9.3f}{m['exact_match']:>8.3f}")

        if args.errors and split == "dev":
            hybrid = systems["catatkod_ml_plus_rules"]
            print("\n-- dev mistakes (rules + model) --")
            for i, (_, row) in enumerate(part.iterrows()):
                g = set(parse_codes(row["gold_codes"]))
                p = {allowed[j] for j in np.flatnonzero(hybrid[i])}
                if g != p:
                    print(f"{row['note_id']}: {row['note_text']}\n   missed={sorted(g - p)} extra={sorted(p - g)} "
                          f"denied={row['negated_codes'] or '-'}")
            print()

    history = json.loads(OUT.read_text()) if OUT.exists() else {}
    history[f"{args.label}" if args.data == "malay" else f"{args.label}:{Path(data).stem}"] = report
    OUT.write_text(json.dumps(history, indent=2) + "\n", encoding="utf-8")
    print(f"\nSaved run '{args.label}' -> {OUT.name}")


if __name__ == "__main__":
    main()
