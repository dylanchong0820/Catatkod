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
    "mkn": "makan", "ckp": "cakap", "doc": "doktor", "dr": "doktor", "cnfrm": "sahkan", "confirm": "sahkan",
    "sdh": "dah", "bg": "bagi", "jg": "juga", "jgk": "juga", "dm1": "t1dm", "pnemonia": "pneumonia",
    "h/o": "sejarah", "pmh": "sejarah", "k/c/o": "known", "c/w": "consistent", "can't": "cannot",
    "freq": "frequent", "wt": "weight", "infxn": "infection", "inf": "infection", "bs": "sugar",
    "d&v": "diarrhoea vomiting", "n&v": "nausea vomiting", "abd": "abdominal", "sx": "symptoms",
}

# Words that open a negation scope. Multi-word negators are joined first.
NEGATORS = {"tak", "tidak", "tiada", "takde", "takda", "xde", "xda", "x", "tk", "tade", "no", "nafi",
            "denies", "deny", "bukan", "tanpa", "tiade", "neg", "nil", "-ve",
            "denied", "without", "cannot", "unable", "absent", "never"}
MULTI_NEGATORS = [(r"\btak\s+ada\b", "takde"), (r"\btidak\s+ada\b", "takde"), (r"\bno\s+history\s+of\b", "no"),
                  (r"\bnegative\s+for\b", "no"), (r"\bno\s+h/o\b", "no"), (r"\bno\s+c/o\b", "no"),
                  (r"\b(?:ruled|rules)\s+out\b", "absent"), (r"\bnot\s+present\b", "absent"),
                  (r"\bto\s+rule\s+out\b", "r/o"), (r"\brule\s+out\b", "r/o")]
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
    text = re.sub(r"\+{2,}", " ", text)  # emphasis: "bengkak ++", "sweating+++"
    text = re.sub(r"(?<=[a-z])-(?=[a-z])", " ", text)  # "flu-like" -> "flu like" (keeps "covid-19")
    text = re.sub(r"\b([a-z]{3,})/(?=[a-z]{3,}\b)", r"\1 ", text)  # "heavy/irregular" -> "heavy irregular" (keeps c/o, h/o)
    text = re.sub(r"(?<=[a-z0-9])\+(?=[\s,.;:)]|$)", " positif", text)  # "covid+", "ns1+" = positive
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
    for i, tok in enumerate(tokens):
        if tok in NEGATORS:
            nxt = tokens[i + 1] if i + 1 < len(tokens) else None
            if nxt is None or nxt in SCOPE_BREAK:
                # Post-negation, common in Malay: "kencing manis xde", "demam takde." negates the words before it.
                j, n = len(out) - 1, 0
                while j >= 0 and n < MAX_SCOPE and out[j] not in SCOPE_BREAK:
                    if not out[j].startswith(("neg_", "unc_")):
                        out[j] = "neg_" + out[j]
                    j, n = j - 1, n + 1
                continue
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
        "Sakit jantung ada, history kencing manis xde. COVID+, bengkak ++",
    ]:
        print(f"{sample!r}\n  -> {normalise(sample)}")
