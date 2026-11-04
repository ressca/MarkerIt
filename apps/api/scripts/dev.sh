#!/bin/sh
set -eu

app_pid=""

stop_app() {
  if [ -n "$app_pid" ] && kill -0 "$app_pid" 2>/dev/null; then
    kill "$app_pid"
    wait "$app_pid" || true
  fi
}

trap 'stop_app; exit 0' INT TERM

source_fingerprint() {
  find src/main -type f -exec sha256sum {} + | sort | sha256sum
}

start_app() {
  gradle --no-daemon bootRun &
  app_pid=$!
}

fingerprint=$(source_fingerprint)
start_app

while kill -0 "$app_pid" 2>/dev/null; do
  sleep 1
  current_fingerprint=$(source_fingerprint)

  if [ "$current_fingerprint" != "$fingerprint" ]; then
    echo "Java source changed; restarting the API..."
    stop_app
    fingerprint=$current_fingerprint
    start_app
  fi
done

wait "$app_pid"
