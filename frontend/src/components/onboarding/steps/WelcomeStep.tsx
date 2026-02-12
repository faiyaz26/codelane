import { createSignal, onMount } from 'solid-js';

export function WelcomeStep() {
  const [mounted, setMounted] = createSignal(false);

  onMount(() => {
    // Trigger staggered animations
    setTimeout(() => setMounted(true), 50);
  });

  return (
    <div class="flex flex-col items-center">
      {/* Hero Section */}
      <div
        class="text-center mb-8 transition-all duration-700 ease-out"
        style={{
          opacity: mounted() ? 1 : 0,
          transform: mounted() ? 'translateY(0)' : 'translateY(-10px)'
        }}
      >
        <h1 class="text-4xl font-bold text-zed-text-primary mb-3 tracking-tight">
          Welcome to Codelane
        </h1>
        <p class="text-lg text-zed-text-secondary font-light">
          Your Agentic Development Environment
        </p>
      </div>

      {/* Description */}
      <p
        class="text-zed-text-secondary mb-8 text-center max-w-xl leading-relaxed transition-all duration-700 ease-out delay-100"
        style={{
          opacity: mounted() ? 1 : 0,
          transform: mounted() ? 'translateY(0)' : 'translateY(-10px)'
        }}
      >
        Codelane empowers you to work on multiple features in parallel with AI assistance,
        streamlining your development workflow.
      </p>

      {/* Feature Cards Grid */}
      <div class="grid grid-cols-2 gap-4 w-full max-w-2xl mb-8">
        {/* Card 1: Parallel Development */}
        <FeatureCard
          delay={200}
          mounted={mounted()}
          icon={<ParallelIcon />}
          title="Parallel Development"
          description="Work on multiple features simultaneously across isolated lanes without context switching"
          accentColor="from-blue-500/20 to-cyan-500/20"
        />

        {/* Card 2: AI Agent Integration */}
        <FeatureCard
          delay={250}
          mounted={mounted()}
          icon={<AIIcon />}
          title="AI Agent Integration"
          description="Seamlessly collaborate with Claude, Cursor, Aider, and other AI coding assistants"
          accentColor="from-purple-500/20 to-pink-500/20"
        />

        {/* Card 3: Git Worktree Management */}
        <FeatureCard
          delay={300}
          mounted={mounted()}
          icon={<GitIcon />}
          title="Git Worktree Management"
          description="Each lane maintains its own terminal, file tree, and isolated git worktree"
          accentColor="from-green-500/20 to-emerald-500/20"
        />

        {/* Card 4: Real-time Status Tracking */}
        <FeatureCard
          delay={350}
          mounted={mounted()}
          icon={<StatusIcon />}
          title="Real-time Status Tracking"
          description="Receive instant notifications when your agent needs input or completes tasks"
          accentColor="from-orange-500/20 to-amber-500/20"
        />
      </div>

      {/* Expandable Info Section */}
      <details
        class="group w-full max-w-2xl rounded-xl border border-zed-border-default bg-gradient-to-br from-zed-bg-hover to-zed-bg-surface overflow-hidden transition-all duration-700 ease-out delay-400"
        style={{
          opacity: mounted() ? 1 : 0,
          transform: mounted() ? 'translateY(0)' : 'translateY(10px)'
        }}
      >
        <summary class="cursor-pointer px-5 py-4 flex items-center gap-3 hover:bg-zed-bg-active transition-colors">
          <div class="flex items-center justify-center w-6 h-6 rounded-full bg-zed-accent-blue/10 text-zed-accent-blue">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span class="text-sm font-medium text-zed-text-primary">
            What are lanes?
          </span>
          <svg
            class="w-4 h-4 ml-auto text-zed-text-tertiary transition-transform duration-200 group-open:rotate-180"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div class="px-5 pb-4 pt-1">
          <p class="text-sm text-zed-text-secondary leading-relaxed">
            Lanes are isolated development environments that enable you to work on
            multiple features simultaneously without switching branches. Each lane
            maintains its own terminal session, file tree view, and git worktree,
            providing complete separation between different workstreams.
          </p>
        </div>
      </details>
    </div>
  );
}

// Feature Card Component
interface FeatureCardProps {
  delay: number;
  mounted: boolean;
  icon: any;
  title: string;
  description: string;
  accentColor: string;
}

function FeatureCard(props: FeatureCardProps) {
  return (
    <div
      class="group relative rounded-xl border border-zed-border-default bg-zed-bg-surface p-5 transition-all duration-500 hover:border-zed-accent-blue/50 hover:shadow-lg hover:shadow-zed-accent-blue/5 hover:-translate-y-0.5"
      style={{
        opacity: props.mounted ? 1 : 0,
        transform: props.mounted ? 'translateY(0)' : 'translateY(20px)',
        'transition-delay': `${props.delay}ms`
      }}
    >
      {/* Gradient accent overlay */}
      <div
        class={`absolute inset-0 rounded-xl bg-gradient-to-br ${props.accentColor} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
      />

      {/* Content */}
      <div class="relative z-10">
        {/* Icon */}
        <div class="w-12 h-12 mb-4 flex items-center justify-center rounded-lg bg-zed-bg-hover border border-zed-border-default group-hover:border-zed-accent-blue/30 transition-all duration-300 group-hover:scale-110">
          <div class="text-zed-accent-blue transition-transform duration-300 group-hover:scale-110">
            {props.icon}
          </div>
        </div>

        {/* Title */}
        <h3 class="text-base font-semibold text-zed-text-primary mb-2 tracking-tight">
          {props.title}
        </h3>

        {/* Description */}
        <p class="text-sm text-zed-text-secondary leading-relaxed">
          {props.description}
        </p>
      </div>

      {/* Subtle corner accent */}
      <div class="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-zed-accent-blue/5 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </div>
  );
}

// Lucide-style Icons
function ParallelIcon() {
  // Split icon - represents parallel lanes/columns
  return (
    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 3h5v5" />
      <path d="M8 3H3v5" />
      <path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" />
      <path d="m15 9 6-6" />
    </svg>
  );
}

function AIIcon() {
  // Sparkles icon - represents AI/magic
  return (
    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}

function GitIcon() {
  // GitBranch icon - represents git worktrees/branching
  return (
    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="6" x2="6" y1="3" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}

function StatusIcon() {
  // Radio icon - represents real-time status/broadcasting
  return (
    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="2" />
      <path d="M4.93 19.07a10 10 0 0 1 0-14.14" />
      <path d="M7.76 16.24a6 6 0 0 1 0-8.49" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}
