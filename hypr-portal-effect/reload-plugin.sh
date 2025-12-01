#!/bin/bash
# Script to safely reload the portal effect plugin
# IMPORTANT: Unload BEFORE copying to avoid SIGBUS crashes

PLUGIN_NAME="libhypr-portal-effect.so"
BUILD_PATH="$HOME/dotfiles-hyprland/hypr-portal-effect/build/$PLUGIN_NAME"
INSTALL_PATH="$HOME/.local/share/hyprland/plugins/$PLUGIN_NAME"

# Find current Hyprland instance
HYPR_INSTANCE=$(find /run/user/1000/hypr/ -maxdepth 1 -type d -name "0*" -printf '%T@ %f\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2)

if [ -z "$HYPR_INSTANCE" ]; then
    echo "Error: Hyprland is not running!"
    exit 1
fi

export HYPRLAND_INSTANCE_SIGNATURE="$HYPR_INSTANCE"
echo "Using Hyprland instance: $HYPR_INSTANCE"

# Step 1: Unload FIRST (critical to avoid SIGBUS)
echo "Step 1: Unloading plugin..."
hyprctl plugin unload "$INSTALL_PATH" 2>/dev/null || echo "(Plugin was not loaded)"

# Step 2: Copy new plugin
echo "Step 2: Copying new plugin..."
cp "$BUILD_PATH" "$INSTALL_PATH"

# Step 3: Load plugin
echo "Step 3: Loading plugin..."
hyprctl plugin load "$INSTALL_PATH"

# Step 4: Enable debug logs
echo "Step 4: Enabling debug logs..."
hyprctl keyword debug:disable_logs false

echo ""
echo "Done! Close a window to test the animation."
echo "Watch logs with: tail -f /run/user/1000/hypr/$HYPR_INSTANCE/hyprland.log | grep PortalEffect"
