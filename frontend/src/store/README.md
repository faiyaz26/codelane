# Codelane State Management

Centralized state management using SolidJS stores.

## Architecture

```
StoreProvider (App root)
  ├── store (reactive state)
  ├── actions (state mutations)
  └── selectors (computed values)
```

## Usage

### 1. Wrap App with StoreProvider

```tsx
import { StoreProvider } from './store';

function Root() {
  return (
    <StoreProvider>
      <App />
    </StoreProvider>
  );
}
```

### 2. Use Store in Components

```tsx
import { useStore } from '../store';

function MyComponent() {
  const { store, actions, selectors } = useStore();

  // Read state
  const lanes = store.lanes;
  const activeLane = selectors.getActiveLane();

  // Update state
  const createLane = () => {
    actions.addLane({
      id: crypto.randomUUID(),
      name: 'New Lane',
      workingDir: '/path',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  return <div>...</div>;
}
```

## State Structure

### Lanes
- `lanes: Lane[]` - All project lanes
- `activeLaneId: string | null` - Currently active lane

### Terminals
- `terminals: Terminal[]` - All terminal instances
- `activeTerminalId: string | null` - Currently focused terminal

### Git
- `gitStatus: Map<string, GitStatus>` - Git status per lane

### UI
- `ui.sidebarOpen: boolean` - Sidebar visibility
- `ui.activeView: string` - Current main view
- `ui.dialogOpen: string | null` - Open dialog name

## Actions

### Lane Actions
- `addLane(lane)` - Add new lane
- `removeLane(laneId)` - Delete lane and cleanup
- `updateLane(laneId, updates)` - Update lane fields
- `setActiveLane(laneId)` - Switch active lane

### Terminal Actions
- `addTerminal(terminal)` - Add terminal instance
- `removeTerminal(terminalId)` - Remove terminal
- `setActiveTerminal(terminalId)` - Focus terminal

### Git Actions
- `updateGitStatus(laneId, status)` - Update git status for lane

### UI Actions
- `toggleSidebar()` - Toggle sidebar
- `setActiveView(view)` - Change main view
- `openDialog(name)` - Open named dialog
- `closeDialog()` - Close current dialog

## Selectors

- `getActiveLane()` - Get active lane object
- `getLaneById(id)` - Get lane by ID
- `getTerminalsForLane(laneId)` - Get all terminals for a lane
- `getGitStatusForLane(laneId)` - Get git status for lane
- `isDialogOpen(name)` - Check if dialog is open

## Best Practices

1. **Always use actions to mutate state**
   ```tsx
   // ✅ Good
   actions.addLane(newLane);

   // ❌ Bad
   store.lanes.push(newLane);
   ```

2. **Use selectors for derived data**
   ```tsx
   // ✅ Good
   const activeLane = selectors.getActiveLane();

   // ❌ Bad
   const activeLane = store.lanes.find(l => l.id === store.activeLaneId);
   ```

3. **Batch related updates**
   ```tsx
   // Multiple actions in sequence are fine
   actions.addLane(lane);
   actions.setActiveLane(lane.id);
   actions.addTerminal(terminal);
   ```

4. **Don't store derived data**
   - Use selectors instead of duplicating data in store

5. **Keep UI state separate**
   - Dialog state, sidebar state, etc. go in `ui` section
   - Don't mix with domain data (lanes, terminals)

## Persistence

- Active lane ID is persisted to `localStorage`
- Lanes will be persisted via Tauri backend
- UI state is ephemeral (resets on reload)

## Type Safety

All types are exported from `store/index.ts`:
- `Lane`
- `Terminal`
- `GitStatus`
- `AppStore`
