'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Bot, Upload, BarChart2, RefreshCw, ChevronDown,
  X, Menu, Sparkles, BookOpen, Building2, ScrollText
} from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { ChatMessageBubble } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { CategoryFilter } from '@/components/chat/CategoryFilter';
import { DocumentUpload } from '@/components/upload/DocumentUpload';
import { getIndexStats, checkHealth, triggerIngest, IndexStats } from '@/utils/api';

const SUGGESTED_QUESTIONS = [
  "What licenses are required for a restaurant in Kerala?",
  "How to get a Factory License in Kerala?",
  "What is MSME Udyam Registration process?",
  "How to obtain a Fire NOC in Kerala?",
  "What is the procedure for Pollution Control Board consent?",
  "What registrations are needed for a new hotel in Kerala?",
  "How to get FSSAI license for a food business?",
  "What are the steps for Trade License in Kerala Municipality?",
];

type Tab = 'chat' | 'upload' | 'stats';

export default function HomePage() {
  const {
    messages, isLoading, error,
    categoryFilter, setCategoryFilter,
    sendMessage, cancelStream, clearChat,
  } = useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [stats, setStats] = useState<IndexStats | null>(null);
  const [health, setHealth] = useState<{ status: string; index_ready: boolean; total_vectors: number } | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [s, h] = await Promise.all([getIndexStats(), checkHealth()]);
      setStats(s);
      setHealth(h);
    } catch {}
  };

  const handleSend = (msg: string) => {
    setShowSuggestions(false);
    sendMessage(msg);
  };

  const handleSuggestion = (q: string) => {
    setShowSuggestions(false);
    sendMessage(q);
  };

  const handleIngest = async () => {
    setIsIngesting(true);
    try {
      await triggerIngest(false);
      await new Promise(r => setTimeout(r, 2000));
      await loadStats();
    } catch {}
    setIsIngesting(false);
  };

  const indexReady = health?.index_ready ?? false;
  const totalVectors = stats?.total_vectors ?? 0;

  return (
    <div className="min-h-screen kerala-pattern flex flex-col" style={{ fontFamily: "'Outfit', sans-serif" }}>
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-700 text-gray-900 leading-tight" style={{ fontWeight: 700 }}>
                  Kerala Compliance AI
                </h1>
                <p className="text-xs text-gray-500 leading-tight hidden sm:block">
                  Business Regulation Assistant
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Index status */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
              indexReady
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${indexReady ? 'bg-green-500' : 'bg-amber-400'}`} />
              <span className="hidden sm:inline">
                {indexReady ? `${totalVectors.toLocaleString()} chunks` : 'Index empty'}
              </span>
              <span className="sm:hidden">
                {indexReady ? '●' : '○'}
              </span>
            </div>

            {/* Tabs */}
            {(['chat', 'upload', 'stats'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all hidden sm:flex items-center gap-1.5 ${
                  activeTab === tab
                    ? 'bg-green-700 text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {tab === 'chat' && <><Bot className="w-3.5 h-3.5" />Chat</>}
                {tab === 'upload' && <><Upload className="w-3.5 h-3.5" />Upload</>}
                {tab === 'stats' && <><BarChart2 className="w-3.5 h-3.5" />Stats</>}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="sm:hidden flex border-t border-gray-100">
          {(['chat', 'upload', 'stats'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'text-green-700 border-b-2 border-green-700'
                  : 'text-gray-500'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 flex gap-4">
        {/* Sidebar — desktop */}
        <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 gap-3">
          {/* About card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h2 className="text-xs font-700 text-gray-700 mb-3 flex items-center gap-1.5" style={{ fontWeight: 700 }}>
              <Sparkles className="w-3.5 h-3.5 text-green-600" />
              About
            </h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              AI assistant powered by official Kerala government documents. Ask about licenses, permits, SOPs, and compliance procedures.
            </p>
            <div className="mt-3 space-y-1.5">
              {[
                { icon: Building2, text: 'Restaurant & Hotel' },
                { icon: ScrollText, text: 'Factory & MSME' },
                { icon: BookOpen, text: 'Acts & Rules' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-xs text-gray-600">
                  <Icon className="w-3.5 h-3.5 text-green-600" />
                  {text}
                </div>
              ))}
            </div>
          </div>

          {/* Index status card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-700 text-gray-700" style={{ fontWeight: 700 }}>Index Status</h2>
              <button
                onClick={handleIngest}
                disabled={isIngesting}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                title="Re-index documents"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isIngesting ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {stats ? (
              <div className="space-y-2">
                <Stat label="Vectors" value={stats.total_vectors.toLocaleString()} />
                <Stat label="Documents" value={stats.total_documents.toString()} />
                <Stat label="Chunks" value={stats.total_chunks.toLocaleString()} />
                {Object.entries(stats.categories).map(([cat, count]) => (
                  <Stat key={cat} label={cat.split(' ')[0]} value={count.toString()} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Loading...</p>
            )}
          </div>

          {/* Quick topics */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h2 className="text-xs font-700 text-gray-700 mb-3" style={{ fontWeight: 700 }}>Quick Topics</h2>
            <div className="space-y-1">
              {[
                'Restaurant License',
                'Factory Act',
                'MSME Registration',
                'Fire NOC',
                'PCB Consent',
                'Trade License',
              ].map(topic => (
                <button
                  key={topic}
                  onClick={() => handleSuggestion(`What are the requirements for ${topic} in Kerala?`)}
                  className="w-full text-left text-xs text-gray-600 hover:text-green-700 hover:bg-green-50 px-2 py-1.5 rounded-lg transition-colors"
                >
                  → {topic}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {activeTab === 'chat' && (
            <div className="flex flex-col h-[calc(100vh-9rem)] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
                <CategoryFilter selected={categoryFilter} onChange={setCategoryFilter} />
                {messages.length > 0 && (
                  <button
                    onClick={clearChat}
                    className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messages.length === 0 ? (
                  <WelcomeScreen onSuggestion={handleSuggestion} />
                ) : (
                  messages.map(msg => (
                    <ChatMessageBubble key={msg.id} message={msg} />
                  ))
                )}
                {error && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                    {error}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                {!indexReady && (
                  <div className="mb-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-center gap-2">
                    <span>⚠️</span>
                    <span>Index is empty. Upload documents and run ingest first.</span>
                    <button
                      onClick={() => setActiveTab('upload')}
                      className="underline font-medium"
                    >
                      Upload →
                    </button>
                  </div>
                )}
                <ChatInput
                  onSend={handleSend}
                  onCancel={cancelStream}
                  isLoading={isLoading}
                  placeholder="Ask about Kerala business licenses, permits, compliance..."
                />
                <p className="text-center text-xs text-gray-400 mt-2">
                  AI responses are for guidance only. Verify with official government sources.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-6">
                <Upload className="w-5 h-5 text-green-700" />
                <h2 className="text-base font-600 text-gray-800" style={{ fontWeight: 600 }}>Upload Documents</h2>
              </div>
              <DocumentUpload onUploadDone={() => { loadStats(); setActiveTab('chat'); }} />
              <div className="mt-6 p-4 rounded-xl bg-green-50 border border-green-200">
                <p className="text-xs font-medium text-green-800 mb-2">Supported Document Types</p>
                <div className="grid grid-cols-2 gap-1">
                  {['PDF (.pdf)', 'Word (.docx)', 'Text (.txt)', 'HTML (.html)', 'Markdown (.md)'].map(t => (
                    <span key={t} className="text-xs text-green-700">✓ {t}</span>
                  ))}
                </div>
              </div>
              <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-200">
                <p className="text-xs font-medium text-blue-800 mb-2">💡 Folder Structure</p>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Organize documents in the backend's <code className="font-mono">data/kerala_rag/</code> folder by category,
                  then trigger re-index below.
                </p>
                <button
                  onClick={handleIngest}
                  disabled={isIngesting}
                  className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-medium hover:bg-blue-800 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isIngesting ? 'animate-spin' : ''}`} />
                  {isIngesting ? 'Indexing...' : 'Trigger Re-index'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-6">
                <BarChart2 className="w-5 h-5 text-green-700" />
                <h2 className="text-base font-600 text-gray-800" style={{ fontWeight: 600 }}>Index Statistics</h2>
              </div>
              {stats ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <StatCard label="Total Vectors" value={stats.total_vectors.toLocaleString()} accent="green" />
                    <StatCard label="Documents" value={stats.total_documents.toString()} accent="blue" />
                    <StatCard label="Chunks" value={stats.total_chunks.toLocaleString()} accent="orange" />
                  </div>
                  <div>
                    <h3 className="text-sm font-600 text-gray-700 mb-3" style={{ fontWeight: 600 }}>By Category</h3>
                    <div className="space-y-2">
                      {Object.entries(stats.categories).map(([cat, count]) => {
                        const pct = Math.round((count / stats.total_chunks) * 100);
                        return (
                          <div key={cat}>
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>{cat}</span>
                              <span>{count} chunks ({pct}%)</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full bg-green-600 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Loading statistics...</p>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function WelcomeScreen({ onSuggestion }: { onSuggestion: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-8 px-4">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center mb-4 shadow-lg">
        <Bot className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-xl font-700 text-gray-800 text-center mb-2" style={{ fontWeight: 700 }}>
        Kerala Compliance Assistant
      </h2>
      <p className="text-sm text-gray-500 text-center max-w-md mb-8">
        Ask me anything about Kerala business licenses, permits, registrations, and regulatory compliance.
        My answers are backed by official government documents.
      </p>
      <div className="w-full max-w-lg">
        <p className="text-xs font-medium text-gray-500 mb-3 text-center">Suggested questions</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SUGGESTED_QUESTIONS.slice(0, 6).map((q, i) => (
            <button
              key={i}
              onClick={() => onSuggestion(q)}
              className="text-left text-xs text-gray-700 bg-white hover:bg-green-50 hover:border-green-300 border border-gray-200 rounded-xl px-3 py-2.5 transition-all hover:shadow-sm"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="font-600 text-gray-700" style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-50 border-green-200 text-green-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[accent]}`}>
      <p className="text-2xl font-700" style={{ fontWeight: 700 }}>{value}</p>
      <p className="text-xs mt-1 opacity-75">{label}</p>
    </div>
  );
}
