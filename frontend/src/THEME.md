# Codelane Theme System

Zed-inspired dark theme with professional aesthetics for developer tools.

## Usage

### ThemeProvider

Wrap your app with the `ThemeProvider`:

```tsx
import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      {/* Your app */}
    </ThemeProvider>
  );
}
```

### Using Theme Hook

```tsx
import { useTheme } from './contexts/ThemeContext';

function MyComponent() {
  const { theme, setTheme, toggleTheme } = useTheme();

  return (
    <button onClick={toggleTheme}>
      Current theme: {theme()}
    </button>
  );
}
```

## Tailwind Classes

### Backgrounds
- `bg-zed-bg-app` - Main app background (#0a0a0a)
- `bg-zed-bg-panel` - Sidebar/panels (#111111)
- `bg-zed-bg-surface` - Cards/surfaces (#1a1a1a)
- `bg-zed-bg-hover` - Hover states (#1f1f1f)
- `bg-zed-bg-active` - Active/selected (#252525)

### Borders
- `border-zed-border-subtle` - Barely visible
- `border-zed-border-default` - Standard borders
- `border-zed-border-focus` - Focused elements
- `border-zed-border-active` - Active accent borders

### Text
- `text-zed-text-primary` - Main text (#e6e6e6)
- `text-zed-text-secondary` - Secondary text (#9e9e9e)
- `text-zed-text-tertiary` - Muted text (#6e6e6e)
- `text-zed-text-disabled` - Disabled text (#4e4e4e)

### Accents
- `bg-zed-accent-blue` / `text-zed-accent-blue` - Primary action
- `bg-zed-accent-green` / `text-zed-accent-green` - Success
- `bg-zed-accent-yellow` / `text-zed-accent-yellow` - Warning
- `bg-zed-accent-red` / `text-zed-accent-red` - Error

### Semantic
- `bg-zed-semantic-success` - Success states
- `bg-zed-semantic-warning` - Warning states
- `bg-zed-semantic-error` - Error states
- `bg-zed-semantic-info` - Info states

## Component Classes

Pre-built component utilities in `index.css`:

### Panels
```tsx
<div class="panel">
  {/* Panel content */}
</div>
```

### Buttons
```tsx
<button class="btn-primary">Primary Action</button>
<button class="btn-secondary">Secondary Action</button>
<button class="btn-danger">Delete</button>
```

### Inputs
```tsx
<input class="input" placeholder="Enter text..." />
```

## CSS Variables

Theme colors are also available as CSS variables:

```css
.my-component {
  background: var(--zed-bg-surface);
  color: var(--zed-text-primary);
  border: 1px solid var(--zed-border-default);
}
```

## Theme Constants

Import theme constants for programmatic use:

```tsx
import { ZED_THEME, SPACING, RADIUS, FONT_SIZE } from './theme';

const MyComponent = () => (
  <div style={{
    background: ZED_THEME.bg.surface,
    padding: SPACING.lg,
    'border-radius': RADIUS.md,
  }}>
    Content
  </div>
);
```

## Color Palette

### Backgrounds (Darkest to Lightest)
- App: `#0a0a0a`
- Panel: `#111111`
- Surface: `#1a1a1a`
- Hover: `#1f1f1f`
- Active: `#252525`
- Overlay: `#2a2a2a`

### Accent Colors
- Blue: `#0b93f6` (Primary action)
- Green: `#26d97f` (Success)
- Yellow: `#f5c249` (Warning)
- Red: `#f23c3c` (Error)
- Purple: `#b88ef2` (Highlight)
- Orange: `#ff8c42` (Alert)

### Text
- Primary: `#e6e6e6`
- Secondary: `#9e9e9e`
- Tertiary: `#6e6e6e`
- Disabled: `#4e4e4e`

## Terminal Colors

ANSI color support for terminal emulator:

```tsx
import { ZED_THEME } from './theme';

const terminalTheme = {
  foreground: ZED_THEME.terminal.white,
  background: ZED_THEME.bg.app,
  black: ZED_THEME.terminal.black,
  red: ZED_THEME.terminal.red,
  // ... etc
};
```

## Best Practices

1. **Use semantic colors**: Prefer `bg-zed-accent-blue` over hardcoded colors
2. **Consistent spacing**: Use Tailwind spacing utilities (p-4, gap-2, etc.)
3. **Focus states**: Always provide visible focus indicators for accessibility
4. **Hover states**: Add hover states to interactive elements
5. **Transitions**: Use `transition-colors` for smooth color changes

## Extending the Theme

To add custom colors, update `tailwind.config.js`:

```js
extend: {
  colors: {
    zed: {
      custom: {
        primary: '#your-color',
      },
    },
  },
}
```
