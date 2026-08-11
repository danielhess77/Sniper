#!/usr/bin/env bash
# Sniper API — durable-ish start for Codespaces
# Usage: bash scripts/start-api.sh

set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-3000}"
LOG="${SNIPER_LOG:-/tmp/sniper-api.log}"

echo "[start-api] killing anything on :$PORT"
lsof -ti:"$PORT" 2>/dev/null | xargs -r kill 2>/dev/null || true
sleep 1

echo "[start-api] starting → log $LOG"
# nohup + disown: survive terminal close; still dies if Codespace itself stops
nohup npx tsx src/server/Server.ts >>"$LOG" 2>&1 &
PID=$!
disown "$PID" 2>/dev/null || true

echo "[start-api] PID=$PID"
echo "$PID" > /tmp/sniper-api.pid

sleep 2
if kill -0 "$PID" 2>/dev/null; then
  echo "[start-api] up. health: curl -s http://127.0.0.1:${PORT}/health"
  curl -s "http://127.0.0.1:${PORT}/health" || true
  echo ""
  echo "tail log: tail -f $LOG"
else
  echo "[start-api] process died immediately — last log lines:"
  tail -30 "$LOG" || true
  exit 1
fi
