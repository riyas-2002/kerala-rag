# Kerala RAG Backend — Dockerfile
# Optimized for free hosting (Render, Fly.io, Railway free tiers)

FROM python:3.11-slim

# System dependencies for OCR and document processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    poppler-utils \
    libmagic1 \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .

# Install CPU-only PyTorch first (much smaller than default)
RUN pip install --no-cache-dir \
    torch==2.3.0+cpu \
    torchvision==0.18.0+cpu \
    --index-url https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir -r requirements.txt

# Pre-download embedding model into image to avoid cold-start delay
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

# Copy application code
COPY . .

# Create data directories
RUN mkdir -p \
    /data/faiss_index \
    /data/cache \
    /data/kerala_rag/acts_rules \
    /data/kerala_rag/licenses \
    /data/kerala_rag/sop_guidelines \
    /data/kerala_rag/forms \
    /data/kerala_rag/faqs \
    /data/kerala_rag/central_laws \
    /data/kerala_rag/business_maps \
    /data/kerala_rag/metadata

# Environment
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV DOCUMENTS_PATH=/data/kerala_rag
ENV FAISS_INDEX_PATH=/data/faiss_index
ENV FAISS_METADATA_PATH=/data/faiss_metadata.pkl
ENV CACHE_DIR=/data/cache

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
