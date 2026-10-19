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


EMBED_MODEL = "intfloat/multilingual-e5-small"
_EMBED_CACHE: dict[str, object] = {}  # shared across instances: text -> vector
_MODELS: dict[str, object] = {}


class EmbeddingFeatures:
    """Sentence embeddings from a small multilingual model (scikit-learn transformer).

    Captures meaning beyond exact words ("breathing difficulty" ~ "SOB"). Negated/uncertain tokens are
    removed first (affirmed_only) so "neg_demam" doesn't look like fever. The model loads lazily and is not
    pickled; embeddings are cached in memory by text.
    """

    def __init__(self, model_name: str = EMBED_MODEL, weight: float = 1.0):
        self.model_name = model_name
        self.weight = weight
        self._cache = _EMBED_CACHE

    def __getstate__(self):
        return {"model_name": self.model_name, "weight": self.weight}

    def __setstate__(self, state):
        self.__init__(**state)

    def get_params(self, deep=True):
        return {"model_name": self.model_name, "weight": self.weight}

    def set_params(self, **params):
        for k, v in params.items():
            setattr(self, k, v)
        return self

    def fit(self, X, y=None):
        return self

    def _encode(self, texts):
        import numpy as np
        missing = [t for t in dict.fromkeys(texts) if t not in self._cache]
        if missing:
            if self.model_name not in _MODELS:
                from sentence_transformers import SentenceTransformer
                _MODELS[self.model_name] = SentenceTransformer(self.model_name, device="cpu")
            vecs = _MODELS[self.model_name].encode(["query: " + t for t in missing], batch_size=64, normalize_embeddings=True)
            self._cache.update(zip(missing, vecs))
        return np.vstack([self._cache[t] for t in texts])

    def transform(self, X):
        from scipy.sparse import csr_matrix
        texts = [affirmed_only(t).replace("_", " ") for t in X]
        return csr_matrix(self._encode(texts) * self.weight)

    def fit_transform(self, X, y=None):
        return self.transform(X)


def build_features_with_embeddings(weight: float = 1.0) -> FeatureUnion:
    union = build_features()
    union.transformer_list.append(("embed", EmbeddingFeatures(weight=weight)))
    return union
