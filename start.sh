#!/usr/bin/env bash
set -e

# 前端: Vite dev server
# 后端: KataGo bridge server

cleanup() {
  echo ""
  echo "Stopping all processes..."
  kill $(jobs -p) 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "Starting frontend (Vite) and backend (KataGo bridge)..."

# Start backend in background
npm run bridge &
BACKEND_PID=$!

# Start frontend in background
npm run dev &
FRONTEND_PID=$!

echo "Frontend PID: $FRONTEND_PID"
echo "Backend PID:  $BACKEND_PID"
echo "Press Ctrl+C to stop both."

# Wait for any process to exit
wait -n 2>/dev/null || wait

cleanup
