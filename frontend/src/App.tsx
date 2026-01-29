import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <div class="h-screen w-screen flex flex-col bg-zed-bg-app text-zed-text-primary">
        {/* Title Bar */}
        <div class="h-12 bg-zed-bg-panel border-b border-zed-border-subtle flex items-center px-4">
          <h1 class="text-lg font-semibold">Codelane</h1>
          <div class="ml-auto flex items-center gap-2">
            <span class="text-xs text-zed-text-tertiary">Zed-inspired theme</span>
          </div>
        </div>

        {/* Main Content */}
        <div class="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div class="w-64 bg-zed-bg-panel border-r border-zed-border-default flex flex-col">
            <div class="p-4 border-b border-zed-border-subtle">
              <h2 class="text-sm font-semibold text-zed-text-secondary uppercase tracking-wide">
                Lanes
              </h2>
            </div>
            <div class="flex-1 p-2">
              <div class="p-3 bg-zed-bg-active rounded-md border border-zed-border-active">
                <div class="text-sm font-medium">Example Lane</div>
                <div class="text-xs text-zed-text-tertiary mt-1">~/projects/example</div>
              </div>
            </div>
            <div class="p-4 border-t border-zed-border-subtle">
              <button class="btn-primary w-full">
                + New Lane
              </button>
            </div>
          </div>

          {/* Main Panel */}
          <div class="flex-1 flex flex-col">
            {/* Content Area */}
            <div class="flex-1 p-6 overflow-auto">
              <div class="max-w-4xl mx-auto space-y-6">
                <div class="panel p-6">
                  <h2 class="text-2xl font-bold mb-4">Welcome to Codelane</h2>
                  <p class="text-zed-text-secondary mb-4">
                    AI Orchestrator for Local Development - Manage multiple AI coding agents across projects
                  </p>
                  <div class="flex gap-2">
                    <button class="btn-primary">Get Started</button>
                    <button class="btn-secondary">Learn More</button>
                  </div>
                </div>

                {/* Theme Demo */}
                <div class="panel p-6">
                  <h3 class="text-lg font-semibold mb-4">Theme Colors</h3>
                  <div class="grid grid-cols-4 gap-4">
                    <div>
                      <div class="h-20 bg-zed-accent-blue rounded-md mb-2"></div>
                      <div class="text-xs text-zed-text-tertiary">Blue</div>
                    </div>
                    <div>
                      <div class="h-20 bg-zed-accent-green rounded-md mb-2"></div>
                      <div class="text-xs text-zed-text-tertiary">Green</div>
                    </div>
                    <div>
                      <div class="h-20 bg-zed-accent-yellow rounded-md mb-2"></div>
                      <div class="text-xs text-zed-text-tertiary">Yellow</div>
                    </div>
                    <div>
                      <div class="h-20 bg-zed-accent-red rounded-md mb-2"></div>
                      <div class="text-xs text-zed-text-tertiary">Red</div>
                    </div>
                  </div>
                </div>

                {/* Components Demo */}
                <div class="panel p-6">
                  <h3 class="text-lg font-semibold mb-4">Components</h3>
                  <div class="space-y-4">
                    <div>
                      <label class="block text-sm font-medium mb-2">Input Field</label>
                      <input
                        type="text"
                        placeholder="Enter something..."
                        class="input w-full"
                      />
                    </div>
                    <div class="flex gap-2">
                      <button class="btn-primary">Primary Button</button>
                      <button class="btn-secondary">Secondary Button</button>
                      <button class="btn-danger">Danger Button</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Bar */}
            <div class="h-8 bg-zed-bg-panel border-t border-zed-border-subtle flex items-center px-4">
              <div class="flex items-center gap-4 text-xs text-zed-text-tertiary">
                <span>Ready</span>
                <span>•</span>
                <span>No lanes</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
