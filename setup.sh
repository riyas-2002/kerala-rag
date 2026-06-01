#!/bin/bash
# ============================================================
# Kerala RAG — One-Command Setup Script
# Usage: chmod +x setup.sh && ./setup.sh
# ============================================================

set -e

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Kerala Compliance RAG — Setup Script       ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# --------------------------------------------------------
# 1. Check prerequisites
# --------------------------------------------------------
echo "→ Checking prerequisites..."

if ! command -v python3 &>/dev/null; then
  echo "✗ Python 3 not found. Please install Python 3.11+"
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo "✗ Node.js not found. Please install Node.js 18+"
  exit 1
fi

if ! command -v pip &>/dev/null && ! command -v pip3 &>/dev/null; then
  echo "✗ pip not found. Please install pip."
  exit 1
fi

echo "✓ Python: $(python3 --version)"
echo "✓ Node:   $(node --version)"
echo "✓ npm:    $(npm --version)"

# --------------------------------------------------------
# 2. Backend setup
# --------------------------------------------------------
echo ""
echo "→ Setting up backend..."
cd backend

# Create virtual environment
if [ ! -d "venv" ]; then
  python3 -m venv venv
  echo "✓ Virtual environment created"
fi

# Activate
source venv/bin/activate

# Install CPU PyTorch first (much smaller)
echo "  Installing CPU-only PyTorch..."
pip install torch==2.3.0+cpu torchvision==0.18.0+cpu \
  --index-url https://download.pytorch.org/whl/cpu --quiet

# Install remaining requirements
echo "  Installing Python dependencies..."
pip install -r requirements.txt --quiet

# Copy env file if not exists
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "✓ Created backend/.env — EDIT THIS FILE with your API keys!"
fi

# Create data directories
mkdir -p ../data/faiss_index ../data/cache \
  ../data/kerala_rag/{acts_rules,licenses,sop_guidelines,forms,faqs,central_laws,business_maps,metadata}
echo "✓ Data directories created"

cd ..

# --------------------------------------------------------
# 3. Frontend setup
# --------------------------------------------------------
echo ""
echo "→ Setting up frontend..."
cd frontend

npm install --silent
echo "✓ npm packages installed"

if [ ! -f ".env.local" ]; then
  cp .env.example .env.local
  echo "✓ Created frontend/.env.local"
fi

cd ..

# --------------------------------------------------------
# 4. Initial document ingestion
# --------------------------------------------------------
echo ""
echo "→ Running initial document ingestion (seed data)..."
cd backend
source venv/bin/activate

# Run ingest with the seed documents
python3 -c "
import os
os.environ.setdefault('LLM_PROVIDER', 'groq')
os.environ.setdefault('DOCUMENTS_PATH', '../data/kerala_rag')
os.environ.setdefault('FAISS_INDEX_PATH', '../data/faiss_index')
os.environ.setdefault('FAISS_METADATA_PATH', '../data/faiss_metadata.pkl')
os.environ.setdefault('CACHE_DIR', '../data/cache')
os.environ.setdefault('EMBEDDING_MODEL', 'sentence-transformers/all-MiniLM-L6-v2')

from app.services.document_processor import DocumentProcessor
from app.services.vector_store import vector_store

processor = DocumentProcessor()
chunks = processor.process_all_documents()
print(f'Processed {len(chunks)} chunks from seed documents')
if chunks:
    n = vector_store.build_index(chunks)
    print(f'Indexed {n} vectors into FAISS')
else:
    print('No documents found. Add documents to data/kerala_rag/ and re-run ingest.')
"

cd ..

# --------------------------------------------------------
# 5. Print summary
# --------------------------------------------------------
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   Setup Complete!                                ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo ""
echo "  1. Edit backend/.env and set your GROQ_API_KEY:"
echo "     → Get free key at: https://console.groq.com"
echo ""
echo "  2. Start backend (Terminal 1):"
echo "     cd backend && source venv/bin/activate"
echo "     uvicorn main:app --reload --port 8000"
echo ""
echo "  3. Start frontend (Terminal 2):"
echo "     cd frontend && npm run dev"
echo ""
echo "  4. Open: http://localhost:3000"
echo ""
echo "  5. Add your documents to data/kerala_rag/[category]/"
echo "     Then call: POST http://localhost:8000/api/ingest"
echo ""
echo "  6. Deploy:"
echo "     Backend → Render (render.yaml already configured)"
echo "     Frontend → Vercel (vercel.json already configured)"
echo "     See README.md for detailed deployment instructions."
echo ""
