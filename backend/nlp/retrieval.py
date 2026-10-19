"""Tier 2: search the full WHO ICD-11 MMS catalogue for codes outside the trained tier-1 set.

The WHO titles are English, so the Malay note is bridged with (a) the English titles of any
tier-1 lexicon matches and (b) a small Malay->English clinical glossary, then ranked against
every coded entry with TF-IDF. Results are candidates for the nurse to browse, never auto-codes.
"""
from __future__ import annotations

from functools import lru_cache

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

from .catalogue import load_lexicon, load_who
from .normalise import normalise

# Malay / Manglish clinical words -> English terms used in WHO titles.
GLOSSARY = {
    "sakit": "pain", "pedih": "pain burning", "bengkak": "swelling oedema", "sembab": "oedema", "gatal": "pruritus itch",
    "luka": "wound injury ulcer", "ulser": "ulcer", "ruam": "rash", "demam": "fever", "batuk": "cough", "muntah": "vomiting",
    "cirit": "diarrhoea", "darah": "blood haemorrhage", "berdarah": "haemorrhage bleeding", "nanah": "pus abscess",
    "kebas": "numbness sensation", "lemah": "weakness", "patah": "fracture", "terseliuh": "sprain", "terkehel": "dislocation",
    "jangkitan": "infection", "radang": "inflammation", "ketumbuhan": "neoplasm mass", "benjolan": "lump mass swelling",
    "kaki": "lower limb foot leg", "tangan": "hand upper limb", "lengan": "arm", "jari": "finger", "lutut": "knee",
    "bahu": "shoulder", "pinggang": "back lumbar", "belakang": "back", "leher": "neck", "kepala": "head", "muka": "face",
    "mata": "eye", "telinga": "ear", "hidung": "nose nasal", "mulut": "mouth oral", "gigi": "tooth dental", "gusi": "gingiva",
    "lidah": "tongue", "tekak": "throat pharynx", "dada": "chest", "jantung": "heart cardiac", "paru": "lung pulmonary",
    "perut": "abdomen abdominal stomach", "usus": "intestine", "hati": "liver hepatic", "buah": "", "pinggang": "kidney back",
    "kencing": "urine urinary micturition", "pundi": "bladder", "kulit": "skin", "rambut": "hair", "kuku": "nail",
    "tulang": "bone", "sendi": "joint", "otot": "muscle", "urat": "nerve vein", "saraf": "nerve", "darah tinggi": "hypertension",
    "haid": "menstruation", "period": "menstruation", "hamil": "pregnancy", "mengandung": "pregnancy", "payudara": "breast",
    "buah dada": "breast", "rahim": "uterus", "faraj": "vagina", "zakar": "penis", "testis": "testis", "dubur": "anus anal",
    "buasir": "haemorrhoids", "kurap": "dermatophytosis", "panau": "pityriasis versicolor", "kudis": "scabies",
    "bisul": "furuncle boil abscess", "ketuat": "wart", "kelemumur": "dandruff seborrhoeic", "alahan": "allergy",
    "alergi": "allergy", "sengat": "sting", "gigitan": "bite", "anjing": "dog", "ular": "snake", "tebuan": "wasp",
    "lebah": "bee", "terbakar": "burn", "melecur": "burn", "jatuh": "fall", "kemalangan": "accident", "motor": "motorcycle",
    "kuning": "jaundice yellow", "pengsan": "syncope", "sawan": "seizure convulsion epilepsy febrile", "kejang": "spasm seizure",
    "pekak": "hearing loss deafness", "kabur": "blurred vision", "buta": "blindness", "rabun": "visual impairment",
    "berdengung": "tinnitus", "bernanah": "suppurative pus", "bisa": "venom poisoning", "keracunan": "poisoning",
    "tidur": "sleep", "cemas": "anxiety", "murung": "depressive", "sedih": "depressive mood", "stres": "stress",
    "berat": "weight", "kurus": "underweight", "gemuk": "obesity", "tiroid": "thyroid", "kelenjar": "gland lymph node",
    "tumit": "heel", "tapak": "sole", "buku lali": "ankle", "siku": "elbow", "pergelangan": "wrist", "punggung": "buttock hip",
    "peha": "thigh", "betis": "lower leg calf", "dahi": "forehead", "rahang": "jaw", "bibir": "lip", "anak": "child",
}
# Chapters / title markers that are not diagnosis codes for a primary-care note.
EXCLUDE_CHAPTERS = {"26", "X", "V"}  # traditional medicine, extension codes, functioning


def _english_query(note: str) -> str:
    text = normalise(note)
    words = [w for w in text.split() if not w.startswith(("neg_", "unc_"))]
    joined = " ".join(words)
    terms = [eng for ms, eng in GLOSSARY.items() if eng and (f" {ms} " in f" {joined} ")]
    from .rules import default_matcher
    terms += [default_matcher().entries[m["code"]].title_en for m in default_matcher().match(note)]
    terms += [w for w in words if w.isascii() and len(w) > 3]  # English words written directly in the note
    return " ".join(terms)


class CatalogueSearch:
    def __init__(self):
        who = load_who()
        tier1 = {e.code for e in load_lexicon()}
        self.rows = [r for code, r in who.items()
                     if r["chapter_no"] not in EXCLUDE_CHAPTERS and "(TM" not in r["title_clean"]]
        self.codes = [r["code"] for r in self.rows]
        self.titles = [r["title_clean"] for r in self.rows]
        self.tier1 = tier1
        self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, stop_words="english")
        self.matrix = self.vectorizer.fit_transform(self.titles)
        # Prefer leaf codes and shallower "unspecified" entries a little, so vague notes land on codable leaves.
        self.prior = np.array([1.0 + (0.05 if r["is_leaf"] == "True" else 0) for r in self.rows])

    def search(self, note_or_query: str, k: int = 10, translate: bool = True) -> list[dict]:
        query = _english_query(note_or_query) if translate else note_or_query
        if not query.strip():
            return []
        scores = (self.matrix @ self.vectorizer.transform([query]).T).toarray().ravel() * self.prior
        top = np.argsort(-scores)[:k]
        return [{"code": self.codes[i], "labelEn": self.titles[i], "score": round(float(scores[i]), 3),
                 "tier1": self.codes[i] in self.tier1} for i in top if scores[i] > 0]


@lru_cache(maxsize=1)
def default_search() -> CatalogueSearch:
    return CatalogueSearch()


if __name__ == "__main__":
    s = default_search()
    print(f"indexed {len(s.codes)} ICD-11 codes")
    for q in ["gigitan anjing kat betis kanan", "telinga berdengung dan pekak sebelah", "bisul bernanah kat punggung",
              "panau kat belakang badan", "tulang patah pergelangan tangan lepas jatuh motor", "sawan masa demam, budak 2 thn"]:
        print(f"\n{q!r}  [query: {_english_query(q)}]")
        for hit in s.search(q, k=5):
            print(f"   {hit['code']:<10} {hit['score']:.3f}  {hit['labelEn']}")
