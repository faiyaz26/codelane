// API Keys Settings Tab

export function ApiKeysSettings() {
  return (
    <div>
      <h2 class="text-xl font-semibold text-zed-text-primary mb-2">API Keys</h2>
      <p class="text-sm text-zed-text-secondary mb-6">
        Manage API keys for AI model providers.
      </p>

      <div class="space-y-6">
        <div class="p-6 rounded-lg bg-zed-bg-surface border border-zed-border-default text-center">
          <svg class="w-12 h-12 mx-auto mb-3 text-zed-text-disabled" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <p class="text-sm text-zed-text-tertiary">API key management coming soon</p>
          <p class="text-xs text-zed-text-disabled mt-1">OpenAI, Anthropic, and more</p>
        </div>
      </div>
    </div>
  );
}
