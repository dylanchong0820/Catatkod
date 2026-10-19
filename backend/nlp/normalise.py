"""Custom preprocessing for colloquial Malay / Manglish clinical shorthand.

Used identically at training and inference time so the classifier always sees the
same representation. Steps:
  1. lowercase, split reduplication ("sikit2" -> "sikit sikit")
  2. expand shorthand and fix common informal spellings ("ari" -> "hari")
  3. mark negation scope: "takde demam, cuma batuk" -> "neg_demam , cuma batuk"
"""
from __future__ import annotations

import re

# Token-level shorthand expansion. Keys are already-lowercased tokens.
SHORTHAND = {
    "pt": "pesakit", "pesakit": "pesakit", "dtg": "datang", "dtng": "datang",
    "hx": "sejarah", "c/o": "mengadu", "co": "mengadu", "komplen": "mengadu", "complain": "mengadu",
    "ari": "hari", "hri": "hari", "hr": "hari", "mgu": "minggu", "mggu": "minggu", "bln": "bulan",
    "smlm": "semalam", "smalam": "semalam", "mlm": "malam", "ptg": "petang", "pg": "pagi",
    "dgn": "dengan", "dlm": "dalam", "sbb": "sebab", "skt": "sakit", "sakt": "sakit",
    "kpl": "kepala", "tgn": "tangan", "prt": "perut", "kncg": "kencing", "kcg": "kencing",
    "dh": "dah", "sudah": "dah", "je": "sahaja", "jer": "sahaja", "jee": "sahaja", "aje": "sahaja",
    "lps": "lepas", "lpas": "lepas", "blh": "boleh", "bnyk": "banyak", "byk": "banyak",
    "skrg": "sekarang", "tp": "tapi", "tpi": "tapi", "tetapi": "tapi", "n": "dan", "&": "dan", "+": "dan",
    "kanak2": "kanak kanak", "ngan": "dengan", "sgt": "sangat", "sngt": "sangat",
    "btk": "batuk", "dmm": "demam", "deman": "demam", "selsema": "selesema", "athma": "asma",
    "sob": "sesak nafas", "dm2": "dm", "t2dm": "dm", "htn": "hpt",
}

# Words that open a negation scope. Multi-word negators are joined first.
NEGATORS = {"tak", "tidak", "tiada", "takde", "takda", "xde", "xda", "x", "tk", "tade", "no", "nafi",
            "denies", "deny", "bukan", "tanpa", "tiade", "neg", "nil", "-ve"}
MULTI_NEGATORS = [(r"\btak\s+ada\b", "takde"), (r"\btidak\s+ada\b", "takde"), (r"\bno\s+history\s+of\b", "no")]
# Uncertainty markers: findings are not coded when only suspected / to be ruled out.
UNCERTAIN = {"?", "r/o", "suspek", "suspect", "kemungkinan", "mungkin", "query", "ruleout"}

# Tokens that close a negation scope.
SCOPE_BREAK = {",", ".", ";", ":", "tapi", "cuma", "tetapi", "but", "dan", "and", "sahaja", "sejak", "bila",
               "lepas", "masa", "waktu", "dah", "hari", "minggu", "bulan", "/", "-", "pun"}
MAX_SCOPE = 3

TOKEN_RE = re.compile(r"[a-z0-9/&+\-]+(?:'[a-z]+)?|[?,.;:]")


def _split_reduplication(text: str) -> str:
    # "sikit2" -> "sikit sikit"; leave numbers like "3" or codes like "covid-19" alone.
    return re.sub(r"\b([a-z]{2,})2\b", r"\1 \1", text)


def tokenize(text: str) -> list[str]:
    text = text.lower()
    text = text.replace("-ve", " neg ").replace("+ve", " positif ")
    for pattern, repl in MULTI_NEGATORS:
        text = re.sub(pattern, repl, text)
    text = _split_reduplication(text)
    text = re.sub(r"(\d+)\s*/\s*(\d+)", r"\1_\2", text)  # keep BP readings together: 150/90
    tokens = TOKEN_RE.findall(text)
    out: list[str] = []
    for tok in tokens:
        expanded = SHORTHAND.get(tok, tok)
        out.extend(expanded.split())
    return out


def normalise(text: str) -> str:
    """Return the normalised, negation-marked string fed to the classifier."""
    tokens = tokenize(text)
    out: list[str] = []
    scope = 0
    prefix = ""
    for tok in tokens:
        if tok in NEGATORS:
            scope, prefix = MAX_SCOPE, "neg_"
            continue
        if tok in UNCERTAIN:
            scope, prefix = MAX_SCOPE, "unc_"
            continue
        if tok in SCOPE_BREAK:
            scope = 0
            out.append(tok)
            continue
        if scope > 0:
            out.append(prefix + tok)
            scope -= 1
        else:
            out.append(tok)
    return " ".join(out)


def expand(text: str) -> str:
    """Readable expansion for the UI (no negation markers)."""
    return " ".join(tokenize(text))


if __name__ == "__main__":
    for sample in [
        "pt dtg komplen kencing berbuih, kaki bengkak 3 ari, hx kencing manis",
        "takde demam, tak batuk, cuma sakit badan",
        "tak demam tapi tekak sakit bila telan",
        "asyik kencing, tapi keluar sikit2",
        "?denggi, r/o UTI. no SOB",
    ]:
        print(f"{sample!r}\n  -> {normalise(sample)}")
