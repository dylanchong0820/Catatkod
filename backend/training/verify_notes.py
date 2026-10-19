"""Check LLM-written notes against the findings they were asked to contain, without looking at CatatKod.

For each note, Gemma-SEA-LION is shown the note and the requested findings (and the finding to deny) and
reports: findings stated as present that were NOT requested, requested findings that are missing, and
requested findings written only as uncertain ("?pneumonia", "r/o TB"). A note is "clean" when all three
lists are empty. Results go to artifacts/verify_<file>.json; nothing about CatatKod's output is used.

  python training/verify_notes.py --data english --rpm 9
  python training/verify_notes.py --data malay --rpm 9
  python training/verify_notes.py --data data/llm_training_notes_llama.csv --rpm 9
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT.parent))
import benchmark_llm as bench  # noqa: E402
from generate_independent_notes import friendly  # noqa: E402

MODEL = "aisingapore/Gemma-SEA-LION-v4-27B-IT"
FILES = {"malay": ROOT / "data" / "independent_notes.csv", "english": ROOT / "data" / "independent_notes_english.csv"}

PROMPT = """You are checking a short clinical note from a Malaysian clinic (Malay, English or mixed, with shorthand).
NOTE: {note}

The note was supposed to state ONLY these findings as present:
{requested}
{denied}
Answer with JSON only, in this exact shape:
{{"extra": ["any other symptom, condition or diagnosis the note states as PRESENT that is not in the list"],
 "missing": ["any listed finding the note does not mention at all"],
 "uncertain": ["any listed finding the note mentions only as suspected/possible, e.g. with ? or 'r/o' or 'likely'"]}}
Ignore vital signs, treatments, advice and follow-up instructions. Use empty lists when nothing applies."""


def verify_path(data: Path) -> Path:
    return bench.ARTIFACTS / f"verify_{data.stem}.json"


def parse(text: str) -> dict | None:
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    try:
        out = json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            return None
        try:
            out = json.loads(m.group(0))
        except json.JSONDecodeError:
            return None
    clean = lambda v: [str(x) for x in v if str(x).strip()] if isinstance(v, list) else []  # noqa: E731
    return {k: clean(out.get(k, [])) for k in ("extra", "missing", "uncertain")}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", default="english")
    parser.add_argument("--rpm", type=float, default=9)
    parser.add_argument("--splits", default="", help="comma list of splits to verify (default: all rows)")
    args = parser.parse_args()
    data = FILES.get(args.data, Path(args.data) if Path(args.data).is_absolute() else ROOT / args.data)

    bench.load_env_file(ROOT.parent / ".env")
    key = os.environ.get("SEALION_API_KEY")
    if not key:
        raise SystemExit("Set SEALION_API_KEY in backend/.env")
    bench.PACER = bench.Pacer(args.rpm)
    bench.TIMEOUT = 30
    cache = bench.Cache(bench.CACHE)
    titles = {row["code"]: friendly(row["labelEn"]) for row in json.loads(bench.CATALOGUE.read_text(encoding="utf-8"))}

    df = pd.read_csv(data, dtype=str, keep_default_na=False)
    if args.splits:
        df = df[df["split"].isin(args.splits.split(","))]
    results, failed = {}, 0
    for i, row in enumerate(df.itertuples(), 1):
        codes = [c for c in row.gold_codes.split(";") if c]
        requested = "\n".join(f"- {titles[c]}" for c in codes) or "- (nothing: a routine visit with no complaints)"
        negs = [c for c in getattr(row, "negated_codes", "").split(";") if c]
        denied = f"It may also explicitly deny: {', '.join(titles[c] for c in negs)}." if negs else ""
        try:
            reply = bench.ask(cache, "sealion", MODEL, key, PROMPT.format(note=row.note_text, requested=requested, denied=denied))
        except Exception as exc:  # noqa: BLE001
            print(f"  {row.note_id}: {exc}")
            failed += 1
            continue
        verdict = parse(reply)
        if verdict is None:
            failed += 1
            continue
        verdict["clean"] = not (verdict["extra"] or verdict["missing"] or verdict["uncertain"])
        results[row.note_id] = verdict
        if i % 20 == 0:
            print(f"{i}/{len(df)} verified", flush=True)
    out = verify_path(data)
    out.write_text(json.dumps(results, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    n_clean = sum(v["clean"] for v in results.values())
    print(f"{len(results)} verified ({failed} failed), {n_clean} clean -> {out.name}")
    if failed:
        raise SystemExit("Some notes failed; cached answers are kept - rerun to resume.")


if __name__ == "__main__":
    main()
