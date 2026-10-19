"""End-to-end CatatKod analysis: normalise -> rules + trained classifier (tier 1) -> catalogue search (tier 2).

Output codes are suggestions for nurse/clinician review, never final codes.
Run as a demo:  python -m nlp.pipeline "pt dtg c/o kencing berbuih, kaki bengkak 3 ari, hx kencing manis"
"""
from __future__ import annotations

import re
import sys
from functools import lru_cache
from pathlib import Path

import joblib

from .normalise import expand, normalise
from .retrieval import default_search
from .rules import default_matcher

MODEL_PATH = Path(__file__).resolve().parent.parent / "training" / "artifacts" / "icd11_tier1_classifier.joblib"
NEGATION_RE = re.compile(r"\b(takde|tak ada|tiada|tidak|tak|xde|no|nafi|denies|deny)\s+([a-z]+(?:\s+[a-z]+)?)", re.I)
DURATION_RE = re.compile(r"\b(\d+)\s*(hari|ari|hri|day|days|minggu|mgu|week|weeks|bulan|bln|month|months)\b", re.I)
UNIT_MAP = {"ari": "hari", "hri": "hari", "day": "hari", "days": "hari", "mgu": "minggu", "week": "minggu", "weeks": "minggu",
            "bln": "bulan", "month": "bulan", "months": "bulan"}


@lru_cache(maxsize=1)
def load_model():
    if not MODEL_PATH.exists():
        return None
    return joblib.load(MODEL_PATH)


def analyze(note: str, search_k: int = 5) -> dict:
    matcher = default_matcher()
    rule_hits = {m["code"]: m for m in matcher.match(note)}
    scores: dict[str, float] = {}
    bundle = load_model()
    if bundle is not None:
        proba = bundle["model"].predict_proba([normalise(note)])[0]
        scores = {code: float(p) for code, p in zip(bundle["classes"], proba)}
        ml_codes = {c for c, p in scores.items() if p >= bundle["hybrid_threshold"]}
    else:
        ml_codes = set()

    codes = []
    for code in sorted(set(rule_hits) | ml_codes, key=lambda c: -scores.get(c, 1.0)):
        entry = matcher.entries[code]
        hit = rule_hits.get(code, {})
        codes.append({
            "id": f"{code}-{hit.get('start') or 0}", "code": code, "labelMs": entry.label_ms, "labelEn": entry.title_en,
            "evidence": hit.get("evidence") or "", "start": hit.get("start"), "end": hit.get("end"),
            "source": "rules+model" if code in rule_hits and code in ml_codes else "rules" if code in rule_hits else "model",
            "modelScore": round(scores[code], 3) if code in scores else None,
        })

    tier1 = {c["code"] for c in codes}
    other = [h for h in default_search().search(note, k=search_k + len(tier1)) if h["code"] not in tier1][:search_k]
    negated = [{"text": m.group(0), "start": m.start(), "end": m.end(), "meaningMs": f"Dinafikan: {m.group(2)}"}
               for m in NEGATION_RE.finditer(note)]
    d = DURATION_RE.search(note)
    duration = {"value": int(d.group(1)), "unit": UNIT_MAP.get(d.group(2).lower(), d.group(2).lower())} if d else None
    return {"codes": codes, "negated": negated, "duration": duration, "expandedNote": expand(note),
            "catalogueSuggestions": other, "codeSystem": "ICD-11 MMS"}


if __name__ == "__main__":
    import json
    for text in sys.argv[1:] or ["pt dtg komplen kencing berbuih, kaki bengkak 3 ari, hx kencing manis",
                                 "takde demam, tak batuk, cuma sakit badan",
                                 "budak 4thn demam 3 hari, cirit 4x, muntah, imp AGE. bisul kat punggung"]:
        print(f"\n>>> {text}")
        print(json.dumps(analyze(text), ensure_ascii=False, indent=1))
