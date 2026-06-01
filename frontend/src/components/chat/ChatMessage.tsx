'use client';
import { Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '@/hooks/useChat';
import { SourcesPanel } from './SourceCard';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessageBubble({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-slide-up`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-gradient-to-br from-green-600 to-green-800'
            : 'bg-white border-2 border-green-200'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-green-700" />
        )}
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={isUser ? 'chat-user px-4 py-2.5' : 'chat-assistant px-4 py-3'}>
          {isUser ? (
            <p className="text-sm leading-relaxed">{message.content}</p>
          ) : (
            <>
              {message.content ? (
                <div className="chat-prose text-sm leading-relaxed text-gray-800">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
              ) : message.isStreaming ? (
                <LoadingDots />
              ) : null}

              {/* Sources */}
              {!message.isStreaming && (
                <SourcesPanel
                  sources={message.sources || []}
                  businessContext={message.businessContext}
                />
              )}

              {/* Streaming indicator */}
              {message.isStreaming && message.content && (
                <span className="inline-block w-1 h-4 bg-green-600 animate-pulse ml-0.5 align-text-bottom" />
              )}
            </>
          )}
        </div>
        <span className="text-xs text-gray-400 mt-1 px-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <div className="w-2 h-2 rounded-full bg-green-400 dot-1" />
      <div className="w-2 h-2 rounded-full bg-green-400 dot-2" />
      <div className="w-2 h-2 rounded-full bg-green-400 dot-3" />
    </div>
  );
}
