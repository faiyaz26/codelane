import { createSignal } from 'solid-js';
import { ThemeProvider } from './contexts/ThemeContext';
import { Button, Dialog, TextField } from './components/ui';

function App() {
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [laneName, setLaneName] = createSignal('');

  return (
    <ThemeProvider>
      <div class="h-screen w-screen flex flex-col bg-zed-bg-app text-zed-text-primary">
        {/* Title Bar */}
        <div class="h-12 bg-zed-bg-panel border-b border-zed-border-subtle flex items-center px-4">
          <h1 class="text-lg font-semibold">Codelane</h1>
          <div class="ml-auto flex items-center gap-2">
            <span class="text-xs text-zed-text-tertiary">Powered by Kobalte UI</span>
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
              <Button variant="primary" class="w-full" onClick={() => setDialogOpen(true)}>
                + New Lane
              </Button>
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
                    <Button variant="primary">Get Started</Button>
                    <Button variant="secondary">Learn More</Button>
                  </div>
                </div>

                {/* Kobalte Components Demo */}
                <div class="panel p-6">
                  <h3 class="text-lg font-semibold mb-4">Kobalte UI Components</h3>
                  <div class="space-y-6">
                    {/* Buttons */}
                    <div>
                      <h4 class="text-sm font-medium text-zed-text-secondary mb-3">Buttons</h4>
                      <div class="flex flex-wrap gap-2">
                        <Button variant="primary" size="sm">Small Primary</Button>
                        <Button variant="primary" size="md">Medium Primary</Button>
                        <Button variant="primary" size="lg">Large Primary</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="danger">Danger</Button>
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="primary" disabled>Disabled</Button>
                      </div>
                    </div>

                    {/* Text Fields */}
                    <div>
                      <h4 class="text-sm font-medium text-zed-text-secondary mb-3">Text Fields</h4>
                      <div class="space-y-3 max-w-md">
                        <TextField
                          label="Project Name"
                          placeholder="Enter project name..."
                          description="This will be displayed in the sidebar"
                        />
                        <TextField
                          label="Working Directory"
                          placeholder="/path/to/project"
                          description="Absolute path to your project"
                        />
                        <TextField
                          label="Invalid Field"
                          placeholder="This has an error"
                          errorMessage="This field is required"
                        />
                      </div>
                    </div>

                    {/* Dialog */}
                    <div>
                      <h4 class="text-sm font-medium text-zed-text-secondary mb-3">Dialog (Modal)</h4>
                      <Button variant="primary" onClick={() => setDialogOpen(true)}>
                        Open Dialog
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Theme Colors */}
                <div class="panel p-6">
                  <h3 class="text-lg font-semibold mb-4">Zed Theme Colors</h3>
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

        {/* New Lane Dialog */}
        <Dialog
          open={dialogOpen()}
          onOpenChange={setDialogOpen}
          title="Create New Lane"
          description="Set up a new project workspace with its own terminal and AI agents."
        >
          <div class="space-y-4">
            <TextField
              label="Lane Name"
              placeholder="My Project"
              value={laneName()}
              onChange={setLaneName}
            />
            <TextField
              label="Working Directory"
              placeholder="/path/to/project"
            />
            <div class="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => {
                // TODO: Create lane
                setDialogOpen(false);
              }}>
                Create Lane
              </Button>
            </div>
          </div>
        </Dialog>
      </div>
    </ThemeProvider>
  );
}

export default App;
