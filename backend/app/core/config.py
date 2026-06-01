"""
Kerala RAG — Application Configuration
Reads from environment variables with sensible defaults.
"""
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List
import os


class Settings(BaseSettings):
    # App
    app_env: str = Field("production", env="APP_ENV")
    debug: bool = Field(False, env="DEBUG")
    log_level: str = Field("INFO", env="LOG_LEVEL")

    # LLM
    llm_provider: str = Field("groq", env="LLM_PROVIDER")
    groq_api_key: str = Field("", env="GROQ_API_KEY")
    groq_model: str = Field("llama3-8b-8192", env="GROQ_MODEL")
    hf_api_key: str = Field("", env="HF_API_KEY")
    hf_model: str = Field("mistralai/Mistral-7B-Instruct-v0.2", env="HF_MODEL")

    # Embeddings
    embedding_model: str = Field(
        "sentence-transformers/all-MiniLM-L6-v2", env="EMBEDDING_MODEL"
    )

    # FAISS
    faiss_index_path: str = Field("./data/faiss_index", env="FAISS_INDEX_PATH")
    faiss_metadata_path: str = Field(
        "./data/faiss_metadata.pkl", env="FAISS_METADATA_PATH"
    )

    # Documents
    documents_path: str = Field("./data/kerala_rag", env="DOCUMENTS_PATH")
    chunk_size: int = Field(500, env="CHUNK_SIZE")
    chunk_overlap: int = Field(50, env="CHUNK_OVERLAP")
    max_upload_size_mb: int = Field(20, env="MAX_UPLOAD_SIZE_MB")

    # Cache
    cache_dir: str = Field("./data/cache", env="CACHE_DIR")
    cache_ttl_seconds: int = Field(3600, env="CACHE_TTL_SECONDS")

    # CORS
    allowed_origins: str = Field(
        "https://kerala-compliance.vercel.app,http://localhost:3000",
        env="ALLOWED_ORIGINS",
    )

    # Retrieval
    top_k_chunks: int = Field(5, env="TOP_K_CHUNKS")
    similarity_threshold: float = Field(0.35, env="SIMILARITY_THRESHOLD")
    max_context_tokens: int = Field(2000, env="MAX_CONTEXT_TOKENS")

    # Rate limiting
    rate_limit_per_minute: int = Field(20, env="RATE_LIMIT_PER_MINUTE")

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    @property
    def max_upload_size_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# Ensure data directories exist on startup
for path in [
    settings.faiss_index_path,
    os.path.dirname(settings.faiss_metadata_path),
    settings.documents_path,
    settings.cache_dir,
    os.path.join(settings.documents_path, "acts_rules"),
    os.path.join(settings.documents_path, "licenses"),
    os.path.join(settings.documents_path, "sop_guidelines"),
    os.path.join(settings.documents_path, "forms"),
    os.path.join(settings.documents_path, "faqs"),
    os.path.join(settings.documents_path, "central_laws"),
    os.path.join(settings.documents_path, "business_maps"),
    os.path.join(settings.documents_path, "metadata"),
]:
    os.makedirs(path, exist_ok=True)
