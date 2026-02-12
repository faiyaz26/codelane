# Codelane Performance Benchmarks

This crate contains comprehensive benchmarks for Codelane's backend performance using Criterion.rs.

## Running Benchmarks

### Run all benchmarks
```bash
cd crates/codelane-benchmarks
cargo bench
```

### Run specific benchmark suite
```bash
cargo bench --bench terminal_benchmarks
cargo bench --bench git_benchmarks
cargo bench --bench ipc_benchmarks
cargo bench --bench file_operations
```

### Run specific test within a suite
```bash
cargo bench --bench terminal_benchmarks -- spawn
cargo bench --bench git_benchmarks -- status
```

### Generate HTML reports
Results are automatically generated in `target/criterion/` with interactive HTML reports.

## Benchmark Suites

### 1. Terminal Benchmarks (`terminal_benchmarks.rs`)
- **spawn_bash**: Measures PTY spawn latency
- **write**: Tests throughput for different output sizes (100B to 100KB)
- **resize**: Measures terminal resize operation overhead

**Target metrics:**
- Spawn: <50ms
- Write throughput: >1MB/s
- Resize: <10ms

### 2. Git Benchmarks (`git_benchmarks.rs`)
- **status**: Git status operation latency
- **diff_unstaged**: Diff generation performance
- **log**: Commit history retrieval for different sizes

**Target metrics:**
- Status: <50ms (small repo)
- Diff: <100ms (typical file)
- Log (10 commits): <30ms

### 3. IPC Benchmarks (`ipc_benchmarks.rs`)
- **serialization**: JSON encode/decode overhead for Tauri commands
- **event_throughput**: Event batching performance

**Target metrics:**
- Small payload: <100μs
- Large payload (10KB): <1ms
- Event throughput: >10k events/sec

### 4. File Operations (`file_operations.rs`)
- **tree_traversal**: Directory walking at different scales
- **metadata**: File stat operation overhead
- **gitignore_filtering**: Ignore-aware traversal performance

**Target metrics:**
- 1K files: <50ms
- 10K files: <500ms
- Metadata: <1ms

## Interpreting Results

Criterion provides:
- **Time**: Mean execution time with confidence intervals
- **Throughput**: Operations per second or bytes per second
- **Change**: Performance delta vs. previous run (regression detection)

Look for:
- ⚠️ Red changes (regressions)
- ✅ Stable performance across runs
- 📊 Scaling behavior (linear vs. exponential)

## CI Integration

Add to GitHub Actions:
```yaml
- name: Run benchmarks
  run: cargo bench --workspace

- name: Archive benchmark results
  uses: actions/upload-artifact@v3
  with:
    name: criterion-results
    path: target/criterion/
```

## Profiling Integration

Combine with flamegraphs for detailed analysis:
```bash
cargo bench --bench terminal_benchmarks --profile-time 10
```
