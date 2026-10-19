"""Feature extraction shared by training and inference (module-level so models pickle cleanly)."""
from __future__ import annotations

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import FeatureUnion


def affirmed_only(text: str) -> str:
    """Drop negated/uncertain tokens so character n-grams of 'neg_demam' cannot look like 'demam'."""
    return " ".join(t for t in text.split() if not t.startswith(("neg_", "unc_")))


def word_tokens(text: str) -> list[str]:
    return text.split()


def build_features() -> FeatureUnion:
    return FeatureUnion([
        # Word uni/bigrams keep the neg_/unc_ markers, so the model can learn "neg_demam" != "demam".
        ("word", TfidfVectorizer(tokenizer=word_tokens, token_pattern=None, lowercase=False, ngram_range=(1, 2),
                                 sublinear_tf=True, min_df=1)),
        # Character n-grams on affirmed tokens give robustness to typos ("pesakt", "kencng").
        ("char", TfidfVectorizer(analyzer="char_wb", preprocessor=affirmed_only, ngram_range=(2, 5),
                                 sublinear_tf=True, min_df=2)),
    ])
