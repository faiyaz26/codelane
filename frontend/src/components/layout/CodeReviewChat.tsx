import { createSignal, For } from 'solid-js';

interface CodeReviewChatProps {
  laneId: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Demo data
const DEMO_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    sender: 'assistant',
    content: "I've analyzed the code changes. The new authentication flow looks good, but I have a few suggestions.",
    timestamp: new Date(Date.now() - 300000),
  },
  {
    id: '2',
    sender: 'user',
    content: 'What suggestions do you have?',
    timestamp: new Date(Date.now() - 240000),
  },
  {
    id: '3',
    sender: 'assistant',
    content: 'Consider adding error handling for the JWT token validation in auth.ts. Also, the password hashing could use a higher cost factor.',
    timestamp: new Date(Date.now() - 180000),
  },
];

export function CodeReviewChat(props: CodeReviewChatProps) {
  const [messages, setMessages] = createSignal<ChatMessage[]>(DEMO_MESSAGES);
  const [inputValue, setInputValue] = createSignal('');

  const handleSendMessage = () => {
    const content = inputValue().trim();
    if (!content) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages([...messages(), newMessage]);
    setInputValue('');

    // Simulate assistant response
    setTimeout(() => {
      const response: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        content: "I'll review that change and get back to you.",
        timestamp: new Date(),
      };
      setMessages([...messages(), response]);
    }, 1000);
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString();
  };

  return (
    <div class="flex-1 flex flex-col bg-zed-bg-panel min-w-0">
      {/* Chat Header */}
      <div class="h-10 border-b border-zed-border-subtle flex items-center px-4">
        <svg class="w-4 h-4 mr-2 text-zed-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
        <span class="text-sm font-medium text-zed-text-primary">Code Review Chat</span>
      </div>

      {/* Messages Area */}
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <For each={messages()}>
          {(message) => (
            <div
              class={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                class={`max-w-[75%] rounded-lg px-4 py-2.5 ${
                  message.sender === 'user'
                    ? 'bg-zed-accent-blue text-white'
                    : 'bg-zed-bg-hover text-zed-text-primary border border-zed-border-subtle'
                }`}
              >
                <div class="text-sm leading-relaxed">{message.content}</div>
                <div
                  class={`text-xs mt-1.5 ${
                    message.sender === 'user' ? 'text-blue-100' : 'text-zed-text-tertiary'
                  }`}
                >
                  {formatTime(message.timestamp)}
                </div>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Input Area */}
      <div class="border-t border-zed-border-subtle p-4 bg-zed-bg-app">
        <div class="flex gap-3">
          <input
            type="text"
            value={inputValue()}
            onInput={(e) => setInputValue(e.currentTarget.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Ask about the changes..."
            class="flex-1 bg-zed-bg-panel border border-zed-border-subtle rounded px-3 py-2.5 text-sm text-zed-text-primary placeholder-zed-text-tertiary focus:outline-none focus:border-zed-accent-blue transition-colors"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue().trim()}
            class="px-5 py-2.5 bg-zed-accent-blue text-white rounded text-sm font-medium hover:bg-opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
