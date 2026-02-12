use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use std::fs;
use std::path::PathBuf;
use std::time::Duration;
use tempfile::TempDir;

fn create_test_directory(num_files: usize) -> (TempDir, PathBuf) {
    let temp_dir = TempDir::new().unwrap();
    let root_path = temp_dir.path().to_path_buf();

    // Create nested directory structure
    for i in 0..num_files {
        let dir = root_path.join(format!("dir_{}", i % 10));
        fs::create_dir_all(&dir).ok();

        let file_path = dir.join(format!("file_{}.txt", i));
        fs::write(&file_path, format!("content for file {}", i)).unwrap();
    }

    (temp_dir, root_path)
}

fn file_tree_traversal_benchmark(c: &mut Criterion) {
    let mut group = c.benchmark_group("file_tree_traversal");
    group.sample_size(20);

    for num_files in [100, 1_000, 10_000].iter() {
        group.throughput(Throughput::Elements(*num_files as u64));

        group.bench_with_input(BenchmarkId::from_parameter(num_files), num_files, |b, &num_files| {
            let (_temp_dir, root_path) = create_test_directory(num_files);

            b.iter(|| {
                let mut count = 0;
                for entry in walkdir::WalkDir::new(&root_path) {
                    if let Ok(entry) = entry {
                        black_box(entry.path());
                        count += 1;
                    }
                }
                black_box(count);
            });
        });
    }

    group.finish();
}

fn file_metadata_benchmark(c: &mut Criterion) {
    let mut group = c.benchmark_group("file_metadata");

    let (_temp_dir, root_path) = create_test_directory(100);
    let test_file = root_path.join("dir_0/file_0.txt");

    group.bench_function("metadata", |b| {
        b.iter(|| {
            black_box(fs::metadata(&test_file).unwrap());
        });
    });

    group.bench_function("read_to_string", |b| {
        b.iter(|| {
            black_box(fs::read_to_string(&test_file).unwrap());
        });
    });

    group.finish();
}

fn gitignore_filtering_benchmark(c: &mut Criterion) {
    let mut group = c.benchmark_group("gitignore_filtering");
    group.sample_size(20);

    let (_temp_dir, root_path) = create_test_directory(1_000);

    // Create .gitignore
    fs::write(root_path.join(".gitignore"), "dir_5/\n*.log\n").unwrap();

    group.bench_function("walk_with_gitignore", |b| {
        b.iter(|| {
            let walker = ignore::WalkBuilder::new(&root_path)
                .hidden(false)
                .build();

            let mut count = 0;
            for entry in walker {
                if let Ok(entry) = entry {
                    black_box(entry.path());
                    count += 1;
                }
            }
            black_box(count);
        });
    });

    group.finish();
}

criterion_group! {
    name = benches;
    config = Criterion::default()
        .measurement_time(Duration::from_secs(10))
        .warm_up_time(Duration::from_secs(3));
    targets = file_tree_traversal_benchmark, file_metadata_benchmark, gitignore_filtering_benchmark
}
criterion_main!(benches);
