# Kerala Compliance AI — RAG Platform

> AI-powered Kerala business regulation assistant. Fully free to host. Source-backed answers. Zero paid infrastructure.

---

## 🎯 What It Does

Ask natural language questions about Kerala business compliance:

- *"What licenses are required for a restaurant in Kerala?"*
- *"How do I get a Factory License?"*
- *"What is the MSME Udyam Registration process?"*
- *"How to get Pollution Control Board consent?"*

The system retrieves answers from curated Kerala government documents using semantic search (FAISS + local embeddings), then generates responses via Groq's free LLM API — with source citations.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  USER BROWSER                                               │
│  Next.js 14 on Vercel (free tier)                          │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS / SSE stream
┌────────────────────▼────────────────────────────────────────┐
│  BACKEND API                                                │
│  FastAPI on Render (free tier)                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Chat Router → RAG Pipeline                          │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  1. Query Embedding (all-MiniLM-L6-v2, CPU)     │ │  │
│  │  │  2. FAISS Vector Search (cosine similarity)     │ │  │
│  │  │  3. Business Map Augmentation                   │ │  │
│  │  │  4. Context Assembly (≤2000 tokens)             │ │  │
│  │  │  5. Groq LLM (llama3-8b-8192, streaming)       │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │  Ingest Router → Document Processor                  │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  PDF/DOCX/TXT/HTML/MD extraction + OCR          │ │  │
│  │  │  Chunking (500 tokens, 50 overlap)              │ │  │
│  │  │  Deduplication (MD5 hash)                       │ │  │
│  │  │  FAISS IndexFlatIP → disk persist               │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│  Storage: FAISS index on /data (Render disk or GitHub)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 📂 Project Structure

```
kerala-rag/
├── backend/
│   ├── main.py                         # FastAPI app entry point
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   └── app/
│       ├── api/
│       │   ├── chat.py                 # Chat + retrieval endpoints
│       │   ├── ingest.py               # Document ingestion endpoints
│       │   └── health.py               # Health check + categories
│       ├── core/
│       │   └── config.py               # All settings (env vars)
│       ├── models/
│       │   └── schemas.py              # Pydantic request/response models
│       └── services/
│           ├── document_processor.py   # PDF/DOCX/HTML extraction + chunking
│           ├── embedding_service.py    # Local sentence-transformers
│           ├── vector_store.py         # FAISS index management
│           ├── llm_service.py          # Groq + HuggingFace inference
│           └── rag_pipeline.py         # Orchestration + business maps + cache
│
├── frontend/
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── .env.example
│   └── src/
│       ├── app/
│       │   ├── layout.tsx              # Next.js root layout
│       │   └── page.tsx                # Main chat page
│       ├── components/
│       │   ├── chat/
│       │   │   ├── ChatMessage.tsx     # Message bubble + markdown
│       │   │   ├── ChatInput.tsx       # Auto-resize textarea
│       │   │   ├── CategoryFilter.tsx  # Topic filter pills
│       │   │   └── SourceCard.tsx      # Source citations + business context
│       │   └── upload/
│       │       └── DocumentUpload.tsx  # Drag-and-drop uploader
│       ├── hooks/
│       │   └── useChat.ts              # Chat state + SSE streaming hook
│       ├── utils/
│       │   └── api.ts                  # API client functions
│       └── styles/
│           └── globals.css
│
├── data/
│   └── kerala_rag/                     # Document storage (manually curated)
│       ├── acts_rules/                 # Kerala acts + central laws
│       ├── licenses/                   # License reference documents
│       ├── sop_guidelines/             # Step-by-step SOPs
│       ├── forms/                      # Form templates
│       ├── faqs/                       # FAQ documents
│       ├── central_laws/               # Central India laws
│       ├── business_maps/              # Business type → license JSON maps
│       └── metadata/                   # Optional JSON sidecar files
│
├── render.yaml                         # Render deployment config
├── vercel.json                         # Vercel deployment config
├── setup.sh                            # One-command local setup
└── .github/workflows/deploy.yml        # CI/CD pipeline
```

---

## ⚡ Quick Start (Local)

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/kerala-rag.git
cd kerala-rag

# One-command setup (installs deps, creates env files, runs initial ingest)
chmod +x setup.sh && ./setup.sh

# Edit backend/.env — set your Groq API key
nano backend/.env
# Set: GROQ_API_KEY=your_key_here

# Terminal 1: Start backend
cd backend && source venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2: Start frontend
cd frontend && npm run dev

# Open browser
open http://localhost:3000
```

---

## 🔑 Getting Free API Keys

### Groq API (Recommended LLM — Fast + Free)
1. Go to: https://console.groq.com
2. Sign up for free account
3. Create API key
4. Free tier: **14,400 tokens/minute**, 500k tokens/day on llama3-8b-8192
5. No credit card required

### HuggingFace API (Fallback)
1. Go to: https://huggingface.co
2. Sign up → Settings → Access Tokens → New Token
3. Free tier: Rate-limited inference API
4. Slower than Groq but reliable fallback

---

## 🚀 Production Deployment

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/kerala-rag.git
git push -u origin main
```

### Step 2: Deploy Backend to Render

1. Go to: https://render.com → Sign up (free)
2. New → Web Service → Connect GitHub repo
3. Settings:
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install torch==2.3.0+cpu --index-url https://download.pytorch.org/whl/cpu && pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1`
4. Add Environment Variables in Render dashboard:
   ```
   GROQ_API_KEY=your_groq_key
   LLM_PROVIDER=groq
   GROQ_MODEL=llama3-8b-8192
   APP_ENV=production
   ALLOWED_ORIGINS=https://your-app.vercel.app
   DOCUMENTS_PATH=/data/kerala_rag
   FAISS_INDEX_PATH=/data/faiss_index
   FAISS_METADATA_PATH=/data/faiss_metadata.pkl
   CACHE_DIR=/data/cache
   ```
5. Add **Disk** (optional but recommended):
   - Name: `kerala-rag-data`
   - Mount Path: `/data`
   - Size: 1 GB
   - **Note**: Render free tier does NOT include persistent disk. See "Free-tier Persistence Strategy" below.
6. Deploy. Copy the `.onrender.com` URL.

### Step 3: Deploy Frontend to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from frontend directory
cd frontend
vercel

# Follow prompts:
# - Link to existing project or create new
# - Set environment variable:
#   NEXT_PUBLIC_API_URL = https://kerala-rag-backend.onrender.com
```

Or via Vercel dashboard:
1. https://vercel.com → New Project → Import from GitHub
2. **Root Directory**: `frontend`
3. Add environment variable: `NEXT_PUBLIC_API_URL=https://kerala-rag-backend.onrender.com`
4. Deploy

### Step 4: Configure CORS

In Render dashboard, update `ALLOWED_ORIGINS`:
```
ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-custom-domain.com
```

### Step 5: Ingest Documents

After both services are deployed:
```bash
# Trigger initial ingestion via API
curl -X POST https://kerala-rag-backend.onrender.com/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"rebuild": true}'

# Check status
curl https://kerala-rag-backend.onrender.com/api/ingest/status

# Check health
curl https://kerala-rag-backend.onrender.com/health
```

---

## 💾 Free-Tier Persistence Strategy

Render's **free tier does NOT include persistent disk**. Data is lost on redeploy.

### Option A: Commit FAISS Index to GitHub (Recommended for Small Indexes)

```bash
# After building index locally:
git add data/faiss_index/ data/faiss_metadata.pkl
git commit -m "Update FAISS index"
git push

# In backend startup, copy from repo to /data:
# Add to main.py lifespan:
import shutil
if not os.path.exists('/data/faiss_index/index.faiss'):
    shutil.copytree('./data/faiss_index', '/data/faiss_index', dirs_exist_ok=True)
    shutil.copy('./data/faiss_metadata.pkl', '/data/faiss_metadata.pkl')
```

GitHub free tier allows files up to 100MB. FAISS indexes are typically 10–50MB for <100k vectors.

### Option B: Supabase Storage (Free — 1GB)

Store FAISS index files in Supabase Storage bucket. Download at startup.

### Option C: Render Paid Disk ($7/month)
Cheapest path to true persistence. Recommended once you have real users.

### Option D: Railway Free Tier (Alternative to Render)
Railway gives 512MB RAM + 1GB disk on free hobby plan.
```bash
# Deploy to Railway
railway init
railway up
```

---

## 📚 Adding Documents

### Method 1: Folder-Based (Recommended)

Place documents in the correct category folder:
```
data/kerala_rag/
├── acts_rules/          ← Kerala Acts, Rules, Notifications
├── licenses/            ← License procedure documents
├── sop_guidelines/      ← Step-by-step SOPs
├── forms/               ← Form templates and instructions
├── faqs/                ← FAQ documents
├── central_laws/        ← Central laws applicable in Kerala
└── business_maps/       ← JSON files for business type → license mapping
```

Supported formats: `.pdf`, `.docx`, `.txt`, `.html`, `.md`

Optional: Create a sidecar `.json` with the same filename for metadata:
```json
// data/kerala_rag/licenses/factory_license.json
{
  "title": "Kerala Factory License — Complete Guide",
  "department": "Directorate of Factories and Boilers",
  "year": 2023,
  "tags": ["factory", "manufacturing", "labour"]
}
```

Then trigger re-index:
```bash
curl -X POST https://your-backend.onrender.com/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"rebuild": false}'
```

### Method 2: Upload via UI
- Click "Upload" tab in the frontend
- Select category
- Drag-and-drop files
- Files are automatically indexed

### Method 3: Upload via API
```bash
curl -X POST https://your-backend.onrender.com/api/ingest/upload \
  -F "file=@kerala_restaurant_license.pdf" \
  -F "category=licenses"
```

---

## 🧠 Business Type Mappings

Add JSON files to `data/kerala_rag/business_maps/` to help the AI quickly identify required licenses:

```json
{
  "supermarket": {
    "licenses": [
      "Trade License",
      "FSSAI State License",
      "Weights & Measures License",
      "GST Registration",
      "Fire NOC (if > 500 sqft)"
    ],
    "departments": [
      "Local Body",
      "FSSAI",
      "Legal Metrology Department",
      "GST Department",
      "Fire & Rescue"
    ]
  }
}
```

---

## ⚙️ Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `groq` | `groq` or `huggingface` |
| `GROQ_API_KEY` | — | Get from console.groq.com |
| `GROQ_MODEL` | `llama3-8b-8192` | Groq model ID |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | sentence-transformers model |
| `CHUNK_SIZE` | `500` | Tokens per chunk |
| `CHUNK_OVERLAP` | `50` | Overlap between chunks |
| `TOP_K_CHUNKS` | `5` | Chunks retrieved per query |
| `SIMILARITY_THRESHOLD` | `0.35` | Minimum cosine similarity |
| `MAX_CONTEXT_TOKENS` | `2000` | Max tokens sent to LLM |
| `RATE_LIMIT_PER_MINUTE` | `20` | Requests per IP per minute |
| `CACHE_TTL_SECONDS` | `3600` | Response cache TTL |

---

## 🆓 Platform Free-Tier Limits

| Platform | What's Free | Limit | Bottleneck |
|----------|------------|-------|------------|
| **Vercel** | Frontend hosting | 100GB bandwidth/mo | High traffic only |
| **Render** | Backend web service | 750 hrs/mo, 512MB RAM | Cold starts (15s) |
| **Groq** | LLM inference | 14,400 tokens/min | 500k tokens/day |
| **GitHub** | Repo storage | 1GB free | FAISS index size |
| **HuggingFace** | Embedding models | Unlimited (local) | CPU speed |

### Expected Performance (Free Tier)
- **Cold start** (Render): 10–20 seconds first request after idle
- **Query latency**: 3–8 seconds (embed → search → LLM stream start)
- **Concurrent users**: 10–20 comfortably on free Render
- **Documents**: 500–1,000 documents, 50k–200k chunks comfortably

### Optimization Already Implemented
- Embedding cache (disk) — avoids re-embedding seen texts
- Response cache (disk) — caches identical queries for 1 hour
- Lazy model loading — embedding model loads on first request
- Streaming responses — first tokens appear in <3s
- GZip compression — reduces bandwidth
- Single worker — fits in 512MB RAM

---

## 📈 Scaling Path

When traffic increases and free tier is insufficient:

| Stage | Action | Cost |
|-------|--------|------|
| **Stage 1** | Add Render persistent disk | $7/mo |
| **Stage 2** | Upgrade Render to Starter ($7/mo) | $7/mo |
| **Stage 3** | Redis for distributed caching (Upstash free tier) | $0 |
| **Stage 4** | Upgrade to FAISS with GPU (if needed) | Compute cost |
| **Stage 5** | Move to Qdrant Cloud (free 1GB cluster) | $0 |
| **Stage 6** | Multiple Render workers + load balancer | $20+/mo |

---

## 🔧 API Reference

### Chat
```
POST /api/chat/stream
Body: { "query": "...", "category_filter": null, "top_k": 5 }
Response: Server-Sent Events stream
```

### Ingest
```
POST /api/ingest
Body: { "rebuild": false, "category": null }

GET /api/ingest/status

POST /api/ingest/upload
Body: multipart/form-data { file, category }

GET /api/ingest/stats

DELETE /api/ingest/reset
```

### Other
```
GET /health
GET /api/categories
GET /docs       (Swagger UI)
```

---

## 🛡️ Important Disclaimers

- This system provides **guidance only**, not legal advice
- Always verify compliance requirements with the **relevant government authority**
- Regulations change — keep documents updated
- The AI may make mistakes — always cross-check with official sources

---

## 📞 Kerala Government Resources

| Authority | Website | Helpline |
|-----------|---------|---------|
| Industries Department | industry.kerala.gov.in | 0471-2320482 |
| Kerala PCB | keralapcb.nic.in | 0471-2306636 |
| Factories & Boilers | fab.kerala.gov.in | 0471-2300926 |
| Fire & Rescue | fireandrescue.kerala.gov.in | 101 |
| FSSAI | fssai.gov.in | 1800-112-100 |
| GST Kerala | keralataxes.gov.in | 1800-425-1550 |
| MSME DI Kerala | msmedikerala.gov.in | 0484-2555261 |
| Invest Kerala | kinfra.org | 0484-2777100 |
| e-District Kerala | edistrict.kerala.gov.in | 0471-2700797 |

---

## License

MIT License — Free to use, modify, and deploy.
