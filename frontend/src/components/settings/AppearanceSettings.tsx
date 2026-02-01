// Appearance Settings Tab

export function AppearanceSettings() {
  return (
    <div>
      <h2 class="text-xl font-semibold text-zed-text-primary mb-2">Appearance</h2>
      <p class="text-sm text-zed-text-secondary mb-6">
        Customize the look and feel of Codelane.
      </p>

      <div class="space-y-6">
        <div class="p-6 rounded-lg bg-zed-bg-surface border border-zed-border-default text-center">
          <svg class="w-12 h-12 mx-auto mb-3 text-zed-text-disabled" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          <p class="text-sm text-zed-text-tertiary">Appearance settings coming soon</p>
          <p class="text-xs text-zed-text-disabled mt-1">Theme customization, fonts, and more</p>
        </div>
      </div>
    </div>
  );
}
