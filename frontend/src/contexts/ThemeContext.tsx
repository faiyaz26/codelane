import { createContext, useContext, createSignal, onMount } from 'solid-js';

export type Theme = 'dark' | 'codelane-dark' | 'light';

interface ThemeContextType {
  theme: () => Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>();

interface ThemeProviderProps {
  children?: any;
}

export function ThemeProvider(props: ThemeProviderProps) {
  // Default to codelane-dark theme
  const [theme, setTheme] = createSignal<Theme>('codelane-dark');

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'codelane-dark' : prev === 'codelane-dark' ? 'light' : 'dark'));
  };

  // Apply theme class to document root
  const applyTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    document.documentElement.classList.remove('dark', 'codelane-dark', 'light');
    document.documentElement.classList.add(newTheme);
    localStorage.setItem('codelane-theme', newTheme);
  };

  // Load theme from localStorage on mount
  onMount(() => {
    const savedTheme = localStorage.getItem('codelane-theme') as string | null;
    if (savedTheme && (savedTheme === 'dark' || savedTheme === 'codelane-dark' || savedTheme === 'light')) {
      applyTheme(savedTheme as Theme);
    } else {
      applyTheme('codelane-dark');
    }
  });

  const value: ThemeContextType = {
    theme,
    setTheme: applyTheme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {props.children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
