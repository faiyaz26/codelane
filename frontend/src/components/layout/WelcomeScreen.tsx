interface WelcomeScreenProps {
  onNewLane: () => void;
}

export function WelcomeScreen(props: WelcomeScreenProps) {
  return (
    <div class="flex-1 flex items-center justify-center">
      <div class="text-center max-w-md">
        <svg
          class="w-20 h-20 mx-auto mb-6 text-zed-accent-blue opacity-30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
        >
          <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z" />
        </svg>
        <h2 class="text-2xl font-bold text-zed-text-primary mb-3">Welcome to Codelane</h2>
        <p class="text-zed-text-secondary mb-6">
          AI Orchestrator for Local Development. Create a lane to get started with your project.
        </p>
        <button
          class="px-6 py-2.5 bg-zed-accent-blue hover:bg-zed-accent-blue-hover text-white rounded-md font-medium transition-colors"
          onClick={props.onNewLane}
        >
          Create Your First Lane
        </button>
      </div>
    </div>
  );
}
