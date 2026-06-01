'use client';
import { FileText, ExternalLink } from 'lucide-react';
import { Source, getCategoryColor, formatScore } from '@/utils/api';

interface SourceCardProps {
  source: Source;
}

export function SourceCard({ source }: SourceCardProps) {
  const colorClass = getCategoryColor(source.category);
  const relevance = Math.round(source.score * 100);

  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-white border border-gray-100 hover:border-green-200 transition-colors">
      <div className="mt-0.5 p-1.5 rounded-md bg-green-50 flex-shrink-0">
        <FileText className="w-3 h-3 text-green-700" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 truncate leading-tight">
          {source.title || source.file}
        </p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border ${colorClass}`}>
            {source.category}
          </span>
          <span className="text-xs text-gray-400">
            {relevance}% match
          </span>
        </div>
      </div>
    </div>
  );
}

interface SourcesPanelProps {
  sources: Source[];
  businessContext?: {
    business_type: string;
    licenses?: string[];
    departments?: string[];
  };
}

export function SourcesPanel({ sources, businessContext }: SourcesPanelProps) {
  if (!sources?.length && !businessContext) return null;

  return (
    <div className="mt-3 space-y-2">
      {businessContext && (
        <div className="p-2.5 rounded-lg bg-green-50 border border-green-200">
          <p className="text-xs font-semibold text-green-800 mb-1.5">
            📋 {businessContext.business_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} — Required Licenses
          </p>
          <ul className="space-y-0.5">
            {businessContext.licenses?.map((lic, i) => (
              <li key={i} className="text-xs text-green-700 flex items-start gap-1">
                <span className="mt-0.5 flex-shrink-0">✓</span>
                {lic}
              </li>
            ))}
          </ul>
          {businessContext.departments?.length && (
            <p className="text-xs text-green-600 mt-1.5">
              <strong>Departments:</strong> {businessContext.departments.join(', ')}
            </p>
          )}
        </div>
      )}

      {sources.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 font-medium mb-1.5">Sources ({sources.length})</p>
          <div className="space-y-1.5">
            {sources.map((src, i) => (
              <SourceCard key={i} source={src} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
