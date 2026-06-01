'use client';
import { X } from 'lucide-react';

const CATEGORIES = [
  { key: null, label: 'All Topics' },
  { key: 'Licenses & Permits', label: '📋 Licenses' },
  { key: 'Acts & Rules', label: '⚖️ Acts & Rules' },
  { key: 'SOPs & Guidelines', label: '📖 Guidelines' },
  { key: 'Forms & Applications', label: '📄 Forms' },
  { key: 'FAQs', label: '❓ FAQs' },
  { key: 'Central Laws', label: '🏛️ Central Laws' },
];

interface CategoryFilterProps {
  selected: string | null;
  onChange: (cat: string | null) => void;
}

export function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500 font-medium flex-shrink-0">Filter:</span>
      <div className="flex gap-1.5 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key || 'all'}
            onClick={() => onChange(cat.key)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
              selected === cat.key
                ? 'bg-green-700 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-green-300 hover:text-green-700'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
      {selected && (
        <button
          onClick={() => onChange(null)}
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5"
        >
          <X className="w-3 h-3" />
          Clear
        </button>
      )}
    </div>
  );
}
