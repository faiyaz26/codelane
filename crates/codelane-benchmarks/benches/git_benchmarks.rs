use criterion::{black_box, criterion_group, criterion_main, Criterion};
use codelane_git::GitRepository;
use std::path::PathBuf;
use std::time::Duration;
use tempfile::TempDir;

fn create_test_repo() -> (TempDir, PathBuf) {
    let temp_dir = TempDir::new().unwrap();
    let repo_path = temp_dir.path().to_path_buf();

    // Initialize a git repo with some history
    std::process::Command::new("git")
        .args(["init"])
        .current_dir(&repo_path)
        .output()
        .unwrap();

    // Create test files
    std::fs::write(repo_path.join("test1.txt"), "content1").unwrap();
    std::fs::write(repo_path.join("test2.txt"), "content2").unwrap();

    // Initial commit
    std::process::Command::new("git")
        .args(["add", "."])
        .current_dir(&repo_path)
        .output()
        .unwrap();

    std::process::Command::new("git")
        .args(["commit", "-m", "Initial commit"])
        .current_dir(&repo_path)
        .output()
        .unwrap();

    // Modify file
    std::fs::write(repo_path.join("test1.txt"), "modified content").unwrap();

    (temp_dir, repo_path)
}

fn git_status_benchmark(c: &mut Criterion) {
    let mut group = c.benchmark_group("git_status");
    group.sample_size(50);

    let (_temp_dir, repo_path) = create_test_repo();
    let repo = GitRepository::open(&repo_path).unwrap();

    group.bench_function("status", |b| {
        b.iter(|| {
            black_box(repo.status()).ok();
        });
    });

    group.finish();
}

fn git_diff_benchmark(c: &mut Criterion) {
    let mut group = c.benchmark_group("git_diff");
    group.sample_size(50);

    let (_temp_dir, repo_path) = create_test_repo();
    let repo = GitRepository::open(&repo_path).unwrap();

    group.bench_function("diff_unstaged", |b| {
        b.iter(|| {
            black_box(repo.diff_unstaged()).ok();
        });
    });

    group.finish();
}

fn git_log_benchmark(c: &mut Criterion) {
    let mut group = c.benchmark_group("git_log");
    group.sample_size(50);

    let (_temp_dir, repo_path) = create_test_repo();
    let repo = GitRepository::open(&repo_path).unwrap();

    group.bench_function("log_10", |b| {
        b.iter(|| {
            black_box(repo.log(black_box(10))).ok();
        });
    });

    group.bench_function("log_100", |b| {
        b.iter(|| {
            black_box(repo.log(black_box(100))).ok();
        });
    });

    group.finish();
}

criterion_group! {
    name = benches;
    config = Criterion::default()
        .measurement_time(Duration::from_secs(10))
        .warm_up_time(Duration::from_secs(3));
    targets = git_status_benchmark, git_diff_benchmark, git_log_benchmark
}
criterion_main!(benches);
