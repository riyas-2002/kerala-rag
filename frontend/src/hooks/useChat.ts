'use client';
// Kerala RAG — useChat Hook
// Manages chat state, streaming, and conversation history

import { useState, useCallback, useRef } from 'react';
import { streamChat, ChatMessage, Source, BusinessContext } from '@/utils/api';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  businessContext?: BusinessContext;
  isStreaming?: boolean;
  timestamp: Date;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (query: string) => {
    if (!query.trim() || isLoading) return;

    setError(null);

    // Add user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date(),
    };

    // Add placeholder assistant message
    const assistantId = `assistant-${Date.now()}`;
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsLoading(true);

    // Build history from previous messages (exclude last 2 which are new)
    const history: ChatMessage[] = messages
      .slice(-6) // last 3 turns
      .map(m => ({ role: m.role, content: m.content }));

    // Abort controller for cancellation
    abortRef.current = new AbortController();

    let sources: Source[] = [];
    let businessContext: BusinessContext | undefined;
    let accumulatedContent = '';

    try {
      await streamChat(
        query,
        history,
        categoryFilter,
        (event) => {
          if (event.type === 'sources') {
            sources = event.sources || [];
            businessContext = event.business_context;
            // Update the assistant message with sources immediately
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantId
                  ? { ...m, sources, businessContext }
                  : m
              )
            );
          } else if (event.type === 'token') {
            accumulatedContent += event.content || '';
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantId
                  ? { ...m, content: accumulatedContent }
                  : m
              )
            );
          } else if (event.type === 'done') {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantId
                  ? { ...m, isStreaming: false }
                  : m
              )
            );
            setIsLoading(false);
          } else if (event.type === 'error') {
            setError(event.message || 'Unknown error');
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: `Sorry, an error occurred: ${event.message}`,
                      isStreaming: false,
                    }
                  : m
              )
            );
            setIsLoading(false);
          }
        },
        abortRef.current.signal
      );
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, content: accumulatedContent || 'Response cancelled.', isStreaming: false }
              : m
          )
        );
      } else {
        const errMsg = err.message || 'Failed to connect to API';
        setError(errMsg);
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, content: `Connection error: ${errMsg}`, isStreaming: false }
              : m
          )
        );
      }
      setIsLoading(false);
    }
  }, [messages, isLoading, categoryFilter]);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    categoryFilter,
    setCategoryFilter,
    sendMessage,
    cancelStream,
    clearChat,
  };
}
