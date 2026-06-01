"""
Kerala RAG — Chat API Router
Handles streaming and non-streaming chat endpoints.
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import AsyncGenerator
import json
from loguru import logger

from app.models.schemas import ChatRequest, RetrievalResult
from app.services.rag_pipeline import rag_pipeline
from app.services.vector_store import vector_store

router = APIRouter(prefix="/api/chat", tags=["Chat"])


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    """
    Main chat endpoint — returns Server-Sent Events (SSE) stream.
    
    Frontend should use EventSource or fetch with stream reading.
    Events emitted:
      { type: "sources", sources: [...], business_context: {...} }
      { type: "token", content: "..." }
      { type: "done" }
      { type: "error", message: "..." }
    """
    if vector_store.total_vectors == 0:
        async def error_stream():
            yield f"data: {json.dumps({'type': 'error', 'message': 'Index not ready. Please run /api/ingest first.'})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream")

    history = None
    if request.chat_history:
        history = [{"role": m.role, "content": m.content} for m in request.chat_history]

    async def generate():
        try:
            async for chunk in rag_pipeline.stream_answer(
                query=request.query,
                chat_history=history,
                category_filter=request.category_filter,
                top_k=request.top_k,
                use_cache=request.use_cache,
            ):
                yield chunk
        except Exception as e:
            logger.error(f"Chat stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/retrieve", response_model=RetrievalResult)
async def retrieve_only(request: ChatRequest):
    """
    Retrieval-only endpoint — returns chunks without LLM generation.
    Useful for testing and chunk preview in the UI.
    """
    context = rag_pipeline.retrieve(
        query=request.query,
        top_k=request.top_k,
        category_filter=request.category_filter,
    )
    sources = rag_pipeline._format_sources(context["chunks"])
    return RetrievalResult(
        chunks=context["chunks"],
        sources=sources,
        business_context=context["business_context"],
        query=request.query,
    )
