import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as OverviewControls from 'resource:///org/gnome/shell/ui/overviewControls.js';

const PANEL_TRANSPARENT_STYLE = 'background-color: rgba(0, 0, 0, 0.07);';
const PANEL_COLOR_UNSET = 'unset';
const DOCK_UUIDS = ['ubuntu-dock@ubuntu.com', 'dash-to-dock@micxgx.gmail.com'];
const GESTURE_THRESHOLD = 50;

class TouchpadGestures {
    constructor() {
        this._signalId = 0;
        this._dx = 0;
        this._dy = 0;
    }

    enable() {
        if (this._signalId)
            return;

        this._signalId = global.stage.connect('captured-event', (_actor, event) => this._handleEvent(event));
    }

    disable() {
        if (!this._signalId)
            return;

        global.stage.disconnect(this._signalId);
        this._signalId = 0;
        this._dx = 0;
        this._dy = 0;
    }

    _handleEvent(event) {
        if (event.type() !== Clutter.EventType.TOUCHPAD_SWIPE)
            return Clutter.EVENT_PROPAGATE;

        if (event.get_touchpad_gesture_finger_count() !== 3)
            return Clutter.EVENT_PROPAGATE;

        const phase = event.get_gesture_phase();

        if (phase === Clutter.TouchpadGesturePhase.UPDATE) {
            const [dx, dy] = event.get_gesture_motion_delta();
            this._dx += dx;
            this._dy += dy;
            return Clutter.EVENT_STOP;
        }

        if (phase === Clutter.TouchpadGesturePhase.END)
            this._activateGesture();

        this._dx = 0;
        this._dy = 0;
        return Clutter.EVENT_STOP;
    }

    _activateGesture() {
        if (!(Main.actionMode & (Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW)))
            return;

        if (Math.hypot(this._dx, this._dy) <= GESTURE_THRESHOLD)
            return;

        if (Math.abs(this._dx) > Math.abs(this._dy)) {
            this._toggleOverview();
            return;
        }

        this._toggleApplications();
    }

    _toggleOverview() {
        if (Main.overview.visible) {
            Main.overview.hide();
            return;
        }

        Main.overview.show();
    }

    _toggleApplications() {
        const showAppsButton = Main.overview.dash?.showAppsButton;

        if (Main.overview.visible && showAppsButton?.checked) {
            Main.overview.hide();
            return;
        }

        Main.overview.show(OverviewControls.ControlsState.APP_GRID);

        if (showAppsButton)
            showAppsButton.checked = true;
    }
}

class DynamicTransparency {
    constructor() {
        this._signals = [];
    }

    enable() {
        this._connect(Main.overview, 'showing', () => this.update());
        this._connect(Main.overview, 'hiding', () => this.update());
        this._connect(global.display, 'restacked', () => this.update());
        this._connect(global.display, 'notify::focus-window', () => this.update());
        this._connect(global.window_manager, 'switch-workspace', () => this.update());
        this.update();
    }

    disable() {
        for (const [object, signalId] of this._signals)
            object.disconnect(signalId);

        this._signals = [];
    }

    update() {
        if (!Main.panel)
            return;

        if (Main.overview.visible || !Main.sessionMode.hasWindows) {
            Main.panel.set_style(PANEL_TRANSPARENT_STYLE);
            return;
        }

        const activeWorkspace = global.workspace_manager.get_active_workspace();
        const hasMaximizedWindow = activeWorkspace.list_windows().some(metaWindow => {
            if (!metaWindow.is_on_primary_monitor())
                return false;

            if (!metaWindow.showing_on_its_workspace() || metaWindow.is_hidden())
                return false;

            if (metaWindow.get_window_type() === Meta.WindowType.DESKTOP)
                return false;

            return metaWindow.maximized_vertically;
        });

        Main.panel.set_style(hasMaximizedWindow ? null : PANEL_TRANSPARENT_STYLE);
    }

    _connect(object, signal, callback) {
        this._signals.push([object, object.connect(signal, callback)]);
    }
}

class SafeTopTaskbar {
    constructor(extension, settings) {
        this._extension = extension;
        this._settings = settings;
        this._signals = [];
        this._tracker = Shell.WindowTracker.get_default();
        this._fallbackIcon = Gio.ThemedIcon.new('start-here-symbolic');
        this._indicator = null;
        this._taskBox = null;
        this._refreshSourceId = 0;
        this._activitiesContainer = null;
        this._activitiesWasVisible = null;
    }

    enable() {
        this._indicator = new St.BoxLayout({
            style_class: 'ubuntuvn-taskbar',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._taskBox = new St.BoxLayout({
            style_class: 'ubuntuvn-taskbar-box',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._indicator.add_child(this._taskBox);

        Main.panel._leftBox.insert_child_at_index(this._indicator, 0);
        this._hideActivities();
        this._connectSignals();
        this.refresh();
    }

    disable() {
        for (const [object, signalId] of this._signals)
            object.disconnect(signalId);

        this._signals = [];

        if (this._refreshSourceId) {
            GLib.source_remove(this._refreshSourceId);
            this._refreshSourceId = 0;
        }

        this._restoreActivities();

        const indicatorParent = this._indicator?.get_parent();
        if (indicatorParent)
            indicatorParent.remove_child(this._indicator);

        this._indicator?.destroy();
        this._indicator = null;
        this._taskBox = null;
    }

    refresh() {
        if (!this._taskBox)
            return;

        this._taskBox.destroy_all_children();

        if (this._settings.get_boolean('display-showapps-button'))
            this._taskBox.add_child(this._createShowAppsButton());

        if (!this._settings.get_boolean('display-tasks'))
            return;

        for (const group of this._listWindowGroups())
            this._taskBox.add_child(this._createTaskButton(group));
    }

    _connectSignals() {
        this._connect(global.display, 'restacked', () => this.scheduleRefresh());
        this._connect(global.display, 'notify::focus-window', () => this.scheduleRefresh());
        this._connect(global.display, 'window-created', () => this.scheduleRefresh());
        this._connect(global.display, 'window-demands-attention', () => this.scheduleRefresh());
        this._connect(global.display, 'window-marked-urgent', () => this.scheduleRefresh());
        this._connect(global.workspace_manager, 'active-workspace-changed', () => this.scheduleRefresh());
        this._connect(global.workspace_manager, 'notify::n-workspaces', () => this.scheduleRefresh());
    }

    scheduleRefresh() {
        if (this._refreshSourceId)
            return;

        this._refreshSourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._refreshSourceId = 0;
            this.refresh();
            return GLib.SOURCE_REMOVE;
        });
    }

    _connect(object, signal, callback) {
        this._signals.push([object, object.connect(signal, callback)]);
    }

    _hideActivities() {
        const activities = Main.panel.statusArea.activities;
        this._activitiesContainer = activities?.container ?? activities;

        if (!this._activitiesContainer)
            return;

        this._activitiesWasVisible = this._activitiesContainer.visible;
        this._activitiesContainer.hide();
    }

    _restoreActivities() {
        if (this._activitiesContainer && this._activitiesWasVisible)
            this._activitiesContainer.show();

        this._activitiesContainer = null;
        this._activitiesWasVisible = null;
    }

    _createShowAppsButton() {
        const button = new St.Button({
            style_class: 'favorite-app',
            reactive: true,
            can_focus: true,
            track_hover: true,
        });
        button.set_child(new St.Icon({
            gicon: this._getShowAppsIcon(),
            icon_size: this._getIconSize(),
        }));
        button.connect('button-press-event', (_actor, event) => {
            if (event.get_button() !== Clutter.BUTTON_PRIMARY)
                return Clutter.EVENT_PROPAGATE;

            this._showApplications();
            return Clutter.EVENT_STOP;
        });
        return button;
    }

    _showApplications() {
        const showAppsButton = Main.overview.dash?.showAppsButton;

        if (Main.overview.visible && showAppsButton?.checked) {
            Main.overview.hide();
            return;
        }

        Main.overview.show(OverviewControls.ControlsState.APP_GRID);

        if (showAppsButton)
            showAppsButton.checked = true;
    }

    _getShowAppsIcon() {
        const configuredIcon = this._settings.get_string('appview-button-icon');
        const iconPath = configuredIcon && configuredIcon !== 'unset'
            ? configuredIcon
            : this._getDefaultLogoPath();

        if (!iconPath)
            return this._fallbackIcon;

        return Gio.icon_new_for_string(iconPath);
    }

    _getDefaultLogoPath() {
        for (const path of [`${this._extension.path}/images/logo.png`, `${this._extension.path}/logo.png`]) {
            if (Gio.File.new_for_path(path).query_exists(null))
                return path;
        }

        return null;
    }

    _createTaskButton(group) {
        const styleClass = group.urgent
            ? 'urgent-app'
            : group.focused ? 'focused-app' : 'unfocused-app';
        const button = new St.Button({
            style_class: styleClass,
            reactive: true,
            can_focus: true,
            track_hover: true,
        });
        const content = new St.BoxLayout({
            y_align: Clutter.ActorAlign.CENTER,
        });
        const icon = group.app?.create_icon_texture(this._getIconSize()) ?? new St.Icon({
            icon_name: 'application-x-executable-symbolic',
            icon_size: this._getIconSize(),
        });
        content.add_child(icon);

        if (group.windows.length > 1) {
            content.add_child(new St.Label({
                text: String(group.windows.length),
                y_align: Clutter.ActorAlign.CENTER,
            }));
        }

        const label = this._getTaskLabel(group);
        if (label) {
            content.add_child(new St.Label({
                text: label,
                y_align: Clutter.ActorAlign.CENTER,
            }));
        }

        button.set_child(content);
        button.connect('button-press-event', (_actor, event) => {
            const buttonNumber = event.get_button();

            if (buttonNumber === Clutter.BUTTON_PRIMARY) {
                this._activateOrMinimizeGroup(group);
                return Clutter.EVENT_STOP;
            }

            if (buttonNumber === Clutter.BUTTON_MIDDLE) {
                this._closeGroupWindow(group);
                return Clutter.EVENT_STOP;
            }

            return Clutter.EVENT_PROPAGATE;
        });
        return button;
    }

    _getTaskLabel(group) {
        switch (this._settings.get_enum('tasks-label')) {
        case 1:
            return group.windows[0]?.get_title() ?? '';
        case 2:
            return group.app?.get_name() ?? group.windows[0]?.get_title() ?? '';
        default:
            return '';
        }
    }

    _activateOrMinimizeGroup(group) {
        if (group.focused) {
            for (const metaWindow of group.windows)
                metaWindow.minimize();
            return;
        }

        const targetWindow = group.windows.find(metaWindow => !metaWindow.minimized) ?? group.windows[0];
        if (targetWindow)
            Main.activateWindow(targetWindow);
    }

    _closeGroupWindow(group) {
        const targetWindow = group.windows.find(metaWindow => metaWindow === global.display.focus_window) ?? group.windows[0];
        targetWindow?.delete(global.get_current_time());
    }

    _listWindowGroups() {
        const groups = new Map();
        for (const metaWindow of this._listWindows()) {
            const app = this._tracker.get_window_app(metaWindow);
            const id = app?.get_id() ?? metaWindow.get_wm_class() ?? String(metaWindow.get_pid());
            let group = groups.get(id);

            if (!group) {
                group = {
                    app,
                    windows: [],
                    focused: false,
                    urgent: false,
                    sequence: metaWindow.get_stable_sequence(),
                };
                groups.set(id, group);
            }

            group.windows.push(metaWindow);
            group.focused ||= metaWindow === global.display.focus_window;
            group.urgent ||= metaWindow.urgent || metaWindow.demandsAttention;
            group.sequence = Math.min(group.sequence, metaWindow.get_stable_sequence());
        }

        return [...groups.values()].sort((a, b) => a.sequence - b.sequence);
    }

    _listWindows() {
        const activeWorkspace = global.workspace_manager.get_active_workspace();
        return activeWorkspace.list_windows()
            .filter(metaWindow => !(metaWindow.is_skip_taskbar?.() ?? metaWindow.skip_taskbar))
            .filter(metaWindow => metaWindow.get_window_type() !== Meta.WindowType.DESKTOP)
            .sort((a, b) => a.get_stable_sequence() - b.get_stable_sequence());
    }

    _getIconSize() {
        return Math.max(16, Math.min(32, this._settings.get_int('panel-size') - 6));
    }
}

export default class UbuntuvnDesktopExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._settingSignals = [];
        this._dynamicTransparency = null;
        this._topTaskbar = null;
        this._touchpadGestures = null;
        this._shellSettings = new Gio.Settings({schema_id: 'org.gnome.shell'});
        this._docksDisabledByUs = new Set();
        this._hotCorner = null;
        this._panelVisible = true;
        this._originalPanelStyle = Main.panel?.get_style() ?? null;

        this._connectSetting('changed::dynamic-transparent', () => this._syncPanelStyle());
        this._connectSetting('changed::panel-background-color', () => this._syncPanelStyle());
        this._connectSetting('changed::reset-login-background', () => this._resetLoginBackground());
        this._connectSetting('changed::display-tasks', () => this._topTaskbar?.scheduleRefresh());
        this._connectSetting('changed::display-showapps-button', () => this._topTaskbar?.scheduleRefresh());
        this._connectSetting('changed::appview-button-icon', () => this._topTaskbar?.scheduleRefresh());
        this._connectSetting('changed::tasks-label', () => this._topTaskbar?.scheduleRefresh());
        this._connectSetting('changed::dock-enable', () => this._syncDockState());

        this._topTaskbar = new SafeTopTaskbar(this, this._settings);
        this._topTaskbar.enable();
        this._touchpadGestures = new TouchpadGestures();
        this._touchpadGestures.enable();
        this._addKeybindings();
        this._enableHotCorner();
        this._syncPanelStyle();
        this._syncDockState();
    }

    disable() {
        this._restoreDocks();
        this._disableHotCorner();
        this._removeKeybindings();
        this._touchpadGestures?.disable();
        this._touchpadGestures = null;
        this._topTaskbar?.disable();
        this._topTaskbar = null;
        this._disableDynamicTransparency();

        for (const signalId of this._settingSignals ?? [])
            this._settings.disconnect(signalId);

        this._settingSignals = [];

        if (Main.panel)
            Main.panel.set_style(this._originalPanelStyle);

        if (Main.panel)
            Main.panel.visible = true;

        if (Main.layoutManager.panelBox)
            Main.layoutManager.panelBox.visible = true;

        this._settings = null;
        this._shellSettings = null;
        this._originalPanelStyle = null;
        this._docksDisabledByUs = null;
    }

    _connectSetting(signal, callback) {
        this._settingSignals.push(this._settings.connect(signal, callback));
    }

    _addKeybindings() {
        Main.wm.addKeybinding(
            'toggle-material-shell-ui',
            this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            () => this._togglePanelVisibility()
        );
    }

    _removeKeybindings() {
        for (const name of ['toggle-material-shell-ui']) {
            try {
                Main.wm.removeKeybinding(name);
            } catch (error) {
                console.error(`Failed to remove ${name} keybinding: ${error}`);
            }
        }
    }

    _enableHotCorner() {
        if (this._hotCorner)
            return;

        this._hotCorner = new St.Widget({
            reactive: true,
            x: 0,
            y: 0,
            width: 3,
            height: 3,
        });
        this._hotCorner.connect('enter-event', () => {
            this._showOverview();
            return Clutter.EVENT_PROPAGATE;
        });
        Main.layoutManager.addChrome(this._hotCorner, {trackFullscreen: true});
    }

    _disableHotCorner() {
        if (!this._hotCorner)
            return;

        Main.layoutManager.removeChrome(this._hotCorner);
        this._hotCorner.destroy();
        this._hotCorner = null;
    }

    _showOverview() {
        if (!Main.overview.visible)
            Main.overview.show();
    }

    _togglePanelVisibility() {
        this._panelVisible = !this._panelVisible;

        if (Main.panel)
            Main.panel.visible = this._panelVisible;

        if (Main.layoutManager.panelBox)
            Main.layoutManager.panelBox.visible = this._panelVisible;
    }

    _syncDockState() {
        if (this._settings.get_boolean('dock-enable')) {
            this._restoreDocks();
            return;
        }

        this._hideDocks();
    }

    _hideDocks() {
        const enabledExtensions = this._shellSettings.get_strv('enabled-extensions');
        const nextEnabledExtensions = enabledExtensions.filter(uuid => {
            if (!DOCK_UUIDS.includes(uuid))
                return true;

            this._docksDisabledByUs.add(uuid);
            return false;
        });

        if (nextEnabledExtensions.length !== enabledExtensions.length)
            this._shellSettings.set_strv('enabled-extensions', nextEnabledExtensions);
    }

    _restoreDocks() {
        const disabledByUs = [...this._docksDisabledByUs ?? []];
        if (disabledByUs.length === 0)
            return;

        const enabledExtensions = this._shellSettings.get_strv('enabled-extensions');
        const nextEnabledExtensions = [...enabledExtensions];

        for (const uuid of disabledByUs) {
            if (!nextEnabledExtensions.includes(uuid))
                nextEnabledExtensions.push(uuid);
        }

        this._shellSettings.set_strv('enabled-extensions', nextEnabledExtensions);
        this._docksDisabledByUs?.clear();
    }

    _resetLoginBackground() {
        if (!this._settings.get_boolean('reset-login-background'))
            return;

        this._settings.set_boolean('reset-login-background', false);
        Main.notify(
            this.metadata.name,
            'Login background reset is unsupported on Ubuntu 26.04 because it modifies system GNOME Shell resources.'
        );
    }

    _syncPanelStyle() {
        if (this._settings.get_boolean('dynamic-transparent')) {
            this._enableDynamicTransparency();
            return;
        }

        this._disableDynamicTransparency();
        this._applyConfiguredPanelColor();
    }

    _enableDynamicTransparency() {
        if (!this._dynamicTransparency) {
            this._dynamicTransparency = new DynamicTransparency();
            this._dynamicTransparency.enable();
        }

        this._dynamicTransparency.update();
    }

    _disableDynamicTransparency() {
        if (!this._dynamicTransparency)
            return;

        this._dynamicTransparency.disable();
        this._dynamicTransparency = null;
    }

    _applyConfiguredPanelColor() {
        if (!Main.panel)
            return;

        const panelColor = this._settings.get_string('panel-background-color');
        Main.panel.set_style(panelColor !== PANEL_COLOR_UNSET ? `background-color: ${panelColor};` : this._originalPanelStyle);
    }
}
