"""Merge starter, hand-written and generated notes into labelled_notes.csv with fixed splits.

Split policy (deterministic, by note_id hash):
  * generated notes            -> train only (templates must never leak into evaluation)
  * independent (SEA-LION) dev -> train; independent test notes are excluded here and scored by evaluate_independent.py
  * starter + hand-written     -> 25% train, 25% validation, 50% test
Every row is review_status=draft until a qualified clinician reviews the labels.
"""
from __future__ import annotations

import csv
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from nlp.catalogue import DATA  # noqa: E402
from nlp.policy import apply as apply_policy  # noqa: E402

SOURCES = ["starter_labelled.csv", "handwritten_notes.csv", "generated_notes.csv", "independent_notes.csv",
           "independent_notes_english.csv"]
# LLM-written training notes (generate_independent_notes.py --train-notes); a note is skipped when
# verify_notes.py found a requested finding missing from it, because its label would then be wrong.
LLM_TRAINING_GLOB = "llm_training_notes_*.csv"
ARTIFACTS = Path(__file__).resolve().parent / "artifacts"
DEST = DATA / "labelled_notes.csv"
CATALOGUE = DATA / "icd11_tier1_catalogue.json"


def bucket(note_id: str) -> float:
    return int(hashlib.sha256(note_id.encode()).hexdigest()[:8], 16) / 0xFFFFFFFF


def split_for(row: dict) -> str:
    if row["source"] in {"generated", "independent_dev", "llm_training"}:
        return "train"
    b = bucket(row["note_id"])
    return "train" if b < 0.25 else "validation" if b < 0.5 else "test"


def main() -> None:
    allowed = {row["code"] for row in json.loads(CATALOGUE.read_text(encoding="utf-8"))}
    out, seen = [], set()
    llm_files = sorted(p.name for p in DATA.glob(LLM_TRAINING_GLOB))
    skipped = 0
    for name in SOURCES + llm_files:
        path = DATA / name
        verdicts = {}
        if name in llm_files:
            vpath = ARTIFACTS / f"verify_{Path(name).stem}.json"
            if not vpath.exists():
                print(f"  skipping {name}: not verified yet (run verify_notes.py)")
                continue
            verdicts = json.loads(vpath.read_text(encoding="utf-8"))
        if not path.exists():
            raise SystemExit(f"Missing {name}; run generate_synthetic.py first")
        with path.open(encoding="utf-8-sig", newline="") as fh:
            for row in csv.DictReader(fh):
                if row["note_id"] in seen:
                    raise SystemExit(f"duplicate note_id {row['note_id']}")
                seen.add(row["note_id"])
                codes = sorted(apply_policy(c.strip() for c in row["gold_codes"].split(";") if c.strip()))
                unknown = set(codes) - allowed
                if unknown:
                    raise SystemExit(f"{row['note_id']}: codes not in tier-1 catalogue: {sorted(unknown)}")
                if name in llm_files:
                    v = verdicts.get(row["note_id"])
                    if v is None or v["missing"]:
                        skipped += 1
                        continue
                    row["source"] = "llm_training"
                if name.startswith("independent_notes"):
                    if row["split"] != "dev":
                        continue  # independent TEST notes are never trained on
                    row["source"] = "independent_dev"
                out.append({"note_id": row["note_id"], "note_text": row["note_text"], "gold_codes": ";".join(codes),
                            "split": split_for(row), "review_status": "draft", "source_type": "synthetic",
                            "origin": row["source"]})
    with DEST.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(out[0]))
        writer.writeheader()
        writer.writerows(out)
    counts = Counter((r["split"], r["origin"]) for r in out)
    print(f"Wrote {len(out)} rows -> {DEST.name}" + (f" ({skipped} LLM training notes skipped: missing findings)" if skipped else ""))
    for key in sorted(counts):
        print(f"  {key[0]:<10} {key[1]:<12} {counts[key]}")


if __name__ == "__main__":
    main()
