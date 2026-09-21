#!/bin/sh
# Callback Assistant — API watchdog.
#
# Polls TARGET_URL. After FAIL_THRESHOLD consecutive failures it posts a
# "down" event to ALERT_WEBHOOK_URL; after recovery it posts an "up" event.
# Keeps running forever so the monitor container never exits.

set -u

TARGET_URL="${TARGET_URL:-http://api:3000/api}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-30}"
FAIL_THRESHOLD="${FAIL_THRESHOLD:-2}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"

failures=0
state="up"

log() {
  echo "$(date -Iseconds) [$state] $*"
}

notify() {
  event="$1"
  [ -z "$ALERT_WEBHOOK_URL" ] && return 0
  payload=$(printf '{"event":"%s","url":"%s","state":"%s","checked_at":"%s"}' \
    "$event" "$TARGET_URL" "$event" "$(date -Iseconds)")
  # curl is available in the monitor image; ignore failures on notification.
  curl -fsS -X POST -H 'Content-Type: application/json' -d "$payload" \
    "$ALERT_WEBHOOK_URL" >/dev/null 2>&1 || true
}

while true; do
  if curl -fsS --max-time 10 "$TARGET_URL" >/dev/null 2>&1; then
    if [ "$state" = "down" ]; then
      state="up"
      log "API is reachable again"
      notify "up"
    fi
    failures=0
  else
    failures=$((failures + 1))
    log "API check failed ($failures/$FAIL_THRESHOLD)"
    if [ "$failures" -ge "$FAIL_THRESHOLD" ] && [ "$state" = "up" ]; then
      state="down"
      notify "down"
    fi
  fi

  sleep "$INTERVAL_SECONDS"
done
