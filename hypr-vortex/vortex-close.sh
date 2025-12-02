#!/bin/bash
# Vortex close script - sends window geometry to daemon, waits, then closes

SOCKET="/tmp/hypr-vortex.sock"

# Check if daemon is running
if [ ! -S "$SOCKET" ]; then
    echo "Daemon not running, falling back to normal close"
    hyprctl dispatch killactive
    exit 0
fi

# Get active window geometry using hyprctl
WINDOW_JSON=$(hyprctl activewindow -j)

if [ -z "$WINDOW_JSON" ] || [ "$WINDOW_JSON" = "null" ]; then
    echo "No active window"
    exit 0
fi

# Parse JSON using jq
X=$(echo "$WINDOW_JSON" | jq -r '.at[0]')
Y=$(echo "$WINDOW_JSON" | jq -r '.at[1]')
WIDTH=$(echo "$WINDOW_JSON" | jq -r '.size[0]')
HEIGHT=$(echo "$WINDOW_JSON" | jq -r '.size[1]')
ADDRESS=$(echo "$WINDOW_JSON" | jq -r '.address')

if [ "$X" = "null" ] || [ "$WIDTH" = "null" ]; then
    echo "Failed to get window geometry"
    hyprctl dispatch killactive
    exit 0
fi

echo "Window: $X,$Y ${WIDTH}x${HEIGHT} @ $ADDRESS"

# Send geometry AND address to daemon
RESPONSE=$(echo "$X,$Y,$WIDTH,$HEIGHT,$ADDRESS" | nc -U "$SOCKET" -q 1 2>/dev/null)

if [ "$RESPONSE" = "CLOSE" ]; then
    # Daemon handles hiding and closing
    :
else
    echo "Daemon response: $RESPONSE"
    # Fallback - just close
    hyprctl dispatch killactive
fi
