"""Model-selection experiment: does adding multilingual sentence embeddings help?

Trains on the train split WITHOUT the independent dev notes, tunes thresholds on validation, and compares
on the independent dev notes (Malay + English), so the independent TEST notes stay untouched.

  python training/experiment_embeddings.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score
from sklearn.multiclass import OneVsRestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import MultiLabelBinarizer

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT.parent))
from nlp.catalogue import load_lexicon  # noqa: E402
from nlp.features import build_features, build_features_with_embeddings  # noqa: E402
from nlp.normalise import normalise  # noqa: E402
from nlp.policy import apply as apply_policy  # noqa: E402
from nlp.rules import LexiconMatcher  # noqa: E402
from train import CATALOGUE, DATA, metrics, parse_codes, policy_matrix  # noqa: E402
import json  # noqa: E402

allowed = sorted(r["code"] for r in json.loads(CATALOGUE.read_text()))
mlb = MultiLabelBinarizer(classes=allowed)
df = pd.read_csv(DATA, dtype=str, keep_default_na=False)
df["norm"] = df["note_text"].map(normalise)
df["labels"] = df["gold_codes"].map(lambda v: sorted(apply_policy(parse_codes(v))))
train = df[(df["split"] == "train") & (df["origin"] != "independent_dev")]
val = df[df["split"] == "validation"]
dev = pd.concat([pd.read_csv(ROOT / "data" / f, dtype=str, keep_default_na=False) for f in
                 ["independent_notes.csv", "independent_notes_english.csv"]])
dev = dev[dev["split"] == "dev"].copy()
dev["norm"] = dev["note_text"].map(normalise)
dev_gold = mlb.fit_transform(dev["gold_codes"].map(lambda v: sorted(apply_policy(parse_codes(v)))))
matcher = LexiconMatcher(load_lexicon())
rules_val = mlb.transform([sorted(matcher.codes(t)) for t in val["note_text"]])
rules_dev = mlb.transform([sorted(matcher.codes(t)) for t in dev["note_text"]])
y_train, y_val = mlb.transform(train["labels"]), mlb.transform(val["labels"])

for name, feats in [("tfidf only", build_features), ("tfidf + embeddings x1", lambda: build_features_with_embeddings(1.0)),
                    ("tfidf + embeddings x2", lambda: build_features_with_embeddings(2.0))]:
    model = Pipeline([("features", feats()), ("clf", OneVsRestClassifier(LogisticRegression(
        C=32.0, solver="liblinear", class_weight="balanced", max_iter=2000)))])
    model.fit(train["norm"], y_train)
    pv = model.predict_proba(val["norm"])
    t = max(np.round(np.arange(0.5, 1.0, 0.025), 3), key=lambda t: f1_score(
        y_val, policy_matrix(np.maximum(rules_val, (pv >= t).astype(int)), allowed), average="micro", zero_division=0))
    pd_ = model.predict_proba(dev["norm"])
    m = metrics(dev_gold, policy_matrix(np.maximum(rules_dev, (pd_ >= t).astype(int)), allowed), allowed)
    print(f"{name:<24} hybrid thr={t:<6} dev micro-F1 {m['micro_f1']:.3f}  P {m['micro_precision']:.3f}  "
          f"R {m['micro_recall']:.3f}  exact {m['exact_match']:.3f}", flush=True)
