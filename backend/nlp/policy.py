"""Coding policy: don't code symptoms that are an integral part of a coded diagnosis.

ICD coding convention: signs and symptoms routinely associated with a confirmed diagnosis are not coded
separately (scabies + itching -> scabies only). A more specific finding also replaces its general form
(vertigo -> not also dizziness). Applied to gold labels and predictions alike, so both follow one policy.

DRAFT clinical mapping: needs review by a clinician / certified coder before real use.
"""
from __future__ import annotations

INTEGRAL: dict[str, set[str]] = {
    # Skin
    "1G04.Z": {"EC90.Z", "ME66.6Z"},                 # scabies: itching, rash
    "1F28.Z": {"EC90.Z", "ME66.6Z"},                 # dermatophytosis
    "EA80.Z": {"EC90.Z", "ME66.6Z"},                 # atopic eczema
    "EB00.Z": {"EC90.Z", "ME66.6Z"},                 # urticaria
    "1E90.Z": {"ME66.6Z", "EC90.Z", "MG26"},         # varicella
    "1F03": {"ME66.6Z", "MG26", "MC15", "MD12"},     # measles
    "1E91.Z": {"ME66.6Z"},                           # zoster
    "1B72.Z": {"ME66.6Z"},                           # impetigo
    # Eye / ear / ENT
    "9A60.Z": {"MC15"},                              # conjunctivitis: red eye
    "AA90": {"AB70.2"},                              # acute otitis media: ear pain
    "AA3Z": {"AB70.2", "EC90.Z"},                    # otitis externa
    "CA02.Z": {"MD36.0"},                            # pharyngitis: sore throat
    "CA03.Z": {"MD36.0"},                            # tonsillitis
    "CA00": {"MD36.0"},                              # common cold
    "CA07.0": {"MD36.0", "MD12", "MG26"},            # URTI
    "CA01": {"MB4D"},                                # sinusitis: headache / facial pain
    # Respiratory
    "CA42.Z": {"MD12", "MD11.C"},                    # acute bronchitis
    "CA40.Z": {"MD12", "MG26", "MD11.5"},            # pneumonia
    "CA23": {"MD11.C", "MD11.5", "MD12"},            # asthma
    "CA22.Z": {"MD11.5", "MD12", "MD11.C"},          # COPD
    "1E32": {"MG26", "FB56.2", "MD12", "MD36.0"},    # influenza
    "RA01": {"MG26", "MD12", "MD36.0", "FB56.2"},    # COVID-19
    "1B10.Z": {"MD12"},                              # pulmonary TB
    # Infections / GI
    "1D2Z": {"MG26", "FB56.2", "ME82", "MB4D", "ME66.6Z"},  # dengue
    "1A40.Z": {"ME05.1", "MD90.1", "MD90.0", "MD81.4"},     # gastroenteritis
    "DA22.Z": {"MD95"},                              # GERD: heartburn
    "DA42.Z": {"MD95", "MD81.4"},                    # gastritis
    "DA60.Z": {"MD95", "MD81.4"},                    # gastric ulcer
    # Urinary
    "GC08.Z": {"MF50.7", "MF50.0"},                  # UTI: dysuria, frequency
    "GB70.0Z": {"ME84.2Z", "MF50.4Z"},               # kidney stone: flank pain, haematuria
    # Neuro / MSK
    "8A80.Z": {"MB4D", "MD90.0"},                    # migraine: headache, nausea
    "8C10.0": {"MB40.Z"},                            # carpal tunnel: numbness
    "FA25": {"ME82"},                                # gout: joint pain
    "FA01.Z": {"ME82"},                              # knee OA
    "FB53.0": {"ME82"},                              # frozen shoulder
    "FB40.1": {"FB56.4"},                            # plantar fasciitis
    "ME84.3": {"ME84.2Z"},                           # sciatica covers low back pain
    # Metabolic / other
    "5A21.Z": {"ME66.5"},                            # hypoglycaemia: sweating
    "5A02.Z": {"MC81.2"},                            # thyrotoxicosis: palpitations
    "BD10": {"MG29.01", "MD11.5"},                   # heart failure: leg oedema, breathlessness
    "3A00.Z": {"MG22"},                              # iron-deficiency anaemia: fatigue
    "GA34.3": {"MD81.4"},                            # dysmenorrhoea: abdominal pain
    # Specific symptom replaces its general form
    "MB48.0Z": {"MB48.Z"},                           # vertigo -> not also dizziness
    "MD30.0": {"MD30.Z"},                            # pleuritic chest pain -> not also chest pain
}


def apply(codes) -> set[str]:
    """Drop codes covered by another code in the same set."""
    codes = set(codes)
    covered = set().union(*(INTEGRAL.get(c, set()) for c in codes)) if codes else set()
    return codes - covered


def covered_by(codes) -> dict[str, str]:
    """For the UI: {suppressed symptom code: the diagnosis code that covers it}."""
    codes = set(codes)
    return {s: d for d in codes for s in INTEGRAL.get(d, set()) if s in codes}
