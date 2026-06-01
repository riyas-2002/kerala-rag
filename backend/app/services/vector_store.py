"""
Kerala RAG — FAISS Vector Store Service
Stores embeddings + metadata on disk. Fully free, no paid DB.
Supports add, search, persist, and reload.
"""
import os
import pickle
from typing import List, Dict, Optional, Tuple
import numpy as np
from loguru import logger

from app.core.config import settings
from app.services.embedding_service import embedding_service
from app.services.document_processor import DocumentChunk


class FAISSVectorStore:
    """
    FAISS-backed vector store persisted to disk.
    Index file: faiss_index/index.faiss
    Metadata:   faiss_metadata.pkl  (list of DocumentChunk dicts)
    """

    def __init__(self):
        self.index_file = os.path.join(settings.faiss_index_path, "index.faiss")
        self.metadata_file = settings.faiss_metadata_path
        self._index = None
        self._metadata: List[Dict] = []
        self._load()

    # ------------------------------------------------------------------ #
    #  Persistence                                                         #
    # ------------------------------------------------------------------ #

    def _load(self):
        """Load existing index and metadata from disk if present."""
        import faiss
        if os.path.exists(self.index_file) and os.path.exists(self.metadata_file):
            try:
                self._index = faiss.read_index(self.index_file)
                with open(self.metadata_file, "rb") as f:
                    self._metadata = pickle.load(f)
                logger.info(
                    f"FAISS index loaded: {self._index.ntotal} vectors, "
                    f"{len(self._metadata)} metadata entries"
                )
            except Exception as e:
                logger.warning(f"Failed to load FAISS index: {e}. Starting fresh.")
                self._index = None
                self._metadata = []
        else:
            logger.info("No existing FAISS index found. Will create on first ingest.")

    def _save(self):
        """Persist index and metadata to disk."""
        import faiss
        try:
            os.makedirs(settings.faiss_index_path, exist_ok=True)
            faiss.write_index(self._index, self.index_file)
            with open(self.metadata_file, "wb") as f:
                pickle.dump(self._metadata, f, protocol=pickle.HIGHEST_PROTOCOL)
            logger.info(f"FAISS index saved: {self._index.ntotal} vectors")
        except Exception as e:
            logger.error(f"Failed to save FAISS index: {e}")

    # ------------------------------------------------------------------ #
    #  Indexing                                                            #
    # ------------------------------------------------------------------ #

    def build_index(self, chunks: List[DocumentChunk]) -> int:
        """
        Build (or rebuild) the FAISS index from a list of DocumentChunks.
        Returns number of vectors indexed.
        """
        import faiss

        if not chunks:
            logger.warning("No chunks provided to build_index.")
            return 0

        texts = [c.text for c in chunks]
        logger.info(f"Computing embeddings for {len(texts)} chunks...")
        embeddings = embedding_service.embed_texts(texts, batch_size=64)

        dim = embeddings.shape[1]
        # Use IndexFlatIP (inner product) for cosine similarity with normalized vecs
        self._index = faiss.IndexFlatIP(dim)
        self._index.add(embeddings.astype(np.float32))
        self._metadata = [c.to_dict() for c in chunks]

        self._save()
        logger.info(f"FAISS index built with {self._index.ntotal} vectors (dim={dim})")
        return self._index.ntotal

    def add_chunks(self, chunks: List[DocumentChunk]) -> int:
        """Incrementally add new chunks to an existing index."""
        import faiss

        if not chunks:
            return 0

        texts = [c.text for c in chunks]
        embeddings = embedding_service.embed_texts(texts, batch_size=64)

        if self._index is None:
            dim = embeddings.shape[1]
            self._index = faiss.IndexFlatIP(dim)

        self._index.add(embeddings.astype(np.float32))
        self._metadata.extend([c.to_dict() for c in chunks])
        self._save()
        logger.info(f"Added {len(chunks)} chunks. Total: {self._index.ntotal}")
        return len(chunks)

    # ------------------------------------------------------------------ #
    #  Retrieval                                                           #
    # ------------------------------------------------------------------ #

    def search(
        self,
        query: str,
        top_k: Optional[int] = None,
        category_filter: Optional[str] = None,
        threshold: Optional[float] = None,
    ) -> List[Dict]:
        """
        Semantic search. Returns list of metadata dicts with 'score' added.
        """
        if self._index is None or self._index.ntotal == 0:
            logger.warning("FAISS index is empty. Run /api/ingest first.")
            return []

        top_k = top_k or settings.top_k_chunks
        threshold = threshold or settings.similarity_threshold

        query_emb = embedding_service.embed_query(query)
        query_emb = query_emb.astype(np.float32).reshape(1, -1)

        # Retrieve more than top_k to allow post-filtering
        fetch_k = min(top_k * 4, self._index.ntotal)
        scores, indices = self._index.search(query_emb, fetch_k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx == -1:
                continue
            if float(score) < threshold:
                continue
            meta = dict(self._metadata[idx])
            meta["score"] = float(score)

            # Category filter
            if category_filter:
                cat = meta.get("category", "")
                if category_filter.lower() not in cat.lower():
                    continue

            results.append(meta)
            if len(results) >= top_k:
                break

        return results

    # ------------------------------------------------------------------ #
    #  Stats                                                               #
    # ------------------------------------------------------------------ #

    @property
    def total_vectors(self) -> int:
        if self._index is None:
            return 0
        return self._index.ntotal

    def get_stats(self) -> Dict:
        categories: Dict[str, int] = {}
        sources: set = set()
        for m in self._metadata:
            cat = m.get("category", "Unknown")
            categories[cat] = categories.get(cat, 0) + 1
            sources.add(m.get("source_file", ""))

        return {
            "total_vectors": self.total_vectors,
            "total_documents": len(sources),
            "total_chunks": len(self._metadata),
            "categories": categories,
        }


# Singleton
vector_store = FAISSVectorStore()
