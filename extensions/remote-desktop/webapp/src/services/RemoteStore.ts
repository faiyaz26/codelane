import { createSignal, createRoot } from 'solid-js';

export interface Lane {
  id: string;
  name: string;
  workingDir: string;
  branch?: string;
  laneType: 'local' | 'pr_review';
}

export interface ChatMessage {
  id: string;
  role: 'agent' | 'user' | 'system';
  content: string;
  timestamp: number;
  actions?: { label: string; value: string }[];
}

function createRemoteStore() {
  const [lanes, setLanes] = createSignal<Lane[]>([]);
  const [activeLaneId, setActiveLaneId] = createSignal<string | null>(null);
  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [viewMode, setViewMode] = createSignal<'chat' | 'terminal'>('chat');

  const addMessage = (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...msg,
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const updateLastMessage = (content: string) => {
    setMessages(prev => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], content };
      return next;
    });
  };

  const updateLastMessageActions = (actions: { label: string; value: string }[]) => {
    setMessages(prev => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], actions };
      return next;
    });
  };

  return {
    lanes,
    setLanes,
    activeLaneId,
    setActiveLaneId,
    messages,
    setMessages,
    addMessage,
    updateLastMessage,
    updateLastMessageActions,
    viewMode,
    setViewMode,
  };
}

export const remoteStore = createRoot(createRemoteStore);
