"""Plain-prompted LLM baseline on the same held-out test split as training/train.py.

Two variants per provider, both scored with train.metrics():
  * open      - the note plus a short coding instruction; the LLM may answer any ICD-11 code.
  * tier1     - the same, but the LLM must choose from the 121 tier-1 codes (code + WHO English title)
                plus that note's tier-2 catalogue suggestions (nlp.retrieval, as nlp.pipeline.analyze shows them).
Neither variant sees the Malay lexicon or the normaliser output. Codes outside tier 1 count as false
positives, because every gold label is a tier-1 code.

Providers: Gemini (GEMINI_API_KEY, GEMINI_MODEL) and, optionally, SEA-LION (SEALION_API_KEY, SEALION_MODEL).
Keys are read from the environment or backend/.env. Responses are cached in artifacts/llm_cache.json, so a
rerun costs nothing; a run with failed calls is not scored (rerun to resume).

  python training/benchmark_llm.py                  # run and write artifacts/llm_benchmark.json
  python training/benchmark_llm.py --update-readme  # also rewrite the LLM table in training/README.md
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pandas as pd
from sklearn.preprocessing import MultiLabelBinarizer

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent))
from nlp.catalogue import load_who  # noqa: E402
from nlp.policy import apply as apply_policy  # noqa: E402
from nlp.retrieval import default_search  # noqa: E402
from train import ARTIFACTS, CATALOGUE, DATA, metrics, parse_codes  # noqa: E402

CACHE = ARTIFACTS / "llm_cache.json"
RESULTS = ARTIFACTS / "llm_benchmark.json"
README = ROOT / "README.md"
README_START, README_END = "<!-- llm-benchmark:start -->", "<!-- llm-benchmark:end -->"
SEARCH_K = 5
# ICD-11 stem codes are 4 characters (e.g. MG26, 1F2D, 8C10) with optional .x / .xx extensions.
CODE_RE = re.compile(r"\b[0-9A-HJ-NP-Z]{4}(?:\.[0-9A-HJ-NP-Z]{1,2})*\b")

INSTRUCTION = """You are a clinical coder. Below is a short note from a Malaysian primary-care clinic, written in \
colloquial Malay with English and clinical shorthand.
List the ICD-11 MMS codes for every finding or condition the note states as present. Code symptoms even when a \
diagnosis is also given. Do not code findings that are negated (e.g. "takde demam") or only suspected \
(e.g. "?denggi", "r/o TB").
Answer with JSON only: {"codes": ["<ICD-11 code>", ...]}"""


def build_prompt(note: str, variant: str, tier1: list[dict]) -> str:
    prompt = INSTRUCTION
    if variant == "tier1":
        tier1_codes = {row["code"] for row in tier1}
        suggestions = [h for h in default_search().search(note, k=SEARCH_K + len(tier1)) if h["code"] not in tier1_codes][:SEARCH_K]
        options = [f"{row['code']}  {row['labelEn']}" for row in tier1] + [f"{h['code']}  {h['labelEn']}" for h in suggestions]
        prompt += "\nUse ONLY codes from this list:\n" + "\n".join(options)
    return f"{prompt}\n\nNOTE: {note}"


TIMEOUT = 120  # seconds per request; short-answer callers lower it so a dropped connection is retried quickly


def _post(url: str, headers: dict, body: dict) -> dict:
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", **headers})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return json.loads(resp.read())


def call_gemini(prompt: str, model: str, key: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    body = {"contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}}
    data = _post(url, {"x-goog-api-key": key}, body)
    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts if not p.get("thought"))


def call_sealion(prompt: str, model: str, key: str) -> str:
    # Reasoning models can loop without ever answering; cap output so such a note scores as an empty answer.
    body = {"model": model, "temperature": 0, "max_tokens": 4000, "messages": [{"role": "user", "content": prompt}]}
    data = _post("https://api.sea-lion.ai/v1/chat/completions", {"Authorization": f"Bearer {key}"}, body)
    return data["choices"][0]["message"]["content"] or ""


PROVIDERS = {
    "gemini": (call_gemini, "GEMINI_API_KEY", "GEMINI_MODEL", "gemini-3.8-flash"),
    "sealion": (call_sealion, "SEALION_API_KEY", "SEALION_MODEL", "aisingapore/Gemma-SEA-LION-v4-27B-IT"),
}


def load_env_file(path: Path) -> None:
    """Fill unset variables from backend/.env (KEY=value lines); existing environment wins."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        key, sep, value = line.strip().partition("=")
        if sep and not key.startswith("#") and value.strip() and not os.environ.get(key.strip()):
            os.environ[key.strip()] = value.strip().strip("\"'")


def extract_codes(text: str) -> list[str]:
    """Codes from the JSON answer; falls back to a regex scan if the model wrapped or broke the JSON."""
    cleaned = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    try:
        raw = json.loads(cleaned).get("codes", [])
        found = [m for item in raw for m in CODE_RE.findall(str(item).upper())]
    except (json.JSONDecodeError, AttributeError):
        found = CODE_RE.findall(cleaned.upper())
    return sorted(set(found))


class Cache:
    def __init__(self, path: Path):
        self.path, self.lock = path, threading.Lock()
        self.data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}

    @staticmethod
    def key(provider: str, model: str, prompt: str) -> str:
        return hashlib.sha256(f"{provider}\n{model}\n{prompt}".encode()).hexdigest()

    def get(self, key: str):
        return self.data.get(key)

    def put(self, key: str, value: dict) -> None:
        with self.lock:
            self.data[key] = value
            self.path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(json.dumps(self.data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            tmp.replace(self.path)


class Pacer:
    """Space out requests to stay under a requests-per-minute quota instead of hitting it and backing off."""

    def __init__(self, rpm: float):
        self.interval = 60.0 / rpm if rpm > 0 else 0.0
        self.lock = threading.Lock()
        self.next_at = 0.0

    def wait(self) -> None:
        with self.lock:
            now = time.monotonic()
            delay = max(0.0, self.next_at - now)
            self.next_at = max(now, self.next_at) + self.interval
        time.sleep(delay)


PACER = Pacer(0)


def ask(cache: Cache, provider: str, model: str, key: str, prompt: str, retries: int = 6) -> str:
    ck = Cache.key(provider, model, prompt)
    if (hit := cache.get(ck)) is not None:
        return hit["response"]
    call = PROVIDERS[provider][0]
    for attempt in range(retries):
        PACER.wait()
        try:
            text = call(prompt, model, key)
            cache.put(ck, {"provider": provider, "model": model, "response": text})
            return text
        except urllib.error.HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504) or attempt == retries - 1:
                raise RuntimeError(f"{provider} HTTP {exc.code}: {exc.read()[:300]!r}") from exc
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt == retries - 1:
                raise RuntimeError(f"{provider} request failed: {exc}") from exc
        time.sleep(min(60, 4 * 2 ** attempt))
    raise AssertionError("unreachable")


def run_variant(cache, provider, model, key, test, variant, tier1, workers):
    prompts = [build_prompt(note, variant, tier1) for note in test["note_text"]]

    def one(prompt):
        try:
            return ask(cache, provider, model, key, prompt), None
        except Exception as exc:  # noqa: BLE001 - reported below, never scored
            return None, str(exc)

    with ThreadPoolExecutor(max_workers=workers) as pool:
        out = list(pool.map(one, prompts))
    errors = [e for _, e in out if e]
    return [r for r, _ in out], errors


def readme_table(results: dict, baselines: dict, n_notes: int, n_codes: int) -> str:
    names = {"naive_keyword_baseline": "Naive keyword matching (no negation)", "catatkod_rules": "CatatKod rules",
             "catatkod_ml": "CatatKod classifier", "catatkod_ml_plus_rules": "**CatatKod rules + classifier**"}
    rows = [(names.get(k, k), m) for k, m in baselines.items()]
    for name, r in results.items():
        provider, variant = name.split(":")
        label = {"open": "any ICD-11 code", "tier1": "choose from 121 tier-1 + catalogue suggestions"}[variant]
        rows.append((f"{provider.title()} `{r['model']}`, plain prompt ({label})", r["metrics"]))
    lines = [f"### CatatKod vs. a plain-prompted LLM (same {n_notes} held-out notes, {n_codes} codes present)", "",
             "| System | micro-P | micro-R | micro-F1 | macro-F1 | exact match |", "|---|---|---|---|---|---|"]
    keys = ["micro_precision", "micro_recall", "micro_f1", "macro_f1_present_codes", "exact_match"]
    for n, m in rows:
        b = "**" if n.startswith("**") else ""
        lines.append(f"| {n} | " + " | ".join(f"{b}{m[k]:.3f}{b}" for k in keys) + " |")
    lines += ["", "LLM rows: `training/benchmark_llm.py`, temperature 0, no lexicon or normaliser, one call per note; "
              "the prompt states the labelling policy above. Codes outside tier 1 count as false positives. "
              "Out-of-tier-1 / not-a-real-ICD-11-code answers: "
              + "; ".join(f"{n}: {r['out_of_tier1_codes']} / {r['not_in_who_catalogue']}" for n, r in results.items()) + "."]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--providers", default="gemini,sealion", help="comma list; providers without a key are skipped")
    parser.add_argument("--variants", default="open,tier1")
    parser.add_argument("--workers", type=int, default=2, help="parallel requests (keep low on free-tier quotas)")
    parser.add_argument("--rpm", type=float, default=0, help="max requests per minute across workers (0 = unlimited); "
                        "SEA-LION free tier allows 10, so use 9")
    parser.add_argument("--update-readme", action="store_true", help="rewrite the LLM table in training/README.md")
    parser.add_argument("--show-prompt", action="store_true", help="print both prompts for the first test note and exit")
    args = parser.parse_args()
    global PACER
    PACER = Pacer(args.rpm)

    tier1 = json.loads(CATALOGUE.read_text(encoding="utf-8"))
    allowed = sorted(row["code"] for row in tier1)
    df = pd.read_csv(DATA, dtype=str, keep_default_na=False)
    test = df[df["split"] == "test"].reset_index(drop=True)
    gold = [sorted(apply_policy(parse_codes(v))) for v in test["gold_codes"]]

    if args.show_prompt:
        for variant in args.variants.split(","):
            print(f"===== {variant} =====\n{build_prompt(test['note_text'][0], variant, tier1)}\n")
        return

    load_env_file(ROOT.parent / ".env")
    providers = []
    for name in args.providers.split(","):
        _, key_var, model_var, default_model = PROVIDERS[name]
        if os.environ.get(key_var):
            providers.append((name, os.environ.get(model_var) or default_model, os.environ[key_var]))
    if not providers:
        raise SystemExit("No LLM API key found. Set GEMINI_API_KEY (and optionally GEMINI_MODEL, default gemini-3.8-flash) "
                         "in the environment or backend/.env; SEALION_API_KEY / SEALION_MODEL add SEA-LION. No results written.")

    who = load_who()
    cache = Cache(CACHE)
    results, failures, predictions = {}, {}, {}
    for provider, model, key in providers:
        for variant in args.variants.split(","):
            name = f"{provider}:{variant}"
            print(f"{name} ({model}): {len(test)} notes ...", flush=True)
            responses, errors = run_variant(cache, provider, model, key, test, variant, tier1, args.workers)
            if errors:
                failures[name] = errors
                print(f"  {len(errors)} calls failed, e.g. {errors[0]}")
                continue
            pred = [sorted(apply_policy(extract_codes(r))) for r in responses]  # same coding policy as CatatKod
            extra = sorted({c for p in pred for c in p} - set(allowed))
            classes = allowed + extra  # out-of-tier-1 answers become columns no gold note has -> false positives
            mlb = MultiLabelBinarizer(classes=classes)
            results[name] = {
                "provider": provider, "model": model, "variant": variant,
                "metrics": metrics(mlb.fit_transform(gold), mlb.transform(pred), classes),
                "out_of_tier1_codes": sum(c not in set(allowed) for p in pred for c in p),
                "not_in_who_catalogue": sum(c not in who for p in pred for c in p),
                "empty_answers": sum(not p for p in pred),
            }
            predictions[name] = [{"note_id": nid, "gold": g, "pred": p} for nid, g, p in zip(test["note_id"], gold, pred)]

    if failures:
        raise SystemExit(f"Failed calls in {', '.join(failures)}; successful responses are cached, rerun to resume. "
                         "Nothing scored or written.")

    metadata_path = ARTIFACTS / "metadata.json"
    baselines = json.loads(metadata_path.read_text())["test_results"] if metadata_path.exists() else {}
    n_codes = next(iter(results.values()))["metrics"]["codes_in_split"]
    print(f"\n== Held-out test: {len(test)} notes, {n_codes} codes present ==")
    print(f"{'system':<34}{'microP':>8}{'microR':>8}{'microF1':>9}{'macroF1':>9}{'exact':>8}")
    rows = [(k, m) for k, m in baselines.items()] + [(f"{k} ({r['model']})", r["metrics"]) for k, r in results.items()]
    for name, m in rows:
        print(f"{name:<34}{m['micro_precision']:>8.3f}{m['micro_recall']:>8.3f}{m['micro_f1']:>9.3f}"
              f"{m['macro_f1_present_codes']:>9.3f}{m['exact_match']:>8.3f}")

    RESULTS.write_text(json.dumps({
        "test_notes": len(test), "prompt_instruction": INSTRUCTION, "catalogue_suggestions_k": SEARCH_K,
        "results": results, "catatkod_results": baselines, "predictions": predictions,
        "warning": "Synthetic, unreviewed labels. Not clinically validated.",
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nSaved {RESULTS}")

    if args.update_readme:
        text = README.read_text(encoding="utf-8")
        start, end = text.find(README_START), text.find(README_END)
        if start < 0 or end < 0:
            raise SystemExit(f"README is missing the {README_START} / {README_END} markers.")
        block = f"{README_START}\n{readme_table(results, baselines, len(test), n_codes)}\n{README_END}"
        README.write_text(text[:start] + block + text[end + len(README_END):], encoding="utf-8")
        print(f"Updated {README}")


if __name__ == "__main__":
    main()
