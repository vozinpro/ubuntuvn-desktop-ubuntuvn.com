const {Clutter, GLib, St} = imports.gi;
const Signals = imports.signals;
const Main = imports.ui.main;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const {MaximizeLayout} = Me.imports.tilingManager.tilingLayouts.maximize;
const {debounce} = Me.imports.utils.index;
const WindowUtils = Me.imports.utils.windows;
const EMIT_DEBOUNCE_DELAY = 100;

var SuperWorkspace = class SuperWorkspace {
    constructor(
        superWorkspaceManager,
        categoryKey,
        category,
        apps,
        monitor,
        visible
    ) {
        this.superWorkspaceManager = superWorkspaceManager;
        this.categoryKey = categoryKey;
        this.category = category;
        this.monitor = monitor;
        this.apps = apps;
        this.monitorIsPrimary =
            monitor.index === Main.layoutManager.primaryIndex;
        this.category = category;
        this.windows = [];
        this.uiVisible = visible;
        let previousLayout =
            Me.stateManager.getState(
                `${this.categoryKey}_${this.monitor.index}`
            ) || MaximizeLayout.key;
        const Layout = global.tilingManager.getLayoutByKey(previousLayout);
        this.tilingLayout = new Layout(this);
        this.frontendContainer = new St.Widget();
        this.frontendContainer.set_position(this.monitor.x, this.monitor.y);

        // Only emit window changed after EMIT_DEBOUNCE_DELAY ms without call
        // This prevents multiple tiling on window add for instance
        this.emitWindowsChangedDebounced = debounce(
            this.emitWindowsChanged,
            EMIT_DEBOUNCE_DELAY
        );
        this.panel = Main.panel;
        this.tilingButton = Me.tilingButton;
        this.tilingButton.connect('button-press-event', (actor, button) => {
            // Go in reverse direction on right click (button: 3)
            this.nextTiling(button === 3 ? -1 : 1);
        });
        this.windowFocused = null;
        this.focusEventId = global.display.connect(
            'notify::focus-window',
            () => {
                let windowFocused = global.display.focus_window;
                if (!this.windows.includes(windowFocused)) {
                    return;
                }

                /*
                 If the current superWorkspace focused window actor is inaccessible it's mean that this notify is the was automatically made by gnome-shell to try to focus previous window
                 We want to prevent this in order to handle it ourselves to select the next one instead of the previous.
                */
                if (
                    this.windowFocused &&
                    !this.windowFocused.get_compositor_private()
                ) {
                    return;
                }

                if (windowFocused.is_attached_dialog()) {
                    windowFocused = windowFocused.get_transient_for();
                }
                this.onFocus(windowFocused);
            }
        );

        this.loadedSignalId = Me.connect(
            'extension-loaded',
            this.handleExtensionLoaded.bind(this)
        );

        this.updateUI();
    }
    destroy() {
        if (this.frontendContainer) this.frontendContainer.destroy();
        global.display.disconnect(this.focusEventId);
        Me.disconnect(this.loadedSignalId);
        this.tilingLayout.onDestroy();
        this.windows.forEach(window => {
            WindowUtils.setTitleBarVisibility(window,true);
        });
        this.destroyed = true;
    }
    isTopBarVisible() {
        return (
            !global.display.get_monitor_in_fullscreen(this.monitor.index) &&
            !Main.overview.visible
        );
    }

    addWindow(window) {
        if (this.windows.indexOf(window) >= 0) return;

        window.superWorkspace = this;
        window.connect('focus', () => {
        });
        WindowUtils.setTitleBarVisibility(window,false);
        const oldWindows = [...this.windows];
        this.windows.push(window);
        /*  // Focusing window if the window comes from a drag and drop
        // or if there's no focused window
        if (window.grabbed || !this.windowFocused) {
        } */
        this.onFocus(window);
        this.emitWindowsChangedDebounced(this.windows, oldWindows);
    }

    removeWindow(window) {
        let windowIndex = this.windows.indexOf(window);
        if (windowIndex === -1) return;

        const oldWindows = [...this.windows];

        this.windows.splice(windowIndex, 1);
        // If there's no more focused window on this workspace focus the last one
        if (window === this.windowFocused) {
            this.focusLastWindow();
        }
        this.emitWindowsChangedDebounced(this.windows, oldWindows);
    }

    swapWindows(firstWindow, secondWindow) {
        const firstIndex = this.windows.indexOf(firstWindow);
        const secondIndex = this.windows.indexOf(secondWindow);
        const oldWindows = [...this.windows];
        this.windows[firstIndex] = secondWindow;
        this.windows[secondIndex] = firstWindow;
        this.emitWindowsChanged(this.windows, oldWindows);
    }

    focusNext() {
        let windowFocusIndex = this.windows.indexOf(this.windowFocused);
        if (windowFocusIndex === this.windows.length - 1) {
            return;
        }
        this.windows[windowFocusIndex + 1].activate(global.get_current_time());
    }

    focusPrevious() {
        let windowFocusIndex = this.windows.indexOf(this.windowFocused);
        if (windowFocusIndex === 0) {
            return;
        }
        this.windows[windowFocusIndex - 1].activate(global.get_current_time());
    }

    onFocus(windowFocused) {
        if (windowFocused === this.windowFocused) {
            return;
        }
        const oldFocusedWindow = this.windowFocused;
        this.windowFocused = windowFocused;
        this.indexFocused = this.windows.indexOf(this.windowFocused);
        this.emit(
            'window-focused-changed',
            this.windowFocused,
            oldFocusedWindow
        );
    }

    setWindowBefore(windowToMove, windowRelative) {
        const oldWindows = [...this.windows];
        let windowToMoveIndex = this.windows.indexOf(windowToMove);
        this.windows.splice(windowToMoveIndex, 1);

        let windowRelativeIndex = this.windows.indexOf(windowRelative);
        this.windows.splice(windowRelativeIndex, 0, windowToMove);
        this.emitWindowsChanged(this.windows, oldWindows);
    }

    setWindowAfter(windowToMove, windowRelative) {
        const oldWindows = [...this.windows];
        let windowToMoveIndex = this.windows.indexOf(windowToMove);
        this.windows.splice(windowToMoveIndex, 1);

        let windowRelativeIndex = this.windows.indexOf(windowRelative);
        this.windows.splice(windowRelativeIndex + 1, 0, windowToMove);
        this.emitWindowsChanged(this.windows, oldWindows);
    }

    nextTiling(direction) {
        this.tilingLayout.onDestroy();
        const Layout = global.tilingManager.getNextLayout(
            this.tilingLayout,
            direction
        );
        this.tilingLayout = new Layout(this);
        Me.stateManager.setState(
            `${this.categoryKey}_${this.monitor.index}`,
            this.tilingLayout.constructor.key
        );

        this.tilingIcon.gicon = this.tilingLayout.icon;
        this.tilingLayout.onTile();
    }

    shouldPanelBeVisible() {
        let containFullscreenWindow = this.windows.some(metaWindow => {
            return metaWindow.is_fullscreen();
        });
        return (
            !containFullscreenWindow &&
            this.superWorkspaceManager &&
            !this.superWorkspaceManager.noUImode
        );
    }

    updateUI() {
        this.frontendContainer.visible = this.uiVisible;
        //update tiling icon
        this.tilingIcon = new St.Icon({
            gicon: this.tilingLayout.icon,
            style_class: 'system-status-icon'
        });
        this.tilingButton.set_child(this.tilingIcon);
    }

    emitWindowsChanged(newWindows, oldWindows, debouncedArgs) {
        // In case of direct call check if it has _debouncedArgs
        if (debouncedArgs) {
            // Get first debounced oldWindows
            const firstOldWindows = debouncedArgs[0][1];
            // And compare it with the new newWindows
            if (
                newWindows.length === firstOldWindows.length &&
                newWindows.every((window, i) => firstOldWindows[i] === window)
            ) {
                // If it's the same, the changes have compensated themselves
                // So in the end nothing happened:

                return;
            }
            oldWindows = firstOldWindows;
        }

        if (!this.destroyed) {
            // Make it async to prevent concurrent debounce calls
            if (debouncedArgs) {
                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    this.emit('windows-changed', newWindows, oldWindows);
                });
            } else {
                this.emit('windows-changed', newWindows, oldWindows);
            }
        }
    }

    setApps(apps) {
        this.apps = apps;
        this.categorizedAppCard._loadApps(apps);
    }

    isDisplayed() {
        if (this.monitor.index !== Main.layoutManager.primaryIndex) {
            return true;
        } else {
            return (
                this === this.superWorkspaceManager.getActiveSuperWorkspace()
            );
        }
    }

    focusLastWindow() {
        if (this.windows.length) {
            let lastWindow =
                this.windows[this.indexFocused] || this.windows.slice(-1)[0];

            this.onFocus(lastWindow);
        } else {
            this.onFocus(null);
        }
    }

    handleExtensionLoaded() {
        this.windows
            .map(metaWindow => metaWindow.get_compositor_private())
            .filter(window => window)
            .forEach(window => {
                this.isDisplayed() ? window.show() : window.hide();
            });

        this.focusLastWindow();
    }
};
Signals.addSignalMethods(SuperWorkspace.prototype);
