"""Generate template-based synthetic training notes from the tier-1 lexicon.

Every generated note is fictional. Labels follow the CatatKod labelling policy:
  * code every finding / condition the note explicitly states as present;
  * do NOT code findings that are negated ("takde demam") or only suspected ("?denggi", "r/o TB").
Generated notes are for TRAINING only; evaluation uses independently written notes.
"""
from __future__ import annotations

import argparse
import csv
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from nlp.catalogue import DATA, load_lexicon  # noqa: E402
from nlp.normalise import NEGATORS  # noqa: E402

DEST = DATA / "generated_notes.csv"

OPENERS = ["", "", "", "pt dtg c/o ", "pt komplen ", "mengadu ", "datang sebab ", "S: ", "c/o ", "pt mengadu ",
           "pt {age}thn, ", "{sex} {age} thn dtg dgn ", "pesakit datang, ", "ibu bawa anak, "]
DURATIONS = ["", "", "", " {n} hari", " {n} ari", " dah {n} hari", " sejak semalam", " sejak smlm", " sejak pagi",
             " {n} minggu", " dah seminggu", " sejak minggu lepas", " {n}/7", " sejak {n} bulan", " on off", " kebelakangan ni"]
SEVERITY = ["", "", "", "", " sikit", " teruk", " sangat", " skit2", " kuat"]
HISTORY_PREFIX = ["hx ", "known ", "k/c/o ", "ada ", "sejarah ", "", "", "background ", "pmhx: "]
HISTORY_SUFFIX = ["", "", " on ubat", " on meds", " tak terkawal", " dah {n} thn", " FU klinik", " stabil"]
DX_PREFIX = ["imp: ", "imp ", "dx ", "disahkan ", "", "", "diagnosis: ", "A: "]
NEG_TEMPLATES = ["takde {p}", "tak {p}", "tiada {p}", "no {p}", "nafi {p}", "x {p}", "takda {p}", "tidak {p}", "denies {p}"]
UNC_TEMPLATES = ["?{p}", "? {p}", "r/o {p}", "suspek {p}", "kemungkinan {p}"]
JOINERS = [", ", ", ", ". ", " n ", " dan ", "; ", ", ", " + "]
CLOSERS = ["", "", "", ". BP {sys}/{dia}", ". T 37.{d}", ". mohon review dr", ". on paracetamol", ". minta MC"]
# Code-neutral context: words that also occur inside lexicon phrases ("malam", "kepala", "kuning", "kaki")
# appear here without a label, so the model cannot treat any single context word as a code.
CONTEXT = ["waktu malam", "bila bangun pagi", "lepas makan", "kahak kuning", "kat kaki kanan", "kat tangan kiri",
           "lepas jatuh", "bila jalan jauh", "masa kerja", "berat naik sikit", "tidur cukup", "makan ok", "minum ok",
           "bila toleh kepala", "kat kepala", "bila bangun berdiri", "lepas hujan", "lepas makan pedas", "bila baring",
           "kat pinggang kiri", "kat dada kanan", "selalu jadi", "makin teruk", "makin ok", "dah makan ubat",
           "belum ambil ubat", "anak sulung", "kerja shift", "lepas berenang", "lepas angkat barang", "mata kabur sikit",
           "kencing ok", "berak ok", "selera ok", "bawa surat rujukan", "ada alahan ubat", "datang dengan isteri",
           "luka kecil", "sakit sikit je", "on off", "bila naik tangga", "lepas balik kampung", "kat sekolah",
           "ubat habis", "nak refill ubat", "badan rasa tak sedap", "susah angkat tangan", "lepas main bola"]


def fill(template: str, rng: random.Random) -> str:
    return template.format(n=rng.randint(2, 6), age=rng.randint(18, 80), sex=rng.choice(["lelaki", "perempuan", "pakcik", "makcik"]),
                           sys=rng.randint(110, 170), dia=rng.randint(60, 100), d=rng.randint(0, 9))


def noisy(text: str, rng: random.Random) -> str:
    """Light, realistic noise: dropped vowels, casing, doubled letters."""
    words = text.split(" ")
    for i, w in enumerate(words):
        r = rng.random()
        if r < 0.03 and len(w) > 4:
            vowels = [j for j, ch in enumerate(w[1:-1], 1) if ch in "aeiou"]
            if vowels:
                j = rng.choice(vowels)
                words[i] = w[:j] + w[j + 1:]
        elif r < 0.05:
            words[i] = w.upper()
    return " ".join(words)


def render_positive(entry, rng: random.Random) -> str:
    phrase = rng.choice(entry.phrases)
    if entry.kind == "H":
        return fill(rng.choice(HISTORY_PREFIX) + phrase + rng.choice(HISTORY_SUFFIX), rng)
    if entry.kind == "D":
        return rng.choice(DX_PREFIX) + phrase
    return fill(phrase + rng.choice(SEVERITY) + rng.choice(DURATIONS), rng)


def negatable(phrase: str) -> bool:
    return phrase.split()[0] not in NEGATORS


def generate(n_notes: int, seed: int) -> list[dict]:
    rng = random.Random(seed)
    entries = load_lexicon()
    symptoms = [e for e in entries if e.kind == "S"]
    diagnoses = [e for e in entries if e.kind in {"D", "H"}]
    # Balanced sampling: cycle through codes so every code gets similar support.
    order: list = []
    rows = []
    for i in range(n_notes):
        if rng.random() < 0.04:
            # Notes with no codable finding (routine visits, negations only, context only).
            parts = [rng.choice(CONTEXT)] + [rng.choice(NEG_TEMPLATES).format(p=rng.choice([p for p in rng.choice(symptoms).phrases if negatable(p)] or ["demam"]))]
            text = fill(rng.choice(OPENERS), rng) + rng.choice(JOINERS).join(parts) + fill(rng.choice(CLOSERS), rng)
            rows.append({"note_id": f"GEN{i + 1:05d}", "note_text": noisy(text, rng), "gold_codes": "", "source": "generated"})
            continue
        if not order:
            order = entries[:]
            rng.shuffle(order)
        primary = order.pop()
        k = rng.choices([0, 1, 2, 3], weights=[3, 4, 2, 1])[0]
        positives = [primary] + rng.sample([e for e in entries if e.code != primary.code], k)
        labels = {e.code for e in positives}

        parts = [render_positive(e, rng) for e in positives]
        # Hard negatives: negated symptoms and uncertain diagnoses are NOT labelled.
        for _ in range(rng.choices([0, 1, 2], weights=[4, 4, 2])[0]):
            neg = rng.choice([e for e in symptoms if e.code not in labels])
            options = [p for p in neg.phrases if negatable(p)]
            if options:
                parts.append(rng.choice(NEG_TEMPLATES).format(p=rng.choice(options)))
        if rng.random() < 0.15:
            unc = rng.choice([e for e in diagnoses if e.code not in labels])
            parts.append(rng.choice(UNC_TEMPLATES).format(p=rng.choice(unc.phrases)))
        for _ in range(rng.choices([0, 1, 2], weights=[3, 5, 2])[0]):
            parts.append(rng.choice(CONTEXT))
        rng.shuffle(parts)

        text = rng.choice(JOINERS).join(parts)
        text = fill(rng.choice(OPENERS), rng) + text + fill(rng.choice(CLOSERS), rng)
        rows.append({"note_id": f"GEN{i + 1:05d}", "note_text": noisy(text, rng), "gold_codes": ";".join(sorted(labels)), "source": "generated"})
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--n", type=int, default=3000)
    parser.add_argument("--seed", type=int, default=26)
    args = parser.parse_args()
    rows = generate(args.n, args.seed)
    with DEST.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=["note_id", "note_text", "gold_codes", "source"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} generated notes -> {DEST.name}")
    for row in rows[:8]:
        print(f"  {row['note_text']!r} -> {row['gold_codes']}")


if __name__ == "__main__":
    main()
