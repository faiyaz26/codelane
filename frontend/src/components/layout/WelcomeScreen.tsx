import codelaneLogoWhite from '../../assets/codelane-logo-white.png';

interface WelcomeScreenProps {
  onNewLane: () => void;
}

export function WelcomeScreen(props: WelcomeScreenProps) {
  return (
    <div class="flex-1 flex items-center justify-center">
      <div class="text-center max-w-md">
        <img src={codelaneLogoWhite} alt="Codelane" class="w-20 mx-auto mb-6 opacity-30" />
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
