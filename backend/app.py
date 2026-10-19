"""CatatKod analysis API. Prototype only; not for real patient data."""
from __future__ import annotations

import hashlib
import json
import os
import re
import time
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Index

app = Flask(__name__)
database_url = os.getenv("DATABASE_URL", "sqlite:///catatkod_dev.db")
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
elif database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024

db = SQLAlchemy(app)

allowed_origins = [origin.strip() for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if origin.strip()]
CORS(app, resources={r"/api/*": {"origins": allowed_origins}})


class AnalysisAudit(db.Model):
    """Store operational metrics only; never store raw clinical note text."""
    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    note_sha256 = db.Column(db.String(64), nullable=False)
    input_length = db.Column(db.Integer, nullable=False)
    candidate_count = db.Column(db.Integer, nullable=False)
    provider = db.Column(db.String(40), nullable=False)
    duration_ms = db.Column(db.Integer, nullable=False)

    __table_args__ = (Index("ix_analysis_audit_created_at", "created_at"),)


# Narrow initial catalogue. Validate every LLM suggestion against this list.
ICD10 = {
    "R50.9": ("Demam, tidak dinyatakan", "Fever, unspecified", ["demam", "fever"]),
    "R05": ("Batuk", "Cough", ["batuk", "cough"]),
    "J00": ("Nasofaringitis akut (selesema biasa)", "Acute nasopharyngitis (common cold)", ["selesema", "selsema", "common cold"]),
    "J02.9": ("Faringitis akut, tidak dinyatakan", "Acute pharyngitis, unspecified", ["tekak merah", "sakit tekak", "sore throat"]),
    "R51": ("Sakit kepala", "Headache", ["sakit kepala", "headache"]),
    "E11": ("Diabetes mellitus jenis 2", "Type 2 diabetes mellitus", ["kencing manis", "diabetes jenis 2", "type 2 diabetes"]),
    "I10": ("Hipertensi primer", "Essential (primary) hypertension", ["darah tinggi", "hipertensi", "hypertension"]),
    "R06.0": ("Dispnea", "Dyspnoea", ["sesak nafas", "shortness of breath", "sob"]),
    "R80": ("Proteinuria", "Proteinuria", ["kencing berbuih", "proteinuria", "foamy urine"]),
    "R60.0": ("Edema setempat", "Localized oedema", ["kaki bengkak", "bengkak kaki", "localized oedema"]),
}

ABBREVIATIONS = [
    (r"\bpt\b", "pesakit"),
    (r"\bdtg\b", "datang"),
    (r"\bhx\b", "sejarah"),
    (r"\bari\b", "hari"),
    (r"\bc/o\b", "mengadu"),
    (r"\bsob\b", "sesak nafas"),
    (r"\+|\bplus\b", "dan"),
]
NEGATIONS = [
    (r"\bno\s+sob\b", "tiada sesak nafas"),
    (r"\btiada\s+sesak\s+nafas\b", "tiada sesak nafas"),
    (r"\btidak\s+sesak\s+nafas\b", "tiada sesak nafas"),
    (r"\btiada\s+demam\b", "tiada demam"),
    (r"\btidak\s+demam\b", "tiada demam"),
    (r"\btiada\s+batuk\b", "tiada batuk"),
    (r"\btidak\s+batuk\b", "tiada batuk"),
]


def expand_note(text: str) -> str:
    result = text
    for pattern, replacement in ABBREVIATIONS:
        result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", result).strip()


def extract_duration(text: str):
    match = re.search(r"\b(\d+)\s*(hari|ari|day|days|minggu|week|weeks|bulan|month|months)\b", text, re.I)
    if not match:
        return None
    unit = match.group(2).lower()
    unit_map = {"ari": "hari", "day": "hari", "days": "hari", "week": "minggu", "weeks": "minggu", "month": "bulan", "months": "bulan"}
    return {"value": int(match.group(1)), "unit": unit_map.get(unit, unit)}


def rule_based_candidates(text: str):
    lower = text.lower()
    negated = []
    negated_spans = []
    for pattern, meaning in NEGATIONS:
        for match in re.finditer(pattern, lower):
            negated.append({"text": text[match.start():match.end()], "start": match.start(), "end": match.end(), "meaningMs": f"Dinafikan: {meaning}"})
            negated_spans.append((match.start(), match.end()))

    candidates = []
    for code, (label_ms, label_en, terms) in ICD10.items():
        match = None
        for term in sorted(terms, key=len, reverse=True):
            found = re.search(re.escape(term), lower)
            if found:
                match = found
                break
        if not match:
            continue
        # Exclude a finding when the match is within a recognised negated span.
        if any(match.start() >= start and match.end() <= end for start, end in negated_spans):
            continue
        # Avoid coding SOB if the phrase is explicitly negated.
        candidates.append({
            "id": f"{code}-{match.start()}", "code": code,
            "labelMs": label_ms, "labelEn": label_en,
            "evidence": text[match.start():match.end()],
            "start": match.start(), "end": match.end(),
        })
    return candidates, negated


def llm_candidates(expanded_note: str, original_note: str, rule_candidates: list[dict]):
    """Optional Gemini enrichment. Deterministic rules remain the fallback and whitelist gate."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return rule_candidates, "rules"
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=api_key)
        catalogue = [{"code": code, "labelMs": values[0], "labelEn": values[1], "terms": values[2]} for code, values in ICD10.items()]
        prompt = f"""You assist with a prototype clinical coding workflow. This is decision support, not diagnosis. Use ONLY codes from the supplied catalogue. Do not infer missing findings. Respect negation and uncertainty. Return JSON only in this schema: {{\"codes\":[{{\"code\":\"catalogue code\",\"evidence\":\"exact substring from original note\"}}]}}. Include only supported candidate codes.\nCATALOGUE={json.dumps(catalogue, ensure_ascii=False)}\nORIGINAL_NOTE={json.dumps(original_note, ensure_ascii=False)}\nNORMALISED_NOTE={json.dumps(expanded_note, ensure_ascii=False)}\nRULE_CANDIDATES={json.dumps([x['code'] for x in rule_candidates])}"""
        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0),
        )
        parsed = json.loads(response.text or "{}")
        by_code = {item["code"]: item for item in rule_candidates}
        final = list(rule_candidates)
        _, negated_phrases = rule_based_candidates(original_note)
        negated_spans = [(item["start"], item["end"]) for item in negated_phrases]
        # LLM may add only catalogue-grounded evidence from the original note, never a negated span.
        for suggestion in parsed.get("codes", []):
            code = suggestion.get("code")
            evidence = suggestion.get("evidence", "")
            if code not in ICD10 or not isinstance(evidence, str) or not evidence or evidence not in original_note:
                continue
            if code in by_code:
                continue
            start = original_note.index(evidence)
            end = start + len(evidence)
            if any(start >= neg_start and end <= neg_end for neg_start, neg_end in negated_spans):
                continue
            _, _, allowed_terms = ICD10[code]
            if not any(term in evidence.lower() or evidence.lower() in term for term in allowed_terms):
                continue
            label_ms, label_en, _ = ICD10[code]
            final.append({"id": f"{code}-{start}", "code": code, "labelMs": label_ms, "labelEn": label_en, "evidence": evidence, "start": start, "end": end})
        # The LLM can add only whitelist-validated candidates; it cannot silently remove deterministic candidates.
        return final, "gemini+rules"
    except Exception:
        app.logger.exception("Gemini enrichment failed; using rule-based candidates")
        return rule_candidates, "rules-fallback"


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "catatkod-api", "databaseConfigured": bool(os.getenv("DATABASE_URL"))})


@app.post("/api/analyze")
def analyze():
    started = time.perf_counter()
    body = request.get_json(silent=True) or {}
    note = body.get("note")
    if not isinstance(note, str) or not note.strip():
        return jsonify({"error": "A non-empty note string is required."}), 400
    note = note.strip()
    if len(note) > 5000:
        return jsonify({"error": "Notes must be 5,000 characters or fewer."}), 413

    expanded = expand_note(note)
    candidates, negated = rule_based_candidates(note)
    candidates, provider = llm_candidates(expanded, note, candidates)
    duration_ms = int((time.perf_counter() - started) * 1000)
    duration = extract_duration(note)
    result = {"codes": candidates, "negated": negated, "duration": duration, "expandedNote": expanded}

    # Keep operational metrics, but do not persist raw note content or direct identifiers.
    try:
        db.session.add(AnalysisAudit(
            note_sha256=hashlib.sha256(note.encode("utf-8")).hexdigest(),
            input_length=len(note), candidate_count=len(candidates), provider=provider, duration_ms=duration_ms,
        ))
        db.session.commit()
    except Exception:
        db.session.rollback()
        app.logger.warning("Could not write analysis metrics to database", exc_info=True)
    return jsonify(result)


@app.errorhandler(413)
def too_large(_error):
    return jsonify({"error": "Request body is too large."}), 413


with app.app_context():
    try:
        db.create_all()
    except Exception:
        # Allows import/build in environments where the database is not provisioned yet.
        app.logger.warning("Database is not ready; tables were not created", exc_info=True)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=False)
