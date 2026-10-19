"""Lexicon matching over normalised notes (the deterministic layer of CatatKod).

Because matching runs on normalise() output, negated ("neg_demam") and uncertain
("unc_denggi") tokens never match a phrase, so negation is respected for free.
"""
from __future__ import annotations

import re
from functools import lru_cache

from .catalogue import LexiconEntry, load_lexicon, load_who
from .normalise import normalise


class LexiconMatcher:
    def __init__(self, entries: list[LexiconEntry]):
        self.entries = {e.code: e for e in entries}
        # (normalised phrase tokens, raw phrase, code), longest phrases first so evidence spans prefer specific matches.
        self.patterns = sorted(
            ((tuple(normalise(p).split()), p, e.code) for e in entries for p in e.phrases),
            key=lambda item: -len(item[0]),
        )

    def match(self, note: str) -> list[dict]:
        tokens = normalise(note).split()
        found: dict[str, dict] = {}
        for pattern, raw, code in self.patterns:
            if code in found or not pattern:
                continue
            n = len(pattern)
            if any(tuple(tokens[i:i + n]) == pattern for i in range(len(tokens) - n + 1)):
                found[code] = {"code": code, "phrase": raw, **self._span(note, raw)}
        return list(found.values())

    def codes(self, note: str) -> set[str]:
        return {m["code"] for m in self.match(note)}

    @staticmethod
    def _span(note: str, phrase: str) -> dict:
        """Best-effort character span of the phrase in the original note, for UI highlighting."""
        words = [re.escape(w) for w in re.sub(r"2\b", "", phrase).split()]
        if not words:
            return {"start": None, "end": None, "evidence": None}
        m = re.search(r"\b" + r"\W+".join(words), note, re.IGNORECASE)
        if not m:
            return {"start": None, "end": None, "evidence": None}
        return {"start": m.start(), "end": m.end(), "evidence": note[m.start():m.end()]}


def naive_keyword_codes(note: str, entries: list[LexiconEntry]) -> set[str]:
    """Plain substring matching with no normalisation or negation: the 'before' baseline."""
    lower = note.lower()
    return {e.code for e in entries if any(p in lower for p in e.phrases)}


@lru_cache(maxsize=1)
def default_matcher() -> LexiconMatcher:
    return LexiconMatcher(load_lexicon(who=load_who()))
