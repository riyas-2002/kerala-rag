'use client';
import { useState, useRef } from 'react';
import { Upload, X, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { uploadDocument } from '@/utils/api';

const CATEGORIES = [
  'acts_rules',
  'licenses',
  'sop_guidelines',
  'forms',
  'faqs',
  'central_laws',
  'business_maps',
];

const CATEGORY_LABELS: Record<string, string> = {
  acts_rules: 'Acts & Rules',
  licenses: 'Licenses & Permits',
  sop_guidelines: 'SOPs & Guidelines',
  forms: 'Forms & Applications',
  faqs: 'FAQs',
  central_laws: 'Central Laws',
  business_maps: 'Business Type Maps',
};

interface UploadItem {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  message?: string;
}

export function DocumentUpload({ onUploadDone }: { onUploadDone?: () => void }) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [category, setCategory] = useState('licenses');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const allowed = ['.pdf', '.docx', '.txt', '.html', '.md'];
    const newItems: UploadItem[] = [];
    for (const file of Array.from(files)) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (allowed.includes(ext)) {
        newItems.push({ file, status: 'pending' });
      }
    }
    setItems(prev => [...prev, ...newItems]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const uploadAll = async () => {
    const pending = items.filter(i => i.status === 'pending');
    for (let i = 0; i < items.length; i++) {
      if (items[i].status !== 'pending') continue;
      setItems(prev =>
        prev.map((it, idx) => idx === i ? { ...it, status: 'uploading' } : it)
      );
      try {
        const result = await uploadDocument(items[i].file, category);
        setItems(prev =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: 'done', message: result.message } : it
          )
        );
      } catch (err: any) {
        setItems(prev =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: 'error', message: err.message } : it
          )
        );
      }
    }
    onUploadDone?.();
  };

  const pendingCount = items.filter(i => i.status === 'pending').length;

  return (
    <div className="space-y-4">
      {/* Category selector */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Category</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 bg-white text-gray-700 focus:outline-none focus:border-green-400"
        >
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-green-500 bg-green-50'
            : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
        }`}
      >
        <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600">
          Drop files here or <span className="text-green-700 font-medium">browse</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">PDF, DOCX, TXT, HTML, Markdown — max 20MB</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.html,.htm,.md"
          className="hidden"
          onChange={e => addFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-100">
              <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{item.file.name}</p>
                {item.message && (
                  <p className="text-xs text-gray-400 truncate">{item.message}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {item.status === 'uploading' && (
                  <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                )}
                {item.status === 'done' && <CheckCircle className="w-4 h-4 text-green-600" />}
                {item.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                {item.status === 'pending' && (
                  <button onClick={() => removeItem(i)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {pendingCount > 0 && (
        <button
          onClick={uploadAll}
          className="w-full py-2 rounded-lg bg-green-700 text-white text-sm font-medium hover:bg-green-800 transition-colors"
        >
          Upload {pendingCount} file{pendingCount !== 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}
