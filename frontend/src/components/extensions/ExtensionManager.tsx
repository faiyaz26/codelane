import { createSignal, onMount, For, Show } from 'solid-js';
import { 
  listExtensions, 
  startExtension, 
  stopExtension, 
  getExtensionRegistry,
  installExtension,
  type ExtensionManifest,
  type RegistryExtension
} from '../../lib/extension-api';

type Tab = 'installed' | 'marketplace';

export function ExtensionManager() {
  const [activeTab, setActiveTab] = createSignal<Tab>('installed');
  const [installedExtensions, setInstalledExtensions] = createSignal<ExtensionManifest[]>([]);
  const [registryExtensions, setRegistryExtensions] = createSignal<RegistryExtension[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [installingIds, setInstallingIds] = createSignal<Set<string>>(new Set());
  const [error, setError] = createSignal<string | null>(null);

  const fetchInstalled = async (force = false) => {
    try {
      const list = await listExtensions(force);
      setInstalledExtensions(list);
    } catch (e) {
      console.error('Failed to fetch installed extensions:', e);
    }
  };

  const fetchRegistry = async () => {
    try {
      const registry = await getExtensionRegistry();
      setRegistryExtensions(registry.extensions);
    } catch (e) {
      console.error('Failed to fetch extension registry:', e);
      setError("Failed to load Marketplace. Ensure you are online.");
    }
  };

  const refresh = async () => {
    setLoading(true);
    setError(null);
    if (activeTab() === 'installed') {
      await fetchInstalled(true);
    } else {
      await fetchRegistry();
    }
    setLoading(false);
  };

  onMount(async () => {
    setLoading(true);
    await Promise.all([fetchInstalled(), fetchRegistry()]);
    setLoading(false);
  });

  const handleStart = async (id: string) => {
    try {
      await startExtension(id);
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

  const handleInstall = async (ext: RegistryExtension) => {
    // Basic permissions confirmation (could be a dialog later)
    const confirmed = confirm(`Install ${ext.name} v${ext.version}?\n\nPermissions requested:\n${ext.permissions.join(', ')}`);
    if (!confirmed) return;

    setInstallingIds(prev => new Set(prev).add(ext.id));
    try {
      await installExtension(ext.download_url, ext.sha256);
      await fetchInstalled(true);
      setActiveTab('installed');
    } catch (e) {
      alert(`Installation failed: ${e}`);
    } finally {
      setInstallingIds(prev => {
        const next = new Set(prev);
        next.delete(ext.id);
        return next;
      });
    }
  };

  const isInstalled = (id: string) => installedExtensions().some(e => e.id === id);

  return (
    <div class="flex flex-col h-full bg-zed-bg-panel text-sm">
      {/* Header & Tabs */}
      <div class="bg-zed-bg-header border-b border-zed-border-subtle">
        <div class="p-4 flex justify-between items-center pb-2">
          <h2 class="text-zed-text-primary font-medium text-base">Extensions</h2>
          <button 
            onClick={refresh}
            class="p-1 hover:bg-zed-bg-hover rounded text-zed-text-tertiary transition-colors"
            title="Refresh"
          >
            <svg class={`w-4 h-4 ${loading() ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        
        <div class="flex px-4 gap-4">
          <button 
            onClick={() => setActiveTab('installed')}
            class={`pb-2 px-1 text-xs font-medium transition-colors border-b-2 ${
              activeTab() === 'installed' 
                ? 'text-zed-accent-blue border-zed-accent-blue' 
                : 'text-zed-text-tertiary border-transparent hover:text-zed-text-secondary'
            }`}
          >
            Installed
          </button>
          <button 
            onClick={() => setActiveTab('marketplace')}
            class={`pb-2 px-1 text-xs font-medium transition-colors border-b-2 ${
              activeTab() === 'marketplace' 
                ? 'text-zed-accent-blue border-zed-accent-blue' 
                : 'text-zed-text-tertiary border-transparent hover:text-zed-text-secondary'
            }`}
          >
            Marketplace
          </button>
        </div>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto">
        <Show when={loading() && installedExtensions().length === 0 && registryExtensions().length === 0}>
          <div class="p-8 text-center text-zed-text-tertiary">
            <div class="animate-spin w-6 h-6 border-2 border-zed-accent-blue border-t-transparent rounded-full mx-auto mb-2"></div>
            Loading...
          </div>
        </Show>

        <Show when={error()}>
          <div class="p-4 m-4 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-xs">
            {error()}
          </div>
        </Show>

        <Switch>
          <Match when={activeTab() === 'installed'}>
            <Show when={!loading() && installedExtensions().length === 0}>
              <div class="p-8 text-center text-zed-text-tertiary text-xs">
                No extensions installed yet.
                <button 
                  onClick={() => setActiveTab('marketplace')}
                  class="block mx-auto mt-2 text-zed-accent-blue hover:underline"
                >
                  Browse Marketplace
                </button>
              </div>
            </Show>
            <div class="divide-y divide-zed-border-subtle">
              <For each={installedExtensions()}>
                {(ext) => (
                  <div class="p-4 hover:bg-zed-bg-hover transition-colors group">
                    <div class="flex justify-between items-start mb-1">
                      <h3 class="font-medium text-zed-text-primary group-hover:text-zed-accent-blue transition-colors">
                        {ext.name}
                      </h3>
                      <span class="text-[10px] text-zed-text-tertiary bg-zed-bg-panel px-1.5 py-0.5 rounded border border-zed-border-subtle">
                        v{ext.version}
                      </span>
                    </div>
                    <p class="text-xs text-zed-text-secondary mb-3 leading-relaxed">
                      {ext.description || 'No description provided.'}
                    </p>
                    <div class="flex gap-2">
                      <button
                        onClick={() => handleStart(ext.id)}
                        class="px-3 py-1 bg-zed-accent-blue hover:bg-zed-accent-blue-hover text-white text-[11px] rounded transition-colors font-medium"
                      >
                        Enable
                      </button>
                      <button
                        onClick={() => handleStop(ext.id)}
                        class="px-3 py-1 bg-zed-bg-panel hover:bg-red-900/40 text-zed-text-tertiary hover:text-red-400 border border-zed-border-subtle hover:border-red-500/50 text-[11px] rounded transition-all font-medium"
                      >
                        Disable
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Match>

          <Match when={activeTab() === 'marketplace'}>
            <div class="divide-y divide-zed-border-subtle">
              <For each={registryExtensions()}>
                {(ext) => (
                  <div class="p-4 hover:bg-zed-bg-hover transition-colors group">
                    <div class="flex justify-between items-start mb-1">
                      <h3 class="font-medium text-zed-text-primary group-hover:text-zed-accent-blue transition-colors">
                        {ext.name}
                      </h3>
                      <span class="text-[10px] text-zed-text-tertiary bg-zed-bg-panel px-1.5 py-0.5 rounded border border-zed-border-subtle">
                        v{ext.version}
                      </span>
                    </div>
                    <p class="text-xs text-zed-text-secondary mb-2 leading-relaxed">
                      {ext.description}
                    </p>
                    
                    <div class="mb-3">
                      <p class="text-[10px] text-zed-text-tertiary uppercase tracking-wider font-semibold mb-1">Permissions</p>
                      <div class="flex flex-wrap gap-1">
                        <For each={ext.permissions}>
                          {(perm) => (
                            <span class="text-[9px] bg-zed-bg-header text-zed-text-secondary px-1.5 py-0.5 rounded border border-zed-border-subtle">
                              {perm}
                            </span>
                          )}
                        </For>
                      </div>
                    </div>

                    <button
                      disabled={isInstalled(ext.id) || installingIds().has(ext.id)}
                      onClick={() => handleInstall(ext)}
                      class={`w-full py-1.5 rounded text-[11px] font-medium transition-all ${
                        isInstalled(ext.id)
                          ? 'bg-green-900/20 text-green-400 border border-green-500/30 cursor-default'
                          : 'bg-zed-accent-blue hover:bg-zed-accent-blue-hover text-white shadow-sm'
                      }`}
                    >
                      <Show when={installingIds().has(ext.id)} fallback={isInstalled(ext.id) ? 'Installed' : 'Install'}>
                        Installing...
                      </Show>
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Match>
        </Switch>
      </div>
      
      <div class="p-3 border-t border-zed-border-subtle bg-zed-bg-panel text-[10px] text-zed-text-tertiary">
        <p class="leading-relaxed opacity-60">
          Extensions are managed in <code class="bg-zed-bg-header px-1 py-0.5 rounded">~/.codelane/dev/extensions</code>
        </p>
      </div>
    </div>
  );
}

// Add Switch and Match to solid-js imports if they are not there
import { Switch, Match } from 'solid-js';
