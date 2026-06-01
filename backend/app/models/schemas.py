"""
Kerala RAG — API Models
Pydantic schemas for all request/response payloads.
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    chat_history: Optional[List[ChatMessage]] = None
    category_filter: Optional[str] = None
    top_k: Optional[int] = Field(None, ge=1, le=20)
    use_cache: bool = True


class SourceDocument(BaseModel):
    file: str
    title: str
    category: str
    path: str
    score: float


class RetrievalResult(BaseModel):
    chunks: List[Dict[str, Any]]
    sources: List[SourceDocument]
    business_context: Optional[Dict[str, Any]] = None
    query: str


class IngestRequest(BaseModel):
    rebuild: bool = Field(
        False,
        description="If True, rebuilds entire index from scratch. If False, adds only new docs.",
    )
    category: Optional[str] = None


class IngestResponse(BaseModel):
    status: str
    message: str
    chunks_indexed: int
    total_vectors: int


class IndexStats(BaseModel):
    total_vectors: int
    total_documents: int
    total_chunks: int
    categories: Dict[str, int]


class HealthResponse(BaseModel):
    status: str
    index_ready: bool
    total_vectors: int
    llm_provider: str
    embedding_model: str


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
