"""CatatKod analysis API (ICD-11 MMS). Prototype only; not for real patient data. Suggestions are never final codes."""
from __future__ import annotations

import hashlib
import json
import os
import time
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Index

from nlp.pipeline import analyze as analyze_note, load_model
from nlp.retrieval import default_search
from nlp.rules import default_matcher

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

allowed_origins = [origin.strip() for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8443,http://127.0.0.1:8443").split(",") if origin.strip()]
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


def _no_span(code: dict) -> dict:
    """Model-only codes have no evidence span; the UI convention for that is start = end = -1."""
    if code.get("start") is None or code.get("end") is None:
        return {**code, "evidence": code.get("evidence") or "", "start": -1, "end": -1}
    return code


def _gemini_catalogue(suggestions: list[dict]) -> dict[str, dict]:
    """Codes Gemini may choose from: the tier-1 lexicon plus this note's catalogue suggestions."""
    allowed = {code: {"code": code, "labelMs": e.label_ms, "labelEn": e.title_en, "terms": e.phrases}
               for code, e in default_matcher().entries.items()}
    for item in suggestions:
        allowed.setdefault(item["code"], {"code": item["code"], "labelMs": item["labelEn"], "labelEn": item["labelEn"], "terms": []})
    return allowed


def llm_candidates(result: dict, original_note: str) -> tuple[list[dict], str]:
    """Optional Gemini enrichment. The ICD-11 pipeline stays the fallback; Gemini can only add whitelisted codes."""
    candidates = result["codes"]
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return candidates, "rules"
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=api_key)
        allowed = _gemini_catalogue(result["catalogueSuggestions"])
        prompt = f"""You assist with a prototype clinical coding workflow. This is decision support, not diagnosis. Use ONLY ICD-11 MMS codes from the supplied catalogue. Do not infer missing findings. Respect negation and uncertainty (do not code negated or suspected findings). Return JSON only in this schema: {{\"codes\":[{{\"code\":\"catalogue code\",\"evidence\":\"exact substring from original note\"}}]}}. Include only supported candidate codes.\nCATALOGUE={json.dumps(list(allowed.values()), ensure_ascii=False)}\nORIGINAL_NOTE={json.dumps(original_note, ensure_ascii=False)}\nNORMALISED_NOTE={json.dumps(result["expandedNote"], ensure_ascii=False)}\nRULE_CANDIDATES={json.dumps([x["code"] for x in candidates])}"""
        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-3.8-flash"),
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0),
        )
        parsed = json.loads(response.text or "{}")
        present = {item["code"] for item in candidates}
        final = list(candidates)
        negated_spans = [(item["start"], item["end"]) for item in result["negated"]]
        # Gemini may add only whitelisted codes with exact evidence from the original note, never a negated span.
        for suggestion in parsed.get("codes", []):
            code = suggestion.get("code")
            evidence = suggestion.get("evidence", "")
            if code not in allowed or not isinstance(evidence, str) or not evidence or evidence not in original_note:
                continue
            # Skip duplicates, including a parent/child of a code already suggested (MG29 vs MG29.01).
            if any(code.startswith(other) or other.startswith(code) for other in present):
                continue
            start = original_note.index(evidence)
            end = start + len(evidence)
            if any(start < neg_end and end > neg_start for neg_start, neg_end in negated_spans):
                continue
            entry = allowed[code]
            final.append({"id": f"{code}-{start}", "code": code, "labelMs": entry["labelMs"], "labelEn": entry["labelEn"],
                          "evidence": evidence, "start": start, "end": end, "source": "gemini", "modelScore": None})
            present.add(code)
        # Gemini can add only whitelist-validated candidates; it cannot silently remove pipeline candidates.
        return final, "gemini+rules"
    except Exception:
        app.logger.exception("Gemini enrichment failed; using pipeline candidates")
        return candidates, "rules-fallback"


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "catatkod-api", "codeSystem": "ICD-11 MMS",
                    "modelLoaded": load_model() is not None, "databaseConfigured": bool(os.getenv("DATABASE_URL"))})


@app.get("/api/icd11/search")
def icd11_search():
    """Manual search over the full ICD-11 MMS diagnostic catalogue (Malay or English query)."""
    query = (request.args.get("q") or "").strip()
    if not query:
        return jsonify({"error": "A non-empty q parameter is required."}), 400
    if len(query) > 200:
        return jsonify({"error": "Search queries must be 200 characters or fewer."}), 413
    try:
        limit = max(1, min(int(request.args.get("limit", "10")), 50))
    except ValueError:
        limit = 10
    tier1 = default_matcher().entries
    results = [{**hit, "labelMs": tier1[hit["code"]].label_ms if hit["code"] in tier1 else None}
               for hit in default_search().search(query, k=limit)]
    return jsonify({"query": query, "codeSystem": "ICD-11 MMS", "results": results})


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

    result = analyze_note(note)
    candidates, provider = llm_candidates(result, note)
    result["codes"] = [_no_span(item) for item in candidates]
    coded = {item["code"] for item in candidates}
    result["catalogueSuggestions"] = [item for item in result["catalogueSuggestions"] if item["code"] not in coded]
    if load_model() is None and provider == "rules":
        provider = "rules-nomodel"
    duration_ms = int((time.perf_counter() - started) * 1000)

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

# Build the lexicon matcher and TF-IDF catalogue index once at startup, not on the first request.
default_matcher()
default_search()
if load_model() is None:
    app.logger.warning("Tier-1 classifier not found; run `python training/train.py --allow-draft`. Using rules + catalogue search only.")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5001")), debug=False)
