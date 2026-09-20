#!/usr/bin/env bash
# dev-live.sh — one command to (re)start local live-testing over cloudflared.
#
#   • ensures the backend is running on :8000
#   • starts TWO fresh cloudflared tunnels: backend (:8000) + Metro (:8081)
#   • writes the backend tunnel into chingiring-app/.env (EXPO_PUBLIC_API_URL)
#   • prints the exact Metro command to run
#
# Re-run it any time the tunnels die (Mac sleep, new day, "problem loading…").
#   bash dev-live.sh
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
ENV="$ROOT/chingiring-app/.env"

echo "▶ Ensuring backend on :8000…"
if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:8000/auth/me 2>/dev/null)" != "401" ]; then
  ( cd "$BACKEND" && nohup node src/server.js > /tmp/chingi-backend.log 2>&1 & )
  for i in $(seq 1 25); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:8000/auth/me 2>/dev/null)" = "401" ] && break
    sleep 1
  done
fi
echo "  backend :8000 → $(curl -s -o /dev/null -w '%{http_code}' --max-time 4 http://localhost:8000/auth/me 2>/dev/null)"

# Start one cloudflared quick tunnel for $1, retrying past hostnames that never
# resolve (trycloudflare hands those out sometimes). Echoes a working https URL.
start_tunnel () {
  local port="$1" log="/tmp/chingi-tunnel-$1.log" url host code
  for attempt in 1 2 3 4 5; do
    pkill -f "cloudflared.*localhost:$port" 2>/dev/null; sleep 1; : > "$log"
    nohup cloudflared tunnel --url "http://localhost:$port" --no-autoupdate > "$log" 2>&1 &
    url=""
    for i in $(seq 1 20); do
      url=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$log" | head -1)
      [ -n "$url" ] && break; sleep 1
    done
    host="${url#https://}"
    for i in $(seq 1 8); do
      sleep 4
      if host -W 3 "$host" >/dev/null 2>&1; then
        code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url" 2>/dev/null)
        [ "$code" != "000" ] && { echo "$url"; return 0; }
      fi
    done
  done
  echo ""; return 1
}

echo "▶ Starting backend tunnel (:8000)…"
BURL="$(start_tunnel 8000)"; [ -z "$BURL" ] && { echo "  ✗ backend tunnel failed — just re-run the script"; exit 1; }
echo "▶ Starting Metro tunnel (:8081)…"
MURL="$(start_tunnel 8081)"; [ -z "$MURL" ] && { echo "  ✗ metro tunnel failed — just re-run the script"; exit 1; }

# Point the app's API at the backend tunnel (the active, uncommented line).
if grep -qE '^EXPO_PUBLIC_API_URL=' "$ENV"; then
  sed -i '' -E "s#^EXPO_PUBLIC_API_URL=.*#EXPO_PUBLIC_API_URL=$BURL#" "$ENV"
else
  printf '\nEXPO_PUBLIC_API_URL=%s\n' "$BURL" >> "$ENV"
fi

echo ""
echo "✓ Backend tunnel → $BURL   (written to .env)"
echo "✓ Metro tunnel   → $MURL"
echo ""
if lsof -nP -iTCP:8081 -sTCP:LISTEN 2>/dev/null | grep -q LISTEN; then
  echo "⚠  An old Metro is already on :8081 — stop it first (Ctrl+C in its terminal),"
  echo "   or the tunnel serves the stale one and you'll get 'problem loading the project'."
  echo ""
fi
echo "Now run Metro:"
echo ""
echo "  cd chingiring-app && EXPO_PACKAGER_PROXY_URL=$MURL npx expo start --dev-client -c"
echo ""
