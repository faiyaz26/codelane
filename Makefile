.PHONY: dev build clean install check test fmt lint release help

# Default target
help:
	@echo "Codelane Build Commands"
	@echo "======================="
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development server (Tauri + SolidJS)"
	@echo "  make frontend     - Run frontend only (Vite)"
	@echo ""
	@echo "Building:"
	@echo "  make build        - Build release binary"
	@echo "  make release      - Build optimized release"
	@echo ""
	@echo "Code Quality:"
	@echo "  make check        - Run cargo check"
	@echo "  make test         - Run all tests"
	@echo "  make fmt          - Format code with rustfmt"
	@echo "  make lint         - Run clippy lints"
	@echo ""
	@echo "Performance:"
	@echo "  make bench        - Run all benchmarks"
	@echo "  make bench-quick  - Run quick benchmarks (smaller sample size)"
	@echo "  make profile      - Profile and analyze bundle size"
	@echo "  make perf-report  - Generate complete performance report"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean        - Clean build artifacts"
	@echo "  make install      - Install required tools"

# Development
dev:
	pnpm tauri dev --features devtools

frontend:
	cd frontend && pnpm dev

# Building
build:
	pnpm build

release:
	pnpm tauri build

# Code Quality
check:
	cargo check --workspace

test:
	cargo test --workspace

fmt:
	cargo fmt --all

lint:
	cargo clippy --workspace -- -D warnings

# Maintenance
clean:
	cargo clean
	rm -rf frontend/dist/
	rm -rf frontend/node_modules/
	rm -rf src-tauri/target/
	rm -rf node_modules/

install:
	@echo "Installing dependencies..."
	pnpm install
	@echo "Installation complete!"

# Performance & Benchmarking
bench:
	@echo "Running comprehensive benchmarks..."
	cargo bench --package codelane-benchmarks
	@echo "\nBenchmark results available in: target/criterion/report/index.html"

bench-quick:
	@echo "Running quick benchmarks..."
	cargo bench --package codelane-benchmarks -- --sample-size 10

bench-terminal:
	cargo bench --package codelane-benchmarks --bench terminal_benchmarks

bench-git:
	cargo bench --package codelane-benchmarks --bench git_benchmarks

bench-ipc:
	cargo bench --package codelane-benchmarks --bench ipc_benchmarks

bench-file:
	cargo bench --package codelane-benchmarks --bench file_operations

profile:
	@echo "Building and analyzing bundle size..."
	cd frontend && pnpm build
	@echo "\nBundle analysis:"
	@du -sh frontend/dist/*
	@echo "\nDetailed size breakdown:"
	@find frontend/dist -type f -exec ls -lh {} \; | awk '{print $$5 "\t" $$9}' | sort -hr

perf-report:
	@echo "Generating comprehensive performance report..."
	@./scripts/perf-report.sh

# Platform-specific builds
build-macos:
	pnpm tauri build --target universal-apple-darwin

build-linux:
	pnpm tauri build --target x86_64-unknown-linux-gnu

build-windows:
	pnpm tauri build --target x86_64-pc-windows-msvc
