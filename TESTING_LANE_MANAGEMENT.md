# Testing Guide: Lane Management Feature

This guide provides step-by-step instructions for testing the Lane Management feature implementation.

## Prerequisites

Ensure you have the following installed:
- Rust (latest stable)
- Node.js (v18+)
- npm or yarn

## Setup

1. **Install dependencies:**
   ```bash
   cd /Users/faiyaz-metomic/Documents/personal-projects/codelane

   # Install Rust dependencies
   cargo build --manifest-path src-tauri/Cargo.toml

   # Install frontend dependencies
   cd frontend
   npm install
   ```

2. **Run the application:**
   ```bash
   # From the project root
   cd /Users/faiyaz-metomic/Documents/personal-projects/codelane
   npm run tauri dev
   ```

## Test Cases

### Test 1: Initial State (No Lanes)
**Expected behavior:**
- App should show "Welcome to Codelane" screen
- Sidebar should show "No lanes yet" message
- Status bar should show "No active lane" and "0 lanes"

**Steps:**
1. Launch the app fresh (delete `~/.codelane/lanes/` if it exists)
2. Verify welcome screen is displayed
3. Verify sidebar shows empty state

### Test 2: Create First Lane
**Expected behavior:**
- Dialog opens with form fields
- Can create lane with valid directory
- New lane appears in sidebar and becomes active
- Lane info is shown in main panel

**Steps:**
1. Click "+ New Lane" button
2. Verify dialog opens
3. Enter lane name: "Test Project"
4. Enter working directory: Your home directory (e.g., `/Users/yourusername/Documents`)
5. Click "Create Lane"
6. Verify dialog closes
7. Verify lane appears in sidebar with blue highlight
8. Verify main panel shows lane name and working directory
9. Verify status bar shows lane name and "1 lane"
10. Verify terminal is displayed

### Test 3: Validation - Invalid Directory
**Expected behavior:**
- Shows error message for non-existent directory
- Does not create lane
- Dialog remains open

**Steps:**
1. Click "+ New Lane"
2. Enter lane name: "Invalid Test"
3. Enter working directory: "/this/path/does/not/exist"
4. Click "Create Lane"
5. Verify error message appears
6. Verify dialog stays open
7. Click "Cancel" to close

### Test 4: Validation - Empty Fields
**Expected behavior:**
- Shows error message for missing required fields
- Does not create lane

**Steps:**
1. Click "+ New Lane"
2. Leave name field empty
3. Enter any valid directory
4. Click "Create Lane"
5. Verify error message: "Lane name is required"
6. Enter name but clear directory field
7. Click "Create Lane"
8. Verify error message: "Working directory is required"

### Test 5: Create Multiple Lanes
**Expected behavior:**
- Can create multiple lanes
- Lane list shows all lanes
- Most recently updated lane appears first

**Steps:**
1. Create 3 lanes with different names and directories:
   - Lane 1: "Frontend Project" → `/path/to/frontend`
   - Lane 2: "Backend Project" → `/path/to/backend`
   - Lane 3: "Documentation" → `/path/to/docs`
2. Verify all three lanes appear in sidebar
3. Verify "Documentation" is at the top (most recent)
4. Verify status bar shows "3 lanes"

### Test 6: Lane Selection
**Expected behavior:**
- Can click on any lane to select it
- Selected lane is highlighted with blue background
- Main panel updates to show selected lane info
- Terminal updates with new working directory

**Steps:**
1. With multiple lanes created, click on different lanes
2. Verify blue highlight moves to selected lane
3. Verify main panel updates with correct lane name and directory
4. Verify status bar shows correct active lane name
5. Verify terminal updates (shows working directory message)

### Test 7: Active Lane Persistence
**Expected behavior:**
- Active lane is saved to localStorage
- On app restart, active lane is restored
- Lane list is reloaded from disk

**Steps:**
1. Select a specific lane (not the first one)
2. Close the application (Cmd+Q or close window)
3. Reopen the application
4. Verify the same lane is active (highlighted)
5. Verify main panel shows the correct lane
6. Verify all lanes are still in the list

### Test 8: Lane Deletion
**Expected behavior:**
- Shows confirmation dialog
- Deletes lane from memory and disk
- Updates lane list
- Switches to another lane if deleted lane was active

**Steps:**
1. With multiple lanes, hover over a lane item
2. Click the delete (trash) icon
3. Verify browser confirmation dialog appears
4. Click "Cancel"
5. Verify lane is not deleted
6. Click delete icon again
7. Click "OK" to confirm
8. Verify lane is removed from sidebar
9. Verify status bar updates lane count
10. If deleted lane was active, verify another lane becomes active

### Test 9: Delete Active Lane
**Expected behavior:**
- Confirmation dialog appears
- On confirmation, lane is deleted
- Next available lane becomes active
- If no lanes remain, shows welcome screen

**Steps:**
1. Create 2 lanes
2. Select the first lane
3. Delete the first lane (active)
4. Verify second lane becomes active
5. Delete the second lane
6. Verify welcome screen is shown
7. Verify status bar shows "No active lane" and "0 lanes"

### Test 10: Persistence Verification
**Expected behavior:**
- Lanes are saved as JSON files in `~/.codelane/lanes/`
- Each file is named `{uuid}.json`
- Files contain correct lane data

**Steps:**
1. Create a lane named "Persistence Test"
2. Open Terminal or Finder
3. Navigate to `~/.codelane/lanes/`
4. Verify a `.json` file exists
5. Open the file and verify it contains:
   - `id`: UUID string
   - `name`: "Persistence Test"
   - `working_dir`: Your specified directory
   - `created_at`: Unix timestamp
   - `updated_at`: Unix timestamp

### Test 11: Lane Info Display
**Expected behavior:**
- Shows lane name, working directory, and timestamps
- Timestamps are formatted correctly
- Quick actions are available (future functionality)

**Steps:**
1. Create a lane
2. Select the lane
3. Verify main panel shows:
   - Lane name as heading
   - Working directory as subheading
   - Created timestamp (formatted)
   - Updated timestamp (formatted)
4. Note the timestamps for comparison

### Test 12: Terminal Integration
**Expected behavior:**
- Terminal is displayed when lane is active
- Terminal shows working directory
- Terminal can be interacted with (if backend terminal is working)

**Steps:**
1. Create a lane with a valid working directory
2. Select the lane
3. Verify terminal section is visible
4. Verify terminal shows working directory message
5. If terminal backend is connected, try typing commands

## File Verification

**Backend files to check:**
```bash
# Lane module
ls -la src-tauri/src/lane.rs

# Updated lib.rs with lane commands
grep "lane::" src-tauri/src/lib.rs

# Cargo.toml with chrono dependency
grep "chrono" src-tauri/Cargo.toml
```

**Frontend files to check:**
```bash
# TypeScript types
ls -la frontend/src/types/lane.ts

# API wrapper
ls -la frontend/src/lib/lane-api.ts

# Storage utilities
ls -la frontend/src/lib/storage.ts

# Components
ls -la frontend/src/components/LaneList.tsx
ls -la frontend/src/components/CreateLaneDialog.tsx

# Updated App.tsx
grep "import.*Lane" frontend/src/App.tsx
```

## Common Issues and Solutions

### Issue 1: "Failed to create lane: Working directory does not exist"
**Solution:** Ensure you're entering a valid, existing directory path. Use absolute paths.

### Issue 2: Lanes not persisting after restart
**Solution:**
- Check if `~/.codelane/lanes/` directory exists
- Verify write permissions
- Check browser console for errors

### Issue 3: Terminal not showing
**Solution:**
- Verify TerminalView component is properly imported
- Check browser console for terminal backend errors
- Ensure terminal backend commands are registered in lib.rs

### Issue 4: "Command lane_create not found"
**Solution:**
- Verify Rust code compiles: `cargo build --manifest-path src-tauri/Cargo.toml`
- Check that lane commands are registered in `lib.rs`
- Restart the Tauri dev server

### Issue 5: Lane list doesn't update after creation
**Solution:**
- Check browser console for JavaScript errors
- Verify `onLaneCreated` handler is called
- Check that lanes state is being updated

## Performance Checks

1. **Lane Loading Speed:**
   - Create 10+ lanes
   - Restart app
   - Measure time to load all lanes (should be < 1 second)

2. **Lane Switching Speed:**
   - Create 5+ lanes
   - Click through different lanes
   - Verify instant switching (< 100ms)

3. **Storage Size:**
   - Create 10 lanes
   - Check size of `~/.codelane/lanes/` directory
   - Each lane should be < 1KB

## Accessibility Checks

1. **Keyboard Navigation:**
   - Tab through lane list items
   - Press Enter to select
   - Tab to "+ New Lane" button
   - Tab through dialog form fields

2. **Screen Reader:**
   - Lane names should be announced
   - Button labels should be clear
   - Form validation errors should be announced

## Browser Console Checks

During testing, monitor the browser console for:
- ✅ "Terminal ready: {id}" when creating lanes
- ✅ "Terminal {id} closed" when switching lanes
- ❌ No error messages
- ❌ No warning messages about missing commands

## Success Criteria

The implementation is successful if:
- ✅ All test cases pass
- ✅ No console errors during normal operation
- ✅ Lanes persist across app restarts
- ✅ Active lane is restored on app restart
- ✅ Lane deletion works correctly
- ✅ Form validation prevents invalid lanes
- ✅ UI is responsive and provides feedback
- ✅ Terminal integration works with lanes
- ✅ Multiple lanes can be managed simultaneously

## Next Steps After Testing

If all tests pass:
1. Test on different operating systems (macOS, Linux, Windows)
2. Test with very long directory paths
3. Test with special characters in lane names
4. Test with 100+ lanes (stress test)
5. Add automated tests (unit + integration)
6. Add E2E tests with Playwright or similar

## Reporting Issues

If you find issues, report with:
1. Test case number
2. Expected behavior
3. Actual behavior
4. Browser console errors (if any)
5. Operating system
6. Steps to reproduce
