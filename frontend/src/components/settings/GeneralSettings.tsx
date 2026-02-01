// General Settings Tab

export function GeneralSettings() {
  return (
    <div>
      <h2 class="text-xl font-semibold text-zed-text-primary mb-2">General Settings</h2>
      <p class="text-sm text-zed-text-secondary mb-6">
        Configure general application settings.
      </p>

      <div class="space-y-6">
        <div class="p-6 rounded-lg bg-zed-bg-surface border border-zed-border-default text-center">
          <svg class="w-12 h-12 mx-auto mb-3 text-zed-text-disabled" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          <p class="text-sm text-zed-text-tertiary">General settings coming soon</p>
        </div>
      </div>
    </div>
  );
}
