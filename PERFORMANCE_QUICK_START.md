# Performance Benchmarking Quick Start

## 🚀 Quick Commands

### Run All Benchmarks
```bash
make bench              # Comprehensive benchmarks (~5 min)
make bench-quick        # Quick benchmarks (~1 min)
```

### Specific Benchmarks
```bash
make bench-terminal     # PTY spawn, write, resize
make bench-git          # Status, diff, log operations
make bench-ipc          # Tauri IPC overhead
make bench-file         # File tree traversal
```

### Bundle Analysis
```bash
make profile            # Analyze bundle size
```

### Full Performance Report
```bash
make perf-report        # Generate comprehensive report
```

## 📊 View Results

### Criterion Reports (Backend)
Open in browser:
```
target/criterion/report/index.html
```

Interactive graphs show:
- Mean execution time with confidence intervals
- Performance delta vs previous run
- Throughput metrics (ops/sec or bytes/sec)
- Regression detection (red = slower)

### Bundle Visualizer (Frontend)
```bash
cd frontend
pnpm build
npx vite-bundle-visualizer
```

## 🔍 Live Performance Monitoring (Dev Mode)

Add to [App.tsx](frontend/src/App.tsx):

```typescript
import { PerformanceMonitor } from './components/dev/PerformanceMonitor';

// In your App component
<Show when={import.meta.env.DEV}>
  <PerformanceMonitor />
</Show>
```

**Usage:**
- Press `Ctrl+Shift+P` to toggle overlay
- Shows: FPS, memory usage, operation timings
- Click "Print Report" for detailed console output

## 🐌 Finding Slow Operations

### In Browser Console
```javascript
// Access performance tracker
window.codelanePerf.report()

// Get specific metrics
window.codelanePerf.tracker.getMetrics({ type: 'render' })
window.codelanePerf.tracker.getStats()

// Memory usage
window.codelanePerf.getMemoryUsage()
```

### In Code (Measure Operations)
```typescript
import { measureRender, measureAsync } from './utils/performance';

// Measure sync operation
const result = measureRender('expensive-calc', () => {
  // Your code here
});

// Measure async operation
const data = await measureAsync('api-call', async () => {
  return await fetch('/api/data');
});
```

## 🎯 Performance Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Bundle Size | <500KB | `make profile` |
| Time to Interactive | <1s | Chrome Lighthouse |
| Terminal Spawn | <50ms | `make bench-terminal` |
| Git Status | <100ms | `make bench-git` |
| FPS (Smooth UI) | >55 | Performance overlay |
| Memory (Idle) | <100MB | Chrome DevTools Memory |

## 🔧 CI Integration

Add to your PR workflow:

```yaml
- name: Run backend benchmarks
  run: make bench-quick

- name: Check bundle size
  run: |
    make profile
    SIZE=$(du -sk frontend/dist | cut -f1)
    if [ $SIZE -gt 1024 ]; then
      echo "❌ Bundle size $SIZE KB exceeds 1MB"
      exit 1
    fi
    echo "✅ Bundle size: $SIZE KB"
```

## 📈 Interpreting Results

### Criterion Output

```
terminal_spawn/spawn_bash
                        time:   [42.123 ms 42.456 ms 42.789 ms]
                        change: [-2.34% -1.12% +0.34%] (p = 0.15 > 0.05)
                        No change in performance detected.
```

- **time:** Mean ± confidence interval
- **change:** Performance delta (🔴 red = regression, 🟢 green = improvement)
- **p-value:** Statistical significance (p < 0.05 = significant)

### What to Look For

✅ **Good:**
- Consistent timings across runs
- Low variance (tight confidence intervals)
- Scaling linearly with input size

⚠️ **Investigate:**
- >10% performance regressions
- Exponential scaling (should be linear)
- High variance (inconsistent timings)
- Long operations (>100ms for common actions)

## 🐛 Common Issues

### "Benchmark fails to compile"
```bash
cargo clean
cargo bench --package codelane-benchmarks
```

### "Bundle visualizer shows nothing"
```bash
cd frontend
rm -rf dist/
pnpm build
npx vite-bundle-visualizer
```

### "Performance overlay not showing"
- Make sure you're in dev mode (`pnpm dev`)
- Check browser console for errors
- Press `Ctrl+Shift+P` (not Cmd on Mac)

## 📚 Learn More

- **Full Analysis:** [PERFORMANCE_ANALYSIS.md](PERFORMANCE_ANALYSIS.md)
- **Benchmark Details:** [crates/codelane-benchmarks/README.md](crates/codelane-benchmarks/README.md)
- **Criterion Docs:** https://bheisler.github.io/criterion.rs/book/

---

**TIP:** Run `make bench` weekly to catch performance regressions early!
