use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use std::time::Duration;

/// Simulates Tauri IPC serialization/deserialization overhead
fn ipc_serialization_benchmark(c: &mut Criterion) {
    let mut group = c.benchmark_group("ipc_serialization");

    // Small payload (typical command)
    let small_payload = serde_json::json!({
        "command": "git_status",
        "path": "/path/to/repo"
    });

    group.bench_function("serialize_small", |b| {
        b.iter(|| {
            black_box(serde_json::to_string(&small_payload).unwrap());
        });
    });

    group.bench_function("deserialize_small", |b| {
        let json_str = serde_json::to_string(&small_payload).unwrap();
        b.iter(|| {
            black_box(serde_json::from_str::<serde_json::Value>(&json_str).unwrap());
        });
    });

    // Large payload (terminal output)
    let large_payload = serde_json::json!({
        "output": "x".repeat(10_000),
        "timestamp": 1234567890
    });

    group.throughput(Throughput::Bytes(10_000));

    group.bench_function("serialize_large", |b| {
        b.iter(|| {
            black_box(serde_json::to_string(&large_payload).unwrap());
        });
    });

    group.bench_function("deserialize_large", |b| {
        let json_str = serde_json::to_string(&large_payload).unwrap();
        b.iter(|| {
            black_box(serde_json::from_str::<serde_json::Value>(&json_str).unwrap());
        });
    });

    group.finish();
}

/// Simulates event emission patterns
fn ipc_event_throughput_benchmark(c: &mut Criterion) {
    let mut group = c.benchmark_group("ipc_event_throughput");

    for batch_size in [1, 10, 100, 1000].iter() {
        group.throughput(Throughput::Elements(*batch_size as u64));

        group.bench_with_input(BenchmarkId::from_parameter(batch_size), batch_size, |b, &batch_size| {
            b.iter(|| {
                for _ in 0..batch_size {
                    let event = serde_json::json!({"data": "terminal output line"});
                    black_box(serde_json::to_string(&event).unwrap());
                }
            });
        });
    }

    group.finish();
}

criterion_group! {
    name = benches;
    config = Criterion::default()
        .measurement_time(Duration::from_secs(10))
        .warm_up_time(Duration::from_secs(3));
    targets = ipc_serialization_benchmark, ipc_event_throughput_benchmark
}
criterion_main!(benches);
