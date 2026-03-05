import { For, Show, createEffect } from 'solid-js';
import { remoteStore } from '../services/RemoteStore';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface RemoteChatViewProps {
  onAction?: (value: string) => void;
}

export function RemoteChatView(props: RemoteChatViewProps) {
  let scrollContainer: HTMLDivElement | undefined;

  const autoScroll = () => {
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  };

  createEffect(() => {
    remoteStore.messages();
    setTimeout(autoScroll, 50);
  });

  const renderMarkdown = (content: string) => {
    try {
      const rawHtml = marked.parse(content, { breaks: true, gfm: true });
      // marked.parse returns string | Promise<string> depending on async extensions. 
      // Assuming sync here.
      return DOMPurify.sanitize(rawHtml as string);
    } catch (e) {
      return content;
    }
  };

  return (
    <div 
      ref={scrollContainer}
      class="h-full w-full flex flex-col gap-4 overflow-y-auto p-4 bg-zed-bg-app no-scrollbar"
    >
      <Show when={remoteStore.messages().length === 0}>
        <div class="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-40">
          <div class="w-16 h-16 mb-4 rounded-full bg-zed-bg-surface flex items-center justify-center">
            <svg class="w-8 h-8 text-zed-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p class="text-sm font-medium">Waiting for Agent output...</p>
          <p class="text-xs mt-1">Activity in the terminal will appear here as a chat.</p>
        </div>
      </Show>

      <For each={remoteStore.messages()}>
        {(msg) => (
          <div 
            class={`flex flex-col max-w-[85%] ${
              msg.role === 'user' ? 'self-end' : 'self-start'
            }`}
          >
            <div 
              class={`px-4 py-3 rounded-2xl text-sm leading-relaxed flex flex-col gap-2 ${
                msg.role === 'user' 
                  ? 'bg-zed-accent-blue text-white rounded-br-none shadow-md' 
                  : msg.role === 'system'
                  ? 'bg-zed-bg-surface text-zed-text-tertiary text-xs italic border border-zed-border-subtle rounded-lg px-2 py-1 self-center'
                  : 'bg-zed-bg-panel text-zed-text-primary rounded-bl-none border border-zed-border-subtle shadow-sm'
              }`}
            >
              <div 
                class="markdown-body font-sans break-words overflow-x-auto"
                innerHTML={msg.role === 'user' ? msg.content : renderMarkdown(msg.content)} 
              />
              
              <Show when={msg.actions && msg.actions.length > 0}>
                <div class="flex flex-wrap gap-2 mt-2 pt-2 border-t border-zed-border-default/50">
                  <For each={msg.actions}>
                    {(action) => (
                      <button
                        onClick={() => {
                          if (props.onAction) props.onAction(action.value);
                        }}
                        class="px-3 py-1.5 bg-zed-bg-surface hover:bg-zed-bg-hover border border-zed-border-default rounded-md text-xs font-medium transition-colors active:bg-zed-accent-blue active:text-white"
                      >
                        {action.label}
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>
            <div 
              class={`text-[9px] mt-1 text-zed-text-disabled uppercase tracking-tighter ${
                msg.role === 'user' ? 'text-right mr-1' : 'ml-1'
              }`}
            >
              {msg.role === 'user' ? 'You' : 'Agent'}
            </div>
          </div>
        )}
      </For>
      
      {/* Invisible spacer for bottom padding */}
      <div class="h-4 shrink-0" />
    </div>
  );
}
