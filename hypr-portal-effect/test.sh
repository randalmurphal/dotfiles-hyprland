#!/bin/bash
# Quick test script - builds plugin and runs in nested Hyprland

cd "$(dirname "$0")"

# Build
echo "Building..."
cmake --build build || exit 1

# Copy to test location
cp build/libhypr-portal-effect.so /tmp/portal-test.so

# Run nested Hyprland (opens in a window)
echo "Starting nested Hyprland... (Super+Escape to exit)"
Hyprland -c "$(pwd)/test-config.conf"

# Show the log after exit
echo ""
echo "=== Plugin logs ==="
grep -i portal /run/user/1000/hypr/*/hyprland.log 2>/dev/null | grep -v Documentation | tail -20
