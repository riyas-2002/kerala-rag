'use client';
import { useState, useRef, KeyboardEvent } from 'react';
import { Send, Square, Mic } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, onCancel, isLoading, placeholder }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }
  };

  return (
    <div className="flex items-end gap-2 bg-white rounded-2xl border border-gray-200 shadow-sm px-3 py-2 focus-within:border-green-400 focus-within:shadow-md transition-all">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        disabled={isLoading}
        rows={1}
        placeholder={placeholder || 'Ask about Kerala business compliance...'}
        className="flex-1 resize-none bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400 py-1.5 leading-relaxed max-h-40"
      />
      <div className="flex items-center gap-1 flex-shrink-0 pb-1">
        {isLoading ? (
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors"
            title="Cancel"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="w-8 h-8 rounded-full bg-green-700 text-white hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            title="Send (Enter)"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
