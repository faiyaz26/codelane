import { createContext, useContext, ParentComponent, createSignal } from 'solid-js';

export type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: () => Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>();

export const ThemeProvider: ParentComponent = (props) => {
  // Default to dark theme (Zed-inspired)
  const [theme, setTheme] = createSignal<Theme>('dark');

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Apply theme class to document root
  const applyTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(newTheme);
    localStorage.setItem('codelane-theme', newTheme);
  };

  // Load theme from localStorage on mount
  const savedTheme = localStorage.getItem('codelane-theme') as Theme | null;
  if (savedTheme && (savedTheme === 'dark' || savedTheme === 'light')) {
    applyTheme(savedTheme);
  } else {
    applyTheme('dark');
  }

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
};

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
