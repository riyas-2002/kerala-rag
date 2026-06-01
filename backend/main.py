"""
Kerala RAG — FastAPI Application Entry Point
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
import sys

from app.core.config import settings
from app.api import chat, ingest, health

# ------------------------------------------------------------------ #
#  Logging                                                             #
# ------------------------------------------------------------------ #
logger.remove()
logger.add(
    sys.stdout,
    level=settings.log_level,
    format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | {message}",
)

# ------------------------------------------------------------------ #
#  Lifespan (startup / shutdown)                                      #
# ------------------------------------------------------------------ #
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Kerala Compliance RAG API starting...")
    logger.info(f"   LLM Provider : {settings.llm_provider}")
    logger.info(f"   Embedding    : {settings.embedding_model}")
    logger.info(f"   Documents    : {settings.documents_path}")
    # Pre-warm embedding model on startup to reduce first-query latency
    try:
        from app.services.embedding_service import embedding_service
        _ = embedding_service.embedding_dim
        logger.info("   Embedding model pre-warmed ✓")
    except Exception as e:
        logger.warning(f"   Embedding pre-warm failed: {e}")
    yield
    logger.info("Kerala Compliance RAG API shutting down.")


# ------------------------------------------------------------------ #
#  App                                                                 #
# ------------------------------------------------------------------ #
app = FastAPI(
    title="Kerala Business Compliance RAG API",
    description=(
        "AI-powered assistant for Kerala business regulations, licenses, "
        "permits, and compliance — fully free to host."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ------------------------------------------------------------------ #
#  Middleware                                                           #
# ------------------------------------------------------------------ #
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)


# ------------------------------------------------------------------ #
#  Rate limiting (simple in-memory, replace with Redis for scale)     #
# ------------------------------------------------------------------ #
from collections import defaultdict
import time

_rate_store: dict = defaultdict(list)

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/chat"):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        window = 60  # 1 minute
        _rate_store[client_ip] = [t for t in _rate_store[client_ip] if now - t < window]
        if len(_rate_store[client_ip]) >= settings.rate_limit_per_minute:
            return JSONResponse(
                status_code=429,
                content={"error": "Rate limit exceeded. Please wait before sending more requests."},
            )
        _rate_store[client_ip].append(now)
    return await call_next(request)


# ------------------------------------------------------------------ #
#  Error Handlers                                                      #
# ------------------------------------------------------------------ #
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)},
    )


# ------------------------------------------------------------------ #
#  Routers                                                             #
# ------------------------------------------------------------------ #
app.include_router(health.router)
app.include_router(chat.router)
app.include_router(ingest.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8000)),
        reload=settings.debug,
        workers=1,  # Single worker to stay within Render free tier RAM
    )
