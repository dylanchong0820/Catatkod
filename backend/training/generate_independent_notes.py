"""Build an independent evaluation set: notes written by SEA-LION, not by the CatatKod lexicon author.

SEA-LION is told only the English WHO titles of the findings to include (and one to deny). It never sees
the Malay lexicon, so its vocabulary ("kencing buih", "bengkak kaki both legs") is independent of ours.
Labels are the codes we asked for. Notes are split once, deterministically:
  * dev  (60)  - may be inspected to find lexicon/normaliser gaps
  * test (100) - never inspected while improving the system; report this number
Responses are cached (artifacts/llm_cache.json), so reruns are free.

  python training/generate_independent_notes.py --rpm 9                     # Malay (60 dev / 100 test)
  python training/generate_independent_notes.py --rpm 9 --style english     # English (40 dev / 60 test)
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import random
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT.parent))
import benchmark_llm as bench  # noqa: E402

DEST = ROOT / "data" / "independent_notes.csv"
MODEL = "aisingapore/Gemma-SEA-LION-v4-27B-IT"
N_DEV, N_TEST = 60, 100

PROMPT = """You are a nurse at a busy government klinik kesihatan in Malaysia. Write ONE short clinical note \
(1-2 lines) the way nurses really type in a hurry: colloquial Malay mixed with English, heavy shorthand and \
abbreviations, typos allowed, no full sentences needed.
{body}
Do not copy the English medical terms above; write it the way a Malaysian nurse would. Do not add any other \
symptom, diagnosis or medical history. No patient names or IDs.
Answer with JSON only: {{"note": "..."}}"""

PROMPT_ENGLISH = """You are a doctor at a busy government klinik kesihatan in Malaysia. Write ONE short clinical note \
(1-2 lines) in ENGLISH ONLY, the way clinicians really type in a hurry: terse, medical abbreviations \
(c/o, h/o, x3/7, SOB, LOC, c/w, ?), plain everyday wording is fine, typos allowed, no full sentences needed. \
Do not use any Malay words.
{body}
Vary the wording: do not simply copy the condition names above; use the words a clinician would actually type. \
Do not add any other symptom, diagnosis or medical history. No patient names or IDs.
Answer with JSON only: {{"note": "..."}}"""

STYLES = {  # style -> (prompt, default output file, note-id prefix, n_dev, n_test)
    "malay": (PROMPT, DEST, "IND", 60, 100),
    "english": (PROMPT_ENGLISH, ROOT / "data" / "independent_notes_english.csv", "ENG", 40, 60),
}

KIND_HINT = {"S": "", "H": " (known medical history)", "D": " (doctor's impression / diagnosis)"}


def friendly(title: str) -> str:
    return re.sub(r",\s*(unspecified|site unspecified|stage unspecified|organism unspecified).*$", "", title)


def plan_notes(catalogue: list[dict], n: int, seed: int) -> list[dict]:
    rng = random.Random(seed)
    symptoms = [c for c in catalogue if c["kind"] == "S"]
    order: list[dict] = []
    plans = []
    for i in range(n):
        if rng.random() < 0.06:  # routine visit, nothing to code
            neg = rng.choice(symptoms)
            plans.append({"codes": [], "negated": [neg["code"]],
                          "body": f"The patient came for a routine follow-up and has no complaints. "
                                  f"Explicitly mention that the patient does NOT have: {friendly(neg['labelEn'])}."})
            continue
        chosen: list[dict] = []
        for _ in range(rng.choices([1, 2, 3], weights=[4, 4, 2])[0]):
            if not order:
                order = catalogue[:]
                rng.shuffle(order)
            cand = order.pop()
            # Avoid asking for two codes from the same ICD-11 stem (e.g. dizziness + vertigo): ambiguous labels.
            if all(cand["code"][:4] != c["code"][:4] for c in chosen):
                chosen.append(cand)
        lines = "\n".join(f"- {friendly(c['labelEn'])}{KIND_HINT[c['kind']]}" for c in chosen)
        body = f"The patient has ONLY these findings/conditions:\n{lines}"
        negated = []
        if rng.random() < 0.4:
            neg = rng.choice([s for s in symptoms if all(s["code"][:4] != c["code"][:4] for c in chosen)])
            negated.append(neg["code"])
            body += f"\nAlso explicitly mention that the patient does NOT have: {friendly(neg['labelEn'])}."
        plans.append({"codes": [c["code"] for c in chosen], "negated": negated, "body": body})
    return plans


def parse_note(text: str) -> str:
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    try:
        return str(json.loads(text)["note"]).strip()
    except (json.JSONDecodeError, KeyError, TypeError):
        m = re.search(r'"note"\s*:\s*"(.*?)"', text, re.S)
        return m.group(1).strip() if m else ""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--rpm", type=float, default=9)
    parser.add_argument("--seed", type=int, default=1126)
    parser.add_argument("--style", choices=sorted(STYLES), default="malay")
    parser.add_argument("--model", default=MODEL, help="SEA-LION model that writes the notes")
    parser.add_argument("--train-notes", type=int, default=0,
                        help="write N TRAINING notes (split=train) instead of the dev/test evaluation set")
    parser.add_argument("--out", help="output CSV (default depends on --style / --train-notes)")
    args = parser.parse_args()
    prompt, dest, prefix, n_dev, n_test = STYLES[args.style]
    if args.train_notes:
        n_dev, n_test = args.train_notes, 0
        tag = args.model.split("/")[-1].split("-")[0].lower()
        dest = ROOT / "data" / f"llm_training_notes_{args.style}_{tag}.csv"
        prefix = f"TR{args.style[0].upper()}{tag[:3].upper()}"
    if args.out:
        dest = Path(args.out)

    bench.load_env_file(ROOT.parent / ".env")
    key = os.environ.get("SEALION_API_KEY")
    if not key:
        raise SystemExit("Set SEALION_API_KEY in backend/.env")
    bench.PACER = bench.Pacer(args.rpm)
    bench.TIMEOUT = 30  # notes are 1-2 lines (~2 s); don't wait 2 minutes on a dropped connection
    cache = bench.Cache(bench.CACHE)
    catalogue = json.loads(bench.CATALOGUE.read_text(encoding="utf-8"))

    plans = plan_notes(catalogue, n_dev + n_test, args.seed)
    rows, failed = [], 0
    for i, plan in enumerate(plans):
        try:
            note = parse_note(bench.ask(cache, "sealion", args.model, key, prompt.format(body=plan["body"])))
        except Exception as exc:  # noqa: BLE001
            print(f"  note {i}: {exc}")
            failed += 1
            continue
        if not note:
            failed += 1
            continue
        rows.append({"note_id": f"{prefix}{i + 1:03d}", "note_text": note, "gold_codes": ";".join(sorted(plan["codes"])),
                     "negated_codes": ";".join(plan["negated"]),
                     "split": ("train" if args.train_notes else "dev") if i < n_dev else "test",
                     "source": f"sealion:{args.model}"})
        if (i + 1) % 20 == 0:
            print(f"{i + 1}/{len(plans)} notes", flush=True)
    if failed:
        raise SystemExit(f"{failed} notes failed; cached ones are kept - rerun to resume.")
    with dest.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} notes -> {dest.name}")


if __name__ == "__main__":
    main()
