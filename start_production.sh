#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Start backend
cd "$ROOT/backend"
uv run python main.py &
BACKEND_PID=$!
echo "Started backend (PID $BACKEND_PID) on port 8000"

# Wait for backend to be ready (max 30s)
for i in {1..30}; do
  if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo "Backend is ready"
    break
  fi
  sleep 1
done

# Start frontend in foreground
cd "$ROOT/frontend"
exec npm run start
