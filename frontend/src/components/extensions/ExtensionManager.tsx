import { createSignal, onMount, For, Show } from 'solid-js';
import { listExtensions, startExtension, stopExtension, type ExtensionManifest } from '../../lib/extension-api';

export function ExtensionManager() {
  const [extensions, setExtensions] = createSignal<ExtensionManifest[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  const fetchExtensions = async (force = false) => {
    setLoading(true);
    try {
      const list = await listExtensions(force);
      setExtensions(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    fetchExtensions(false);
  });

  const handleStart = async (id: string) => {
    try {
      await startExtension(id);
      // We don't have a "running" state in the manifest yet, but we can re-fetch
      // or assume it's starting. For now, just a toast or log.
      console.info(`Started extension ${id}`);
    } catch (e) {
      console.error(`Failed to start extension ${id}:`, e);
    }
  };

  const handleStop = async (id: string) => {
    try {
      await stopExtension(id);
      console.info(`Stopped extension ${id}`);
    } catch (e) {
      console.error(`Failed to stop extension ${id}:`, e);
    }
  };

  return (
    <div class="flex flex-col h-full bg-zed-bg-panel text-sm">
      <div class="p-4 border-b border-zed-border-subtle flex justify-between items-center bg-zed-bg-header">
        <h2 class="text-zed-text-primary font-medium">Available Extensions</h2>
        <button 
          onClick={() => fetchExtensions(true)}
          class="p-1 hover:bg-zed-bg-hover rounded text-zed-text-tertiary transition-colors"
          title="Refresh list"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <Show when={loading()}>
          <div class="p-8 text-center text-zed-text-tertiary">
            <div class="animate-spin w-6 h-6 border-2 border-zed-accent-blue border-t-transparent rounded-full mx-auto mb-2"></div>
            Loading extensions...
          </div>
        </Show>

        <Show when={error()}>
          <div class="p-4 m-4 bg-red-900/20 border border-red-500/30 rounded text-red-400">
            {error()}
          </div>
        </Show>

        <Show when={!loading() && extensions().length === 0}>
          <div class="p-8 text-center text-zed-text-tertiary">
            No extensions found in ~/.codelane/dev/extensions
          </div>
        </Show>

        <div class="divide-y divide-zed-border-subtle">
          <For each={extensions()}>
            {(ext) => (
              <div class="p-4 hover:bg-zed-bg-hover transition-colors group">
                <div class="flex justify-between items-start mb-1">
                  <h3 class="font-medium text-zed-text-primary group-hover:text-zed-accent-blue transition-colors">
                    {ext.name}
                  </h3>
                  <span class="text-xs text-zed-text-tertiary bg-zed-bg-panel px-1.5 py-0.5 rounded border border-zed-border-subtle">
                    v{ext.version}
                  </span>
                </div>
                
                <p class="text-xs text-zed-text-secondary mb-3 leading-relaxed">
                  {ext.description || 'No description provided.'}
                </p>

                <div class="flex gap-2">
                  <button
                    onClick={() => handleStart(ext.id)}
                    class="px-3 py-1 bg-zed-accent-blue hover:bg-zed-accent-blue-hover text-white text-xs rounded transition-colors flex items-center gap-1.5 font-medium shadow-sm"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                    Enable
                  </button>
                  <button
                    onClick={() => handleStop(ext.id)}
                    class="px-3 py-1 bg-zed-bg-panel hover:bg-red-900/40 text-zed-text-tertiary hover:text-red-400 border border-zed-border-subtle hover:border-red-500/50 text-xs rounded transition-all flex items-center gap-1.5 font-medium shadow-sm"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Disable
                  </button>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
      
      <div class="p-3 border-t border-zed-border-subtle bg-zed-bg-panel text-[10px] text-zed-text-tertiary">
        <p class="leading-relaxed opacity-60">
          Extensions are loaded from <code class="bg-zed-bg-header px-1 py-0.5 rounded">~/.codelane/dev/extensions</code>
        </p>
      </div>
    </div>
  );
}
