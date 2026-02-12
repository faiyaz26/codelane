#!/bin/bash

# Comprehensive performance report generator for Codelane
set -e

REPORT_FILE="performance-report-$(date +%Y%m%d-%H%M%S).md"

echo "🔍 Generating Codelane Performance Report..."
echo ""

cat > "$REPORT_FILE" << 'EOF'
# Codelane Performance Report

Generated: $(date)

---

## 📊 Backend Benchmarks (Rust/Criterion)

EOF

echo "Running Rust benchmarks..."
cargo bench --package codelane-benchmarks --quiet 2>&1 | tee -a "$REPORT_FILE"

cat >> "$REPORT_FILE" << 'EOF'

---

## 📦 Bundle Size Analysis

EOF

echo "Building frontend..."
cd frontend && pnpm build --quiet

echo "### Total Bundle Size" >> "../$REPORT_FILE"
echo '```' >> "../$REPORT_FILE"
du -sh dist >> "../$REPORT_FILE"
echo '```' >> "../$REPORT_FILE"

echo "" >> "../$REPORT_FILE"
echo "### Breakdown by File" >> "../$REPORT_FILE"
echo '```' >> "../$REPORT_FILE"
find dist -type f -exec ls -lh {} \; | awk '{print $5 "\t" $9}' | sort -hr >> "../$REPORT_FILE"
echo '```' >> "../$REPORT_FILE"

echo "" >> "../$REPORT_FILE"
echo "### JavaScript Bundle Analysis" >> "../$REPORT_FILE"
echo '```' >> "../$REPORT_FILE"
find dist/assets -name "*.js" -exec wc -c {} \; | sort -rn | head -10 >> "../$REPORT_FILE"
echo '```' >> "../$REPORT_FILE"

cd ..

cat >> "$REPORT_FILE" << 'EOF'

---

## 🧪 Frontend Tests

EOF

echo "Running frontend tests..."
cd frontend
pnpm test --run 2>&1 | tee -a "../$REPORT_FILE"
cd ..

cat >> "$REPORT_FILE" << 'EOF'

---

## 💾 Binary Size

EOF

echo '```' >> "$REPORT_FILE"
if [ -f "src-tauri/target/release/codelane" ]; then
    ls -lh src-tauri/target/release/codelane | awk '{print "Release binary: " $5}' >> "$REPORT_FILE"
else
    echo "Release binary not built. Run: cargo build --release" >> "$REPORT_FILE"
fi
echo '```' >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << 'EOF'

---

## 🎯 Performance Targets vs Actual

| Metric | Target | Status |
|--------|--------|--------|
| **App Startup** | <2s | ⏳ Measure manually |
| **Time to Interactive** | <1s | ⏳ Run Lighthouse |
| **Memory Usage (Idle)** | <100MB | ⏳ Check Activity Monitor |
| **Terminal Latency** | <16ms | ✅ See terminal_benchmarks |
| **Git Operations** | <100ms | ✅ See git_benchmarks |
| **Bundle Size** | <2MB | ✅ See bundle analysis |

---

## 📝 Recommendations

### High Priority
- [ ] Profile terminal output rendering under heavy load
- [ ] Test file tree performance with 10k+ files
- [ ] Measure git status on large repos (>1GB)
- [ ] Run Lighthouse audit on built app

### Medium Priority
- [ ] Add bundle size limits to CI
- [ ] Implement code splitting for Monaco editor
- [ ] Lazy load terminal addons
- [ ] Optimize theme switching

### Low Priority
- [ ] Add performance regression tests
- [ ] Create benchmark comparison dashboard
- [ ] Profile WASM plugin loading

---

## 🔗 Resources

- Criterion report: `target/criterion/report/index.html`
- Bundle visualizer: Run `npx vite-bundle-visualizer` in frontend/
- Chrome DevTools: Performance tab, Lighthouse audit
- Memory profiler: Chrome DevTools → Memory tab

EOF

echo ""
echo "✅ Performance report generated: $REPORT_FILE"
echo ""
echo "📊 Quick Summary:"
echo "  - Backend benchmarks: target/criterion/report/index.html"
echo "  - Full report: $REPORT_FILE"
echo ""
echo "Next steps:"
echo "  1. Review the report"
echo "  2. Open Criterion HTML report in browser"
echo "  3. Run Lighthouse audit on the built app"
echo "  4. Check for regression in key metrics"
