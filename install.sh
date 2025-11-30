#!/bin/bash
# =============================================================================
# Dotfiles Installation Script - Dark Purple Hyprland Setup
# =============================================================================
# This script creates symlinks from ~/.config to this dotfiles directory
# Run from the dotfiles directory: ./install.sh
# =============================================================================

set -e

DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$HOME/.config"
LOCAL_SHARE="$HOME/.local/share"

echo "=== Dark Purple Hyprland Dotfiles Installer ==="
echo "Dotfiles directory: $DOTFILES_DIR"
echo ""

# Function to backup and symlink
link_config() {
    local src="$1"
    local dest="$2"

    if [ -e "$dest" ] && [ ! -L "$dest" ]; then
        echo "  Backing up existing $dest to ${dest}.bak"
        mv "$dest" "${dest}.bak"
    elif [ -L "$dest" ]; then
        echo "  Removing existing symlink $dest"
        rm "$dest"
    fi

    echo "  Linking $src -> $dest"
    ln -s "$src" "$dest"
}

# Ensure directories exist
mkdir -p "$CONFIG_DIR"
mkdir -p "$LOCAL_SHARE/color-schemes"
mkdir -p "$LOCAL_SHARE/icons"

echo ""
echo "=== Linking configurations ==="

# Main config directories
link_config "$DOTFILES_DIR/ags" "$CONFIG_DIR/ags"
link_config "$DOTFILES_DIR/hypr" "$CONFIG_DIR/hypr"
link_config "$DOTFILES_DIR/gtk-3.0" "$CONFIG_DIR/gtk-3.0"
link_config "$DOTFILES_DIR/gtk-4.0" "$CONFIG_DIR/gtk-4.0"
link_config "$DOTFILES_DIR/qt5ct" "$CONFIG_DIR/qt5ct"
link_config "$DOTFILES_DIR/Kvantum" "$CONFIG_DIR/Kvantum"

# Single files
link_config "$DOTFILES_DIR/kdeglobals" "$CONFIG_DIR/kdeglobals"

# Color schemes (goes to .local/share)
link_config "$DOTFILES_DIR/color-schemes/PurpleDark.colors" "$LOCAL_SHARE/color-schemes/PurpleDark.colors"

echo ""
echo "=== Installing cursor theme ==="
# Download and install Oreo Spark Purple cursor if not present
if [ ! -d "$LOCAL_SHARE/icons/oreo_spark_purple_cursors" ]; then
    echo "  Downloading Oreo Spark Purple cursors..."
    cd /tmp
    git clone --depth 1 https://github.com/milkmadedev/oreo-cursors-compiled.git 2>/dev/null || true
    cp -r /tmp/oreo-cursors-compiled/oreo_spark_purple_cursors "$LOCAL_SHARE/icons/"
    rm -rf /tmp/oreo-cursors-compiled
    echo "  Cursor theme installed!"
else
    echo "  Cursor theme already installed"
fi

echo ""
echo "=== Required packages ==="
echo "Install these packages for full functionality:"
echo ""
echo "  # openSUSE Tumbleweed:"
echo "  sudo zypper install kvantum-manager kvantum-qt5 qt5ct papirus-icon-theme papirus-folders kvantum-themes"
echo ""
echo "  # Arch Linux:"
echo "  sudo pacman -S kvantum qt5ct papirus-icon-theme"
echo "  yay -S papirus-folders"
echo ""

echo "=== Setting Papirus folder color ==="
if command -v papirus-folders &> /dev/null; then
    papirus-folders -C violet --theme Papirus-Dark 2>/dev/null || papirus-folders -C violet 2>/dev/null || true
    echo "  Folder color set to violet"
else
    echo "  papirus-folders not found - install papirus-folders package"
fi

echo ""
echo "=== Done! ==="
echo ""
echo "Next steps:"
echo "  1. Log out and back in (or restart Hyprland)"
echo "  2. Open Kvantum Manager and select 'KvGnomeDark' theme"
echo "  3. Verify theming in GTK and Qt apps"
echo ""
echo "Your dark purple setup is ready!"
