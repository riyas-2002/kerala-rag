"""
Kerala RAG — Document Ingestion API Router
Handles indexing documents from the data folder and file uploads.
"""
import os
import shutil
import asyncio
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import Optional, List
from loguru import logger

from app.models.schemas import IngestRequest, IngestResponse, IndexStats
from app.services.document_processor import DocumentProcessor
from app.services.vector_store import vector_store
from app.core.config import settings

router = APIRouter(prefix="/api/ingest", tags=["Ingestion"])

# Track indexing progress
_ingest_status = {
    "running": False,
    "progress": 0,
    "total": 0,
    "message": "Idle",
    "last_result": None,
}


def _run_ingest(rebuild: bool = True, category: Optional[str] = None):
    """Background task: process documents and build/update FAISS index."""
    global _ingest_status
    _ingest_status["running"] = True
    _ingest_status["message"] = "Processing documents..."
    _ingest_status["progress"] = 0

    try:
        processor = DocumentProcessor()

        if category:
            # Process a single category
            cat_path = Path(settings.documents_path) / category
            chunks = []
            for doc_path in sorted(cat_path.rglob("*")):
                if doc_path.suffix.lower() in {".pdf", ".docx", ".txt", ".html", ".htm", ".md"}:
                    try:
                        doc_chunks = processor.process_single_document(doc_path, category)
                        chunks.extend(doc_chunks)
                    except Exception as e:
                        logger.error(f"Error processing {doc_path}: {e}")
        else:
            chunks = processor.process_all_documents()

        _ingest_status["total"] = len(chunks)
        _ingest_status["message"] = f"Indexing {len(chunks)} chunks..."

        if rebuild:
            n = vector_store.build_index(chunks)
        else:
            n = vector_store.add_chunks(chunks)

        _ingest_status["last_result"] = {
            "chunks_indexed": n,
            "total_vectors": vector_store.total_vectors,
        }
        _ingest_status["message"] = f"Done. {n} chunks indexed."
        _ingest_status["progress"] = 100
        logger.info(f"Ingest complete: {n} chunks")

    except Exception as e:
        logger.error(f"Ingest failed: {e}")
        _ingest_status["message"] = f"Error: {str(e)}"
    finally:
        _ingest_status["running"] = False


@router.post("", response_model=IngestResponse)
async def ingest_documents(
    request: IngestRequest,
    background_tasks: BackgroundTasks,
):
    """
    Trigger document ingestion from the data/kerala_rag folder.
    Runs as a background task to avoid HTTP timeout.
    """
    if _ingest_status["running"]:
        raise HTTPException(status_code=409, detail="Ingest already running.")

    background_tasks.add_task(_run_ingest, request.rebuild, request.category)

    return IngestResponse(
        status="started",
        message="Ingestion started in background. Poll /api/ingest/status for progress.",
        chunks_indexed=0,
        total_vectors=vector_store.total_vectors,
    )


@router.get("/status")
async def ingest_status():
    """Poll ingestion progress."""
    return {
        **_ingest_status,
        "current_vectors": vector_store.total_vectors,
    }


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form("licenses"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Upload a document and immediately index it.
    Supported: PDF, DOCX, TXT, HTML, MD
    """
    allowed_extensions = {".pdf", ".docx", ".txt", ".html", ".htm", ".md"}
    ext = Path(file.filename).suffix.lower()

    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(allowed_extensions)}",
        )

    # Check file size
    content = await file.read()
    if len(content) > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size: {settings.max_upload_size_mb}MB",
        )

    # Save to appropriate category folder
    save_dir = Path(settings.documents_path) / category
    save_dir.mkdir(parents=True, exist_ok=True)
    save_path = save_dir / file.filename

    with open(save_path, "wb") as f:
        f.write(content)

    logger.info(f"Uploaded: {file.filename} → {save_path}")

    # Index the single document in background
    def index_single():
        processor = DocumentProcessor()
        chunks = processor.process_single_document(save_path, category)
        vector_store.add_chunks(chunks)
        logger.info(f"Indexed uploaded file: {file.filename}, {len(chunks)} chunks")

    background_tasks.add_task(index_single)

    return {
        "status": "uploaded",
        "filename": file.filename,
        "category": category,
        "message": "File uploaded and indexing started in background.",
    }


@router.get("/stats", response_model=IndexStats)
async def index_stats():
    """Return current index statistics."""
    return vector_store.get_stats()


@router.delete("/reset")
async def reset_index():
    """
    Delete the FAISS index and metadata. Use with caution.
    You will need to re-run ingest after this.
    """
    index_file = os.path.join(settings.faiss_index_path, "index.faiss")
    meta_file = settings.faiss_metadata_path

    removed = []
    for f in [index_file, meta_file]:
        if os.path.exists(f):
            os.remove(f)
            removed.append(f)

    # Reset in-memory
    vector_store._index = None
    vector_store._metadata = []

    return {"status": "reset", "removed_files": removed}
