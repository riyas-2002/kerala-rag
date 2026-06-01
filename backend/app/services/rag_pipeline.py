"""
Kerala RAG — RAG Pipeline
Orchestrates retrieval → context assembly → LLM generation.
Includes query caching and business-type mapping augmentation.
"""
import json
import hashlib
import os
import pickle
import time
from typing import AsyncGenerator, List, Dict, Optional
from loguru import logger

from app.core.config import settings
from app.services.vector_store import vector_store
from app.services.llm_service import llm_service

# ---------------------------------------------------------------------------
# Business Type Mapping
# ---------------------------------------------------------------------------
# Hard-coded fallback. Users can override by placing JSON files in
# data/kerala_rag/business_maps/
DEFAULT_BUSINESS_MAP = {
    "restaurant": {
        "licenses": ["Trade License (Municipality)", "FSSAI License", "Fire NOC", "GST Registration"],
        "optional": ["Liquor License (BEVCO)", "Music License"],
        "departments": ["Local Body / Municipality", "FSSAI State Office", "Kerala Fire & Rescue Services", "GST Department"],
    },
    "hotel": {
        "licenses": ["Trade License", "Fire NOC", "FSSAI", "Tourism Department Registration", "GST Registration"],
        "departments": ["Municipality", "Fire & Rescue", "FSSAI", "Kerala Tourism"],
    },
    "factory": {
        "licenses": [
            "Factory License (Factories Act 1948)",
            "Pollution Control Board NOC (Consent to Establish + Operate)",
            "Labour Registration",
            "Fire NOC",
            "GST Registration",
        ],
        "departments": ["Directorate of Factories & Boilers", "Kerala PCB", "Labour Department", "Fire & Rescue"],
    },
    "msme": {
        "licenses": ["Udyam Registration (MSME)", "Trade License", "GST Registration"],
        "optional": ["NSIC Registration", "Coir Board Registration (if applicable)"],
        "departments": ["MSME Development Institute", "Local Body", "GST Department"],
    },
    "pharmacy": {
        "licenses": ["Drug License (Form 20/21)", "Trade License", "GST Registration"],
        "departments": ["Kerala State Drugs Control Department", "Local Body"],
    },
    "petrol_pump": {
        "licenses": ["NOC from Petroleum & Explosives Safety Organisation (PESO)", "Trade License", "Fire NOC", "PCB NOC"],
        "departments": ["PESO", "Local Body", "Fire & Rescue", "Kerala PCB"],
    },
    "construction": {
        "licenses": ["Building Permit", "Environmental Clearance (if >20,000 sqm)", "Labour License", "GST Registration"],
        "departments": ["Local Self-Government", "Kerala SEIAA", "Labour Department"],
    },
    "it_company": {
        "licenses": ["Trade License", "GST Registration", "Shops & Establishments Registration"],
        "optional": ["Software Technology Park (STPI) Registration"],
        "departments": ["Local Body", "Labour Department (Shops Act)"],
    },
}


def _load_business_maps() -> Dict:
    """Load and merge user-provided business map JSONs."""
    combined = dict(DEFAULT_BUSINESS_MAP)
    bm_dir = os.path.join(settings.documents_path, "business_maps")
    if not os.path.exists(bm_dir):
        return combined
    for fname in os.listdir(bm_dir):
        if fname.endswith(".json"):
            try:
                path = os.path.join(bm_dir, fname)
                data = json.loads(open(path).read())
                combined.update(data)
            except Exception as e:
                logger.warning(f"Could not load business map {fname}: {e}")
    return combined


def _match_business_type(query: str, business_maps: Dict) -> Optional[Dict]:
    """Simple keyword match against known business types."""
    q_lower = query.lower()
    for btype, info in business_maps.items():
        if btype.replace("_", " ") in q_lower or btype in q_lower:
            return {"business_type": btype, **info}
    return None


# ---------------------------------------------------------------------------
# Response Cache
# ---------------------------------------------------------------------------

class ResponseCache:
    def __init__(self):
        self.cache_file = os.path.join(settings.cache_dir, "response_cache.pkl")
        self._cache: Dict = {}
        self._load()

    def _load(self):
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, "rb") as f:
                    self._cache = pickle.load(f)
            except Exception:
                self._cache = {}

    def _save(self):
        try:
            with open(self.cache_file, "wb") as f:
                pickle.dump(self._cache, f, protocol=pickle.HIGHEST_PROTOCOL)
        except Exception:
            pass

    def get(self, key: str) -> Optional[str]:
        entry = self._cache.get(key)
        if entry and (time.time() - entry["ts"]) < settings.cache_ttl_seconds:
            return entry["response"]
        return None

    def set(self, key: str, response: str):
        self._cache[key] = {"response": response, "ts": time.time()}
        # Keep cache bounded
        if len(self._cache) > 500:
            oldest = sorted(self._cache.items(), key=lambda x: x[1]["ts"])[:100]
            for k, _ in oldest:
                del self._cache[k]
        self._save()


response_cache = ResponseCache()


# ---------------------------------------------------------------------------
# RAG Pipeline
# ---------------------------------------------------------------------------

class RAGPipeline:

    def __init__(self):
        self.business_maps = _load_business_maps()

    def _cache_key(self, query: str, category: Optional[str]) -> str:
        raw = f"{query.lower().strip()}|{category or ''}"
        return hashlib.md5(raw.encode()).hexdigest()

    def retrieve(
        self,
        query: str,
        top_k: Optional[int] = None,
        category_filter: Optional[str] = None,
    ) -> Dict:
        """
        Retrieve relevant chunks + business mapping context.
        Returns structured context dict.
        """
        # Vector search
        chunks = vector_store.search(
            query=query,
            top_k=top_k or settings.top_k_chunks,
            category_filter=category_filter,
        )

        # Augment with business type mapping
        business_context = _match_business_type(query, self.business_maps)

        return {
            "chunks": chunks,
            "business_context": business_context,
            "query": query,
        }

    async def stream_answer(
        self,
        query: str,
        chat_history: Optional[List[Dict]] = None,
        category_filter: Optional[str] = None,
        top_k: Optional[int] = None,
        use_cache: bool = True,
    ) -> AsyncGenerator[str, None]:
        """
        Full RAG pipeline: retrieve → assemble → stream LLM response.
        Yields SSE-formatted chunks.
        """
        cache_key = self._cache_key(query, category_filter)

        # Check cache (only for non-chat, standalone queries)
        if use_cache and not chat_history:
            cached = response_cache.get(cache_key)
            if cached:
                logger.info("Cache hit for query.")
                yield f"data: {json.dumps({'type': 'token', 'content': cached})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                return

        # Retrieve
        context = self.retrieve(query, top_k=top_k, category_filter=category_filter)
        chunks = context["chunks"]
        business_ctx = context["business_context"]

        # Emit sources to frontend immediately
        sources = self._format_sources(chunks)
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources, 'business_context': business_ctx})}\n\n"

        # Augment query with business context if found
        augmented_query = query
        if business_ctx:
            btype = business_ctx.get("business_type", "").replace("_", " ").title()
            licenses = business_ctx.get("licenses", [])
            augmented_query = (
                f"{query}\n\n[Business Type Context: {btype}. "
                f"Known required licenses: {', '.join(licenses)}]"
            )

        # Stream LLM response
        full_response = ""
        async for token in llm_service.generate(
            query=augmented_query,
            retrieved_chunks=chunks,
            chat_history=chat_history,
            stream=True,
        ):
            full_response += token
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

        # Cache result
        if use_cache and not chat_history and full_response:
            response_cache.set(cache_key, full_response)

    def _format_sources(self, chunks: List[Dict]) -> List[Dict]:
        seen = set()
        sources = []
        for c in chunks:
            src_id = c.get("source_file", "")
            if src_id not in seen:
                seen.add(src_id)
                sources.append({
                    "file": c.get("source_file", ""),
                    "title": c.get("doc_title", ""),
                    "category": c.get("category", ""),
                    "path": c.get("source_path", ""),
                    "score": round(c.get("score", 0), 3),
                })
        return sources


# Singleton
rag_pipeline = RAGPipeline()
