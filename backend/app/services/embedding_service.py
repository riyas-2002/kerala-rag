"""
Kerala RAG — Embedding Service
Uses local sentence-transformers (all-MiniLM-L6-v2) — NO paid API.
Embeddings are cached to disk to survive cold starts.
"""
import os
import pickle
import hashlib
from typing import List, Optional
import numpy as np
from loguru import logger

from app.core.config import settings

# Lazy-load the model so cold starts don't time out on Render
_model = None


def _get_model():
    global _model
    if _model is None:
        logger.info(f"Loading embedding model: {settings.embedding_model}")
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(settings.embedding_model, device="cpu")
        logger.info("Embedding model loaded.")
    return _model


class EmbeddingService:
    """
    Wraps SentenceTransformer with disk-based caching.
    Cache key = MD5 of the input text.
    """

    def __init__(self):
        self.cache_path = os.path.join(settings.cache_dir, "embedding_cache.pkl")
        self._cache: dict = {}
        self._load_cache()

    def _load_cache(self):
        if os.path.exists(self.cache_path):
            try:
                with open(self.cache_path, "rb") as f:
                    self._cache = pickle.load(f)
                logger.info(f"Embedding cache loaded: {len(self._cache)} entries")
            except Exception as e:
                logger.warning(f"Could not load embedding cache: {e}")
                self._cache = {}

    def _save_cache(self):
        try:
            with open(self.cache_path, "wb") as f:
                pickle.dump(self._cache, f, protocol=pickle.HIGHEST_PROTOCOL)
        except Exception as e:
            logger.warning(f"Could not save embedding cache: {e}")

    def _cache_key(self, text: str) -> str:
        return hashlib.md5(text.encode("utf-8")).hexdigest()

    def embed_texts(self, texts: List[str], batch_size: int = 32) -> np.ndarray:
        """
        Embed a list of texts. Uses cache for already-seen texts.
        Returns numpy array of shape (N, embedding_dim).
        """
        model = _get_model()

        # Split into cached and uncached
        keys = [self._cache_key(t) for t in texts]
        uncached_indices = [i for i, k in enumerate(keys) if k not in self._cache]
        uncached_texts = [texts[i] for i in uncached_indices]

        if uncached_texts:
            logger.info(f"Embedding {len(uncached_texts)} new texts...")
            new_embeddings = model.encode(
                uncached_texts,
                batch_size=batch_size,
                show_progress_bar=False,
                convert_to_numpy=True,
                normalize_embeddings=True,
            )
            for idx, emb in zip(uncached_indices, new_embeddings):
                self._cache[keys[idx]] = emb
            self._save_cache()

        # Assemble in original order
        result = np.array([self._cache[k] for k in keys])
        return result

    def embed_query(self, query: str) -> np.ndarray:
        """Embed a single query string. Returns 1-D numpy array."""
        return self.embed_texts([query])[0]

    @property
    def embedding_dim(self) -> int:
        return _get_model().get_sentence_embedding_dimension()


# Singleton
embedding_service = EmbeddingService()
