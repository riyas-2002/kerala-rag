"""
Kerala RAG — Health & Status API Router
"""
from fastapi import APIRouter
from app.models.schemas import HealthResponse
from app.services.vector_store import vector_store
from app.core.config import settings

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint — used by Render and uptime monitors."""
    return HealthResponse(
        status="ok",
        index_ready=vector_store.total_vectors > 0,
        total_vectors=vector_store.total_vectors,
        llm_provider=settings.llm_provider,
        embedding_model=settings.embedding_model,
    )


@router.get("/")
async def root():
    return {
        "name": "Kerala Compliance RAG API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


@router.get("/api/categories")
async def list_categories():
    """Return available document categories for frontend filter."""
    import os
    from app.core.config import settings

    base = settings.documents_path
    categories = []
    category_labels = {
        "acts_rules": "Acts & Rules",
        "licenses": "Licenses & Permits",
        "sop_guidelines": "SOPs & Guidelines",
        "forms": "Forms & Applications",
        "faqs": "FAQs",
        "central_laws": "Central Laws",
        "business_maps": "Business Type Maps",
    }

    for folder in sorted(os.listdir(base)):
        path = os.path.join(base, folder)
        if os.path.isdir(path) and folder != "metadata":
            doc_count = sum(
                1
                for f in os.listdir(path)
                if f.endswith((".pdf", ".docx", ".txt", ".html", ".md"))
            )
            categories.append({
                "key": folder,
                "label": category_labels.get(folder, folder.replace("_", " ").title()),
                "doc_count": doc_count,
            })

    return {"categories": categories}
