# Ubuntuvn GNOME Desktop Extension

Ubuntuvn Desktop is the default desktop interface extension for the Ubuntuvn GNOME edition.

This branch has been ported for Ubuntu 26.04 / GNOME Shell 50 with a modern GNOME Shell extension entrypoint and preferences UI. It keeps the visible Ubuntuvn desktop experience while avoiding legacy GNOME 3 private APIs that no longer work on current GNOME Shell releases.

## Current features

- Top-panel Ubuntuvn logo button.
- Click the logo to open the GNOME app grid; click it again to return to the desktop.
- Top-left hot corner opens the GNOME overview, like pressing the Super key.
- Three-finger touchpad swipes toggle the overview or app grid.
- Top-panel tasklist for running apps on the active workspace.
- Minimized apps remain visible in the tasklist.
- Windows are grouped by application.
- Focused, unfocused, and urgent/notification apps use separate task styles.
- Left-click a task to activate it or minimize the focused group.
- Middle-click a task to close a window in that group.
- Ubuntu Dock / Dash-to-Dock is hidden while the extension is active, unless disabled in preferences.
- Dynamic top-panel transparency.
- GNOME 50/libadwaita preferences window.

## Removed or disabled legacy features

The old GNOME 3 modules for advanced tiling, previews, Places/system-menu changes, and YouTube search were removed or left disabled because they depended on private GNOME Shell internals that changed in GNOME 50.

The login background reset script is also unsupported on modern Ubuntu because it modifies system GNOME Shell resources.

## Install from source

Clone the extension into the GNOME Shell extensions directory:

```sh
git clone https://github.com/vozinpro/ubuntuvn-desktop-ubuntuvn.com ~/.local/share/gnome-shell/extensions/ubuntuvn-desktop@ubuntuvn.com
```

Compile the settings schema:

```sh
glib-compile-schemas ~/.local/share/gnome-shell/extensions/ubuntuvn-desktop@ubuntuvn.com/schemas/
```

Log out and log back in, then enable the extension:

```sh
gnome-extensions enable ubuntuvn-desktop@ubuntuvn.com
```

Check extension status:

```sh
gnome-extensions info ubuntuvn-desktop@ubuntuvn.com
```

The state should be `ACTIVE`.

## Build an installable package

From the project directory:

```sh
glib-compile-schemas schemas/
gnome-extensions pack --force --extra-source=images/logo.png .
```

Install the generated package:

```sh
gnome-extensions install --force ubuntuvn-desktop@ubuntuvn.com.shell-extension.zip
```

Log out and log back in if GNOME Shell keeps an older cached extension module.

## Troubleshooting

If the extension is enabled but not visible, check its state:

```sh
gnome-extensions info ubuntuvn-desktop@ubuntuvn.com
```

If the state is `ERROR`, inspect GNOME Shell extension errors:

```sh
gdbus call --session \
  --dest org.gnome.Shell.Extensions \
  --object-path /org/gnome/Shell/Extensions \
  --method org.gnome.Shell.Extensions.GetExtensionErrors \
  ubuntuvn-desktop@ubuntuvn.com
```

If new code was installed but old behavior remains, log out and log back in so GNOME Shell reloads the extension module.

## Settings import/export

Settings use this dconf path:

```text
/org/gnome/shell/extensions/ubuntuvn-desktop/
```

## GNOME Extensions website

https://extensions.gnome.org/extension/3264/ubuntuvn-desktop/

## Compatibility notes

- This branch is tested for Ubuntu 26.04 / GNOME Shell 50.
- Add future GNOME Shell versions to `metadata.json` only after testing on that GNOME Shell version.
- The extension intentionally does not load legacy GNOME 3 modules on GNOME 50.
