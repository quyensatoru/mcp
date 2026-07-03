#!/bin/bash

if pgrep -f "remote-debugging-port=9222" > /dev/null; then
  echo "Debug Chrome đã chạy rồi."
  exit 0
fi

google-chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.chrome-debug" \
  --no-first-run \
  --no-default-browser-check \
  --password-store=basic \
  > /tmp/chrome-debug.log 2>&1 &

echo "Đã khởi động, PID: $!"
