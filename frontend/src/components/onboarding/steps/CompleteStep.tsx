import type { WizardData } from '../OnboardingWizard';

interface CompleteStepProps {
  data: WizardData;
}

export function CompleteStep(props: CompleteStepProps) {
  return (
    <div class="max-w-2xl mx-auto text-center">
      {/* Success Icon */}
      <div class="mb-6">
        <div class="w-20 h-20 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-4">
          <svg class="w-10 h-10 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
        </div>
        <h1 class="text-3xl font-bold text-zed-text-primary mb-2">
          You're All Set!
        </h1>
        <p class="text-lg text-zed-text-secondary">
          Codelane is ready to supercharge your development workflow
        </p>
      </div>

      {/* Configuration Summary */}
      <div class="bg-zed-bg-hover p-6 rounded-lg mb-6 text-left">
        <h3 class="font-semibold text-zed-text-primary mb-4">Your Configuration</h3>
        <div class="space-y-3">
          {/* Agent */}
          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <div>
              <span class="text-sm font-medium text-zed-text-primary">Agent: </span>
              <span class="text-sm text-zed-text-secondary">
                {props.data.agent?.agentType || 'Not configured'}
              </span>
            </div>
          </div>

          {/* Hooks */}
          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <div>
              <span class="text-sm font-medium text-zed-text-primary">Hooks: </span>
              <span class="text-sm text-zed-text-secondary">
                {props.data.hooksEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          {/* Notifications */}
          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <div>
              <span class="text-sm font-medium text-zed-text-primary">Notifications: </span>
              <span class="text-sm text-zed-text-secondary">
                {Object.values(props.data.notifications).filter(Boolean).length} enabled
              </span>
            </div>
          </div>

          {/* Theme */}
          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <div>
              <span class="text-sm font-medium text-zed-text-primary">Theme: </span>
              <span class="text-sm text-zed-text-secondary capitalize">
                {props.data.theme.replace('-', ' ')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Tips */}
      <div class="bg-zed-bg-hover p-6 rounded-lg mb-6 text-left">
        <h3 class="font-semibold text-zed-text-primary mb-4">Quick Tips to Get Started</h3>
        <div class="space-y-3 text-sm text-zed-text-secondary">
          <div class="flex items-start gap-3">
            <span class="text-xl flex-shrink-0">1️⃣</span>
            <p>
              <span class="font-medium text-zed-text-primary">Create your first lane</span> with{' '}
              <kbd class="px-2 py-0.5 bg-zed-bg-active rounded text-xs font-mono">⌘/Ctrl+N</kbd>
            </p>
          </div>
          <div class="flex items-start gap-3">
            <span class="text-xl flex-shrink-0">2️⃣</span>
            <p>
              <span class="font-medium text-zed-text-primary">Access tutorials anytime</span> from Help menu
            </p>
          </div>
          <div class="flex items-start gap-3">
            <span class="text-xl flex-shrink-0">3️⃣</span>
            <p>
              <span class="font-medium text-zed-text-primary">Configure more settings</span> with{' '}
              <kbd class="px-2 py-0.5 bg-zed-bg-active rounded text-xs font-mono">⌘/Ctrl+,</kbd>
            </p>
          </div>
          <div class="flex items-start gap-3">
            <span class="text-xl flex-shrink-0">4️⃣</span>
            <p>
              <span class="font-medium text-zed-text-primary">Watch status indicators</span> to know when your agent needs attention
            </p>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <p class="text-zed-text-tertiary text-sm">
        Ready to start building? Click "Get Started" below.
      </p>
    </div>
  );
}
