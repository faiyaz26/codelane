# Kobalte UI Components

Codelane uses [Kobalte](https://kobalte.dev/) - an unstyled, accessible UI component library for SolidJS.

## Why Kobalte?

- **Unstyled Primitives** - Full control over styling with our Zed theme
- **Accessibility Built-in** - WAI-ARIA compliant components
- **SolidJS Native** - Built for SolidJS's fine-grained reactivity
- **Comprehensive** - 30+ components (Dialog, Select, Popover, etc.)
- **Keyboard Navigation** - Full keyboard support out of the box
- **TypeScript** - Complete type safety

## Available Components

We've created pre-styled wrappers in `src/components/ui/`:

### Button
```tsx
import { Button } from './components/ui';

<Button variant="primary" size="md" onClick={handleClick}>
  Click Me
</Button>
```

Variants: `primary`, `secondary`, `danger`, `ghost`
Sizes: `sm`, `md`, `lg`

### TextField
```tsx
import { TextField } from './components/ui';

<TextField
  label="Project Name"
  placeholder="Enter name..."
  description="Optional description"
  errorMessage="Error if validation fails"
  value={value()}
  onChange={setValue}
/>
```

### Dialog (Modal)
```tsx
import { Dialog, DialogTrigger } from './components/ui';
import { createSignal } from 'solid-js';

const [open, setOpen] = createSignal(false);

<Dialog
  open={open()}
  onOpenChange={setOpen}
  title="Dialog Title"
  description="Optional description"
>
  <p>Dialog content</p>
  <Button onClick={() => setOpen(false)}>Close</Button>
</Dialog>
```

## Adding More Components

Kobalte provides many more components that we can wrap:

### Common Components to Add

1. **Select** - Dropdown selection
2. **Tabs** - Tab navigation
3. **Popover** - Floating content
4. **Tooltip** - Hover information
5. **DropdownMenu** - Context menus
6. **Switch** - Toggle switches
7. **Checkbox** - Checkbox inputs
8. **RadioGroup** - Radio button groups
9. **Combobox** - Autocomplete select
10. **Progress** - Progress bars

### Example: Creating a New Component

```tsx
// src/components/ui/Select.tsx
import { Select as KobalteSelect } from '@kobalte/core/select';

export function Select(props) {
  return (
    <KobalteSelect.Root {...props}>
      <KobalteSelect.Trigger class="inline-flex items-center justify-between w-full px-3 py-2 bg-zed-bg-surface border border-zed-border-default rounded-md text-zed-text-primary">
        <KobalteSelect.Value />
        <KobalteSelect.Icon>
          <svg>...</svg>
        </KobalteSelect.Icon>
      </KobalteSelect.Trigger>
      <KobalteSelect.Portal>
        <KobalteSelect.Content class="bg-zed-bg-overlay border border-zed-border-default rounded-lg shadow-lg">
          <KobalteSelect.Listbox class="p-1">
            {/* Options rendered here */}
          </KobalteSelect.Listbox>
        </KobalteSelect.Content>
      </KobalteSelect.Portal>
    </KobalteSelect.Root>
  );
}
```

## Styling Guidelines

All Kobalte components should follow our Zed theme:

- **Backgrounds**: Use `bg-zed-bg-*` classes
- **Borders**: Use `border-zed-border-*` classes
- **Text**: Use `text-zed-text-*` classes
- **Accents**: Use `bg-zed-accent-*` for actions
- **Focus**: Always include focus ring styles
- **Transitions**: Add `transition-colors` for smooth interactions

## Accessibility Features

Kobalte handles these automatically:

- **Focus Management** - Proper tab order and focus trapping
- **Keyboard Navigation** - Arrow keys, Enter, Escape, etc.
- **Screen Readers** - ARIA labels, descriptions, live regions
- **Touch Support** - Mobile-friendly interactions

## Resources

- [Kobalte Documentation](https://kobalte.dev/)
- [Kobalte GitHub](https://github.com/kobaltedev/kobalte)
- [Component Examples](https://kobalte.dev/docs/core/components/accordion)

## Migration from Basic HTML

Replace basic HTML elements with Kobalte for better UX:

| HTML Element | Kobalte Component | Benefits |
|--------------|-------------------|----------|
| `<button>` | `<Button>` | Focus management, disabled state |
| `<input>` | `<TextField>` | Labels, validation, descriptions |
| `<select>` | `<Select>` | Custom styling, keyboard nav |
| `<dialog>` | `<Dialog>` | Focus trap, backdrop, animations |
| `<details>` | `<Accordion>` | Smooth animations, accessibility |

## Best Practices

1. **Always use Kobalte for interactive elements** - Better accessibility
2. **Wrap Kobalte components** - Create styled wrappers in `src/components/ui/`
3. **Keep styling consistent** - Use our Zed theme tokens
4. **Test keyboard navigation** - Tab through all interactive elements
5. **Provide labels** - Always include labels for form fields
