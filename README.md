# Dark Purple Hyprland Dotfiles

A cohesive dark purple theme for Hyprland on Wayland, featuring custom GTK4/libadwaita theming, Qt/KDE integration, and a macOS-inspired AGS shell.

## Screenshots

<!-- Add your screenshots here -->

## What's Included

| Component | Description |
|-----------|-------------|
| **AGS** | Custom GTK4 shell with bar, launcher, popups, notifications |
| **Hyprland** | Window manager config with purple borders and animations |
| **GTK4** | Full libadwaita CSS override with custom purple palette |
| **GTK3** | Matching theme colors for legacy apps |
| **Qt/KDE** | Color scheme + Kvantum for consistent Qt theming |
| **Cursor** | Oreo Spark Purple (Material Design with animations) |
| **Icons** | Papirus-Dark with violet folders |

## Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Purple Primary | `#9d4edd` | Accents, borders, highlights |
| Purple Secondary | `#7b2cbf` | Hover states, gradients |
| Purple Dim | `#5a189a` | Deep accent |
| Background Dark | `#0d0d0d` | Darkest surfaces |
| Background Surface | `#121218` | Primary background |
| Background Elevated | `#1a1a2e` | Cards, popups |
| Text Primary | `#e0e0e0` | Main text |
| Text Secondary | `#a0a0a0` | Muted text |

## Installation

### Prerequisites

**openSUSE Tumbleweed:**
```bash
sudo zypper install kvantum-manager kvantum-qt5 qt5ct papirus-icon-theme papirus-folders kvantum-themes hyprland ags
```

**Arch Linux:**
```bash
sudo pacman -S kvantum qt5ct papirus-icon-theme hyprland
yay -S papirus-folders ags-git
```

### Install Dotfiles

```bash
git clone https://github.com/YOUR_USERNAME/dotfiles-hyprland.git ~/dotfiles-hyprland
cd ~/dotfiles-hyprland
chmod +x install.sh
./install.sh
```

### Post-Install

1. Log out and back in (or `hyprctl dispatch exit`)
2. Open Kvantum Manager → Select "KvGnomeDark"
3. Verify apps show dark purple theme

## File Structure

```
dotfiles-hyprland/
├── ags/                    # AGS shell configuration
│   ├── app.tsx             # Entry point
│   ├── launcher.tsx        # Spotlight-style launcher
│   ├── style.scss          # All styling
│   ├── lib/                # Utilities
│   └── widgets/            # Bar, popups, system tray
├── hypr/
│   ├── hyprland.conf       # Main config
│   └── scripts/            # Helper scripts
├── gtk-3.0/
│   ├── gtk.css             # Custom styling
│   ├── colors.css          # Color definitions
│   └── settings.ini        # GTK3 settings
├── gtk-4.0/
│   ├── gtk.css             # libadwaita overrides
│   ├── colors.css          # Color definitions
│   └── settings.ini        # GTK4 settings
├── qt5ct/
│   └── qt5ct.conf          # Qt5 configuration
├── Kvantum/
│   └── kvantum.kvconfig    # Kvantum theme selection
├── color-schemes/
│   └── PurpleDark.colors   # KDE color scheme
├── kdeglobals              # KDE global settings
├── install.sh              # Installation script
└── README.md               # This file
```

## Customization

### Change accent color

1. Edit `ags/style.scss` - update `$purple-primary`, `$purple-secondary`, `$purple-dim`
2. Edit `gtk-4.0/gtk.css` and `gtk-3.0/colors.css` - update color values
3. Edit `color-schemes/PurpleDark.colors` - update RGB values
4. Edit `kdeglobals` - update RGB values in all `[Colors:*]` sections
5. Restart apps or re-login

### Hyprland keybinds

| Keybind | Action |
|---------|--------|
| `Super+D` / `Alt+Space` | App launcher |
| `Super+Return` | Terminal (ghostty) |
| `Super+Q` | Close window |
| `Super+1-9` | Focus/launch apps |
| `Super+Ctrl+1-9` | Switch workspace |

## Font

Uses **Hack Nerd Font** everywhere. Install from [Nerd Fonts](https://www.nerdfonts.com/).

## Credits

- [AGS](https://github.com/Aylur/ags) - GTK4 shell framework
- [Hyprland](https://hyprland.org/) - Wayland compositor
- [Oreo Cursors](https://github.com/varlesh/oreo-cursors) - Cursor theme
- [Papirus Icons](https://github.com/PapirusDevelopmentTeam/papirus-icon-theme) - Icon theme
- [Kvantum](https://github.com/tsujan/Kvantum) - Qt theming engine

## License

MIT
