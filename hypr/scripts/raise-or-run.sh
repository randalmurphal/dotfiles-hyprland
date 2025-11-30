#!/bin/bash
# Raise, run, or cycle through windows of an app
# Usage: raise-or-run.sh <app_class> <launch_command>
# app_class can be partial match (case insensitive)

APP_CLASS="$1"
LAUNCH_CMD="$2"

# Get all windows matching the class (case insensitive, partial match)
WINDOWS=$(hyprctl clients -j | jq -r ".[] | select(.class | ascii_downcase | contains(\"$APP_CLASS\")) | .address")

if [ -z "$WINDOWS" ]; then
    # No windows found, launch the app
    $LAUNCH_CMD &
    exit 0
fi

# Get currently focused window
FOCUSED=$(hyprctl activewindow -j | jq -r '.address')

# Convert to array
WINDOW_ARRAY=($WINDOWS)
WINDOW_COUNT=${#WINDOW_ARRAY[@]}

if [ "$WINDOW_COUNT" -eq 1 ]; then
    # Single window
    if [ "${WINDOW_ARRAY[0]}" == "$FOCUSED" ]; then
        # Already focused, minimize to special workspace
        hyprctl dispatch movetoworkspacesilent special:minimized
    else
        # Not focused, focus it
        hyprctl dispatch focuswindow "address:${WINDOW_ARRAY[0]}"
    fi
else
    # Multiple windows - cycle through them
    FOUND_CURRENT=false
    NEXT_WINDOW=""

    for i in "${!WINDOW_ARRAY[@]}"; do
        if [ "$FOUND_CURRENT" = true ]; then
            NEXT_WINDOW="${WINDOW_ARRAY[$i]}"
            break
        fi
        if [ "${WINDOW_ARRAY[$i]}" == "$FOCUSED" ]; then
            FOUND_CURRENT=true
        fi
    done

    # If we were on the last one or none was focused, go to first
    if [ -z "$NEXT_WINDOW" ]; then
        NEXT_WINDOW="${WINDOW_ARRAY[0]}"
    fi

    hyprctl dispatch focuswindow "address:$NEXT_WINDOW"
fi
