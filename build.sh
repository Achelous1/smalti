#!/bin/bash
set -e

echo "=== AIDE Build Script ==="
echo ""

# Check pnpm
if ! command -v pnpm &> /dev/null; then
  echo "Error: pnpm is not installed."
  exit 1
fi

# Install dependencies
echo "[1/3] Installing dependencies..."
pnpm install

# Lint
echo "[2/3] Running lint..."
pnpm lint

# Build DMG
echo "[3/3] Building DMG..."
pnpm run make

echo ""
echo "Build complete!"
echo "Output: out/make/"
ls out/make/ 2>/dev/null || true
