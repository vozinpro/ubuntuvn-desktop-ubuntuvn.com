import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class UbuntuvnDesktopPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'Ubuntuvn Desktop',
            icon_name: 'preferences-desktop-symbolic',
        });

        const activeGroup = new Adw.PreferencesGroup({
            title: 'GNOME 50 mode',
            description: 'Provides a top-panel Ubuntu icon, active-window taskbar, dock suppression, and safe panel styling on Ubuntu 26.04 / GNOME 50.',
        });

        const dynamicTransparencyRow = new Adw.SwitchRow({
            title: 'Dynamic panel transparency',
            subtitle: 'Make the top panel transparent when no maximized window touches it.',
        });
        settings.bind(
            'dynamic-transparent',
            dynamicTransparencyRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        activeGroup.add(dynamicTransparencyRow);

        const showAppsRow = new Adw.SwitchRow({
            title: 'Show Ubuntu icon',
            subtitle: 'Show the Ubuntuvn icon on the top panel.',
        });
        settings.bind(
            'display-showapps-button',
            showAppsRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        activeGroup.add(showAppsRow);

        const displayTasksRow = new Adw.SwitchRow({
            title: 'Show taskbar buttons',
            subtitle: 'Show active workspace windows on the top panel.',
        });
        settings.bind(
            'display-tasks',
            displayTasksRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        activeGroup.add(displayTasksRow);

        const showDockRow = new Adw.SwitchRow({
            title: 'Keep Ubuntu Dock visible',
            subtitle: 'Leave this off for the Ubuntuvn top taskbar layout.',
        });
        settings.bind(
            'dock-enable',
            showDockRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        activeGroup.add(showDockRow);

        const panelColorRow = new Adw.EntryRow({
            title: 'Panel background CSS color',
        });
        panelColorRow.text = settings.get_string('panel-background-color');
        panelColorRow.connect('changed', row => {
            const panelColor = row.text.trim() || 'unset';
            if (panelColor !== settings.get_string('panel-background-color'))
                settings.set_string('panel-background-color', panelColor);
        });
        activeGroup.add(panelColorRow);

        const toggleShortcutRow = new Adw.ActionRow({
            title: 'Toggle panel shortcut',
            subtitle: settings.get_strv('toggle-material-shell-ui').join(', ') || 'Unset',
        });
        activeGroup.add(toggleShortcutRow);

        page.add(activeGroup);

        const legacyGroup = new Adw.PreferencesGroup({
            title: 'Still disabled legacy modules',
        });
        legacyGroup.add(new Adw.ActionRow({
            title: 'Advanced tiling, previews, and system menu tweaks',
            subtitle: 'These GNOME 3 modules depend on private Shell internals and are not loaded on GNOME 50.',
        }));
        page.add(legacyGroup);

        window.add(page);
    }
}
