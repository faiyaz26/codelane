use criterion::{black_box, criterion_group, criterion_main, Criterion};
use codelane_terminal::{Terminal, TerminalSize, TerminalEvent};
use std::path::Path;
use std::time::Duration;
use tokio::sync::mpsc;

fn terminal_spawn_benchmark(c: &mut Criterion) {
    let mut group = c.benchmark_group("terminal_spawn");

    group.bench_function("spawn_bash", |b| {
        b.iter(|| {
            let (tx, _rx) = mpsc::unbounded_channel::<TerminalEvent>();
            let size = TerminalSize { cols: 80, rows: 24 };

            let terminal = Terminal::spawn(
                black_box("/bin/bash"),
                black_box(Path::new(".")),
                black_box(&[]),
                black_box(size),
                tx,
            );

            drop(terminal);
        });
    });

    group.finish();
}

fn terminal_resize_benchmark(c: &mut Criterion) {
    let mut group = c.benchmark_group("terminal_resize");

    group.bench_function("resize", |b| {
        let (tx, _rx) = mpsc::unbounded_channel::<TerminalEvent>();
        let term_size = TerminalSize { cols: 80, rows: 24 };

        let mut terminal = Terminal::spawn(
            "/bin/bash",
            Path::new("."),
            &[],
            term_size,
            tx,
        ).unwrap();

        b.iter(|| {
            let size1 = TerminalSize { cols: 80, rows: 24 };
            let size2 = TerminalSize { cols: 120, rows: 40 };
            terminal.resize(black_box(size1)).ok();
            terminal.resize(black_box(size2)).ok();
        });
    });

    group.finish();
}

criterion_group! {
    name = benches;
    config = Criterion::default()
        .measurement_time(Duration::from_secs(10))
        .warm_up_time(Duration::from_secs(3));
    targets = terminal_spawn_benchmark, terminal_resize_benchmark
}
criterion_main!(benches);
