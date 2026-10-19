"""Load the WHO ICD-11 MMS catalogue and the CatatKod tier-1 Malay lexicon."""
from __future__ import annotations

import csv
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "training" / "data"
WHO_CSV = DATA / "icd11_mms_simple_tabulation_en.csv"
LEXICON = DATA / "tier1_lexicon.txt"
KINDS = {"S": "symptom", "H": "history", "D": "diagnosis"}


@dataclass
class LexiconEntry:
    code: str
    kind: str
    label_ms: str
    phrases: list[str]
    title_en: str = ""
    is_leaf: bool = True
    chapter: str = ""
    extra: dict = field(default_factory=dict)


@lru_cache(maxsize=2)
def load_who(path: Path = WHO_CSV) -> dict[str, dict]:
    """Coded WHO rows keyed by ICD-11 code (rows with _NOCODEASSIGNED are skipped)."""
    out: dict[str, dict] = {}
    with path.open(encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            code = row["code"].strip()
            if not code or code.startswith("_"):
                continue
            row["title_clean"] = row["title_en"].lstrip("- ").strip()
            out[code] = row
    return out


def load_lexicon(path: Path = LEXICON, who: dict[str, dict] | None = None) -> list[LexiconEntry]:
    entries: list[LexiconEntry] = []
    for line_no, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) != 4:
            raise ValueError(f"{path.name}:{line_no}: expected CODE | kind | label_ms | phrases")
        code, kind, label_ms, phrases = parts
        if kind not in KINDS:
            raise ValueError(f"{path.name}:{line_no}: kind must be one of {sorted(KINDS)}")
        phrase_list = [p.strip().lower() for p in phrases.split(";") if p.strip()]
        entry = LexiconEntry(code=code.upper(), kind=kind, label_ms=label_ms, phrases=phrase_list)
        if who is not None and entry.code in who:
            row = who[entry.code]
            entry.title_en = row["title_clean"]
            entry.is_leaf = row["is_leaf"] == "True"
            entry.chapter = row["chapter_no"]
        entries.append(entry)
    return entries
