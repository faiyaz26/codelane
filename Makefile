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
	@echo "Maintenance:"
	@echo "  make clean        - Clean build artifacts"
	@echo "  make install      - Install required tools"

# Development
dev:
	pnpm dev

frontend:
	cd frontend && pnpm dev

# Building
build:
	pnpm build

release:
	pnpm tauri build --release

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

# Platform-specific builds
build-macos:
	pnpm tauri build --target universal-apple-darwin

build-linux:
	pnpm tauri build --target x86_64-unknown-linux-gnu

build-windows:
	pnpm tauri build --target x86_64-pc-windows-msvc
