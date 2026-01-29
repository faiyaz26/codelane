import { ThemeProvider } from './contexts/ThemeContext';
import { Button } from './components/ui';

function App() {
  return (
    <ThemeProvider>
      <div class="h-screen w-screen bg-zed-bg-app text-zed-text-primary flex items-center justify-center">
        <div class="text-center space-y-4">
          <h1 class="text-3xl font-bold mb-4">Codelane</h1>
          <p class="text-zed-text-secondary">Testing Button component...</p>
          <div class="flex gap-2 justify-center">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
