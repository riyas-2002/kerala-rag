// Kerala RAG — API Client Utilities

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Source {
  file: string;
  title: string;
  category: string;
  path: string;
  score: number;
}

export interface BusinessContext {
  business_type: string;
  licenses?: string[];
  optional?: string[];
  departments?: string[];
}

export interface StreamEvent {
  type: 'sources' | 'token' | 'done' | 'error';
  content?: string;
  sources?: Source[];
  business_context?: BusinessContext;
  message?: string;
}

export interface IndexStats {
  total_vectors: number;
  total_documents: number;
  total_chunks: number;
  categories: Record<string, number>;
}

// Stream chat response from the backend
export async function streamChat(
  query: string,
  chatHistory: ChatMessage[],
  categoryFilter: string | null,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`${API_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      chat_history: chatHistory.slice(-6), // Last 3 turns
      category_filter: categoryFilter || undefined,
      top_k: 5,
      use_cache: true,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (!data) continue;
        try {
          const event: StreamEvent = JSON.parse(data);
          onEvent(event);
        } catch (e) {
          // ignore parse errors
        }
      }
    }
  }
}

// Upload a document
export async function uploadDocument(
  file: File,
  category: string,
  onProgress?: (pct: number) => void
): Promise<{ status: string; filename: string; message: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);

  const response = await fetch(`${API_URL}/api/ingest/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || 'Upload failed');
  }

  return response.json();
}

// Trigger full reindex
export async function triggerIngest(rebuild = false): Promise<void> {
  const response = await fetch(`${API_URL}/api/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rebuild }),
  });
  if (!response.ok) throw new Error('Ingest trigger failed');
}

// Get index stats
export async function getIndexStats(): Promise<IndexStats> {
  const response = await fetch(`${API_URL}/api/ingest/stats`);
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
}

// Get categories
export async function getCategories(): Promise<Array<{ key: string; label: string; doc_count: number }>> {
  const response = await fetch(`${API_URL}/api/categories`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.categories || [];
}

// Health check
export async function checkHealth(): Promise<{ status: string; index_ready: boolean; total_vectors: number }> {
  const response = await fetch(`${API_URL}/health`);
  if (!response.ok) throw new Error('Health check failed');
  return response.json();
}

// Format score as percentage
export function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

// Category color map
export const CATEGORY_COLORS: Record<string, string> = {
  'Acts & Rules': 'bg-blue-50 text-blue-700 border-blue-200',
  'Licenses & Permits': 'bg-green-50 text-green-700 border-green-200',
  'SOPs & Guidelines': 'bg-purple-50 text-purple-700 border-purple-200',
  'Forms & Applications': 'bg-orange-50 text-orange-700 border-orange-200',
  'FAQs': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Central Laws': 'bg-red-50 text-red-700 border-red-200',
  'Business Type Maps': 'bg-teal-50 text-teal-700 border-teal-200',
};

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || 'bg-gray-50 text-gray-700 border-gray-200';
}
