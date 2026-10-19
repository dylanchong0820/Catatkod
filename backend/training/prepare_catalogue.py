"""Validate the tier-1 Malay lexicon against the WHO ICD-11 MMS catalogue and emit JSON.

Checks: every code exists in the WHO export, no duplicate codes, no phrase shared by two
codes (after normalisation), and every code has enough phrases to generate varied notes.
Format validation is not clinical validation.
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from nlp.catalogue import DATA, load_lexicon, load_who  # noqa: E402
from nlp.normalise import normalise  # noqa: E402

DEST = DATA / "icd11_tier1_catalogue.json"
MIN_PHRASES = 3


def main() -> None:
    who = load_who()
    entries = load_lexicon(who=who)
    errors, warnings = [], []
    seen: set[str] = set()
    phrase_owner: dict[str, list[str]] = defaultdict(list)
    for e in entries:
        if e.code in seen:
            errors.append(f"duplicate code {e.code}")
        seen.add(e.code)
        if e.code not in who:
            errors.append(f"{e.code} is not a coded entry in the WHO ICD-11 MMS export")
            continue
        if not e.is_leaf:
            unspecified = e.code + ("Z" if "." in e.code else ".Z")
            hint = f" (consider {unspecified})" if unspecified in who else ""
            warnings.append(f"{e.code} '{e.title_en}' has subcategories{hint}")
        if len(e.phrases) < MIN_PHRASES:
            warnings.append(f"{e.code} has only {len(e.phrases)} phrases")
        for phrase in e.phrases:
            phrase_owner[normalise(phrase)].append(e.code)
    for phrase, owners in phrase_owner.items():
        if len(set(owners)) > 1:
            errors.append(f"phrase {phrase!r} is used by {', '.join(sorted(set(owners)))}")

    for w in warnings:
        print("warning:", w)
    if errors:
        for e in errors:
            print("ERROR:", e, file=sys.stderr)
        raise SystemExit(1)

    rows = [{"code": e.code, "kind": e.kind, "labelMs": e.label_ms, "labelEn": e.title_en,
             "chapter": e.chapter, "isLeaf": e.is_leaf, "phrases": e.phrases} for e in entries]
    DEST.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    by_kind = defaultdict(int)
    for e in entries:
        by_kind[e.kind] += 1
    print(f"Validated {len(rows)} tier-1 codes ({dict(by_kind)}) against {len(who)} WHO coded entries -> {DEST.name}")
    print("Note: format validation is not clinical validation.")


if __name__ == "__main__":
    main()
