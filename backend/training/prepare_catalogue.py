"""Validate a user-maintained plain-text ICD-10 subset and emit JSON."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "data" / "icd10_catalogue.txt"
DEST = ROOT / "data" / "icd10_catalogue.json"
CODE_RE = re.compile(r"^[A-Z][0-9]{2}(?:\.[A-Z0-9]{1,4})?$", re.I)


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Missing catalogue: {SOURCE}")
    rows = []
    seen = set()
    for line_no, raw in enumerate(SOURCE.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [part.strip() for part in line.split("|")]
        if len(parts) not in (1, 2, 3):
            raise SystemExit(f"Line {line_no}: expected CODE | English | Malay")
        code = parts[0].upper()
        if not CODE_RE.fullmatch(code):
            raise SystemExit(f"Line {line_no}: invalid-looking ICD-10 code {code!r}")
        if code in seen:
            raise SystemExit(f"Line {line_no}: duplicate code {code}")
        seen.add(code)
        rows.append({
            "code": code,
            "labelEn": parts[1] if len(parts) >= 2 else "",
            "labelMs": parts[2] if len(parts) >= 3 else "",
        })
    if not rows:
        raise SystemExit("No codes found. Add one code per line to icd10_catalogue.txt.")
    DEST.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Validated {len(rows)} unique code entries -> {DEST}")
    print("Note: format validation is not clinical validation. Verify codes/descriptions against your authoritative source.")


if __name__ == "__main__":
    main()
