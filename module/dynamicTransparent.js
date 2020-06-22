const Meta = imports.gi.Meta;
const St = imports.gi.St;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const Compat = Me.imports.compat;
const handledWindowTypes = [
    Meta.WindowType.NORMAL,
    Meta.WindowType.DOCK,
    Meta.WindowType.DIALOG,
    Meta.WindowType.MODAL_DIALOG,
    Meta.WindowType.TOOLBAR,
    Meta.WindowType.MENU,
    Meta.WindowType.UTILITY,
    Meta.WindowType.SPLASHSCREEN
];
var DynamicTransparent = class DynamicTransparent {
    constructor() {
        //this._updateBounds();
        this._actorSignalIds = new Map();
        this._windowSignalIds = new Map();
        this.signals = [];
    }

    enable() {
        log('----------------');
        log('ENABLE DYNAMIC TRANSPARENT');
        log('----------------');
        Main.panel.set_style(null);
        this._actorSignalIds.set(Main.overview, [
            Main.overview.connect('showing', this._updateTransparent.bind(this)),
            Main.overview.connect('hiding', this._updateTransparent.bind(this))
        ]);
        /*        this._actorSignalIds.set(Main.sessionMode, [
                    Main.sessionMode.connect('updated', this._updateTransparent.bind(this))
                ]);*/
        /*this._actorSignalIds.set(global.window_group, [
             global.window_group.connect('actor-added', this._onWindowActorAdded.bind(this)),
             global.window_group.connect('actor-removed', this._onWindowActorRemoved.bind(this))
         ]);*/
        const windows = global.get_window_actors().filter(windowActor => {
            return windowActor.metaWindow.get_window_type() !== Meta.WindowType.DESKTOP && windowActor.metaWindow.get_window_type() === 0;
        });
        windows.forEach(function(win) {
            this._addWindowSignals(win.get_meta_window());
        }, this);
        this.signals.push({
            from: global.display,
            id: global.display.connect('window-created', (_, metaWindow) => {
                this._addWindowSignals(metaWindow);
            }),
        });
        this._actorSignalIds.set(global.window_manager, [
            global.window_manager.connect('switch-workspace', this._updateTransparent.bind(this))
        ]);
        this._updateTransparent();
    }
    disable() {
        const windows = global.get_window_actors().filter(windowActor => {
            return windowActor.metaWindow.get_window_type() !== Meta.WindowType.DESKTOP && windowActor.metaWindow.get_window_type() === 0;
        });
        windows.forEach(function(win) {
            this._removeWindowSignals(win.get_meta_window());
        }, this);
        this.signals.forEach((signal) => {
            signal.from.disconnect(signal.id);
        });
        this.signals = [];
        for (const actorSignalIds of [this._actorSignalIds, this._windowSignalIds]) {
            for (const [actor, signalIds] of actorSignalIds) {
                for (const signalId of signalIds) {
                    if (signalId)
                        actor.disconnect(signalId);
                }
            }
        }
        Main.panel.remove_style_class_name('transparent-top-bar--solid');
        Main.panel.remove_style_class_name('transparent-top-bar--transparent');
        Main.panel.set_style(null);
    }
    _onWindowActorAdded(container, metaWindowActor) {
        this._windowSignalIds.set(metaWindowActor, [
            //metaWindowActor.connect('allocation-changed', this._updateTransparent.bind(this)),
            //metaWindowActor.connect('notify::visible', this._updateTransparent.bind(this)),
            metaWindowActor.connect('focus', this._updateTransparent.bind(this)),
            metaWindowActor.connect('size-changed', this._updateTransparent.bind(this))
        ]);
    }
    _onWindowActorRemoved(container, metaWindowActor) {
        for (const signalId of this._windowSignalIds.get(metaWindowActor)) {
            metaWindowActor.disconnect(signalId);
        }
        this._windowSignalIds.delete(metaWindowActor);
        this._updateTransparent();

    }
    _addWindowSignals(meta_win) {
        if (!meta_win || !this._handledWindow(meta_win))
            return;
        if (meta_win.title === "") {
            return;
        }
        //meta_win.dtd_onPositionChanged = meta_win.connect('position-changed', this._updateTransparent.bind(this));
        meta_win.dtd_onSizeChanged = meta_win.connect('size-changed', this._windowsEvent.bind(this));
        meta_win.dtd_onMinimize = meta_win.connect('notify::minimized', this._windowsEvent.bind(this));
        meta_win.dtd_onFocus = meta_win.connect('focus', this._updateTransparent.bind(this));
    }

    _removeWindowSignals(meta_win) {
        if (meta_win && meta_win.dtd_onSizeChanged) {
            meta_win.disconnect(meta_win.dtd_onSizeChanged);
            delete meta_win.dtd_onSizeChanged;
        }
        if (meta_win && meta_win.dtd_onMinimize) {
            meta_win.disconnect(meta_win.dtd_onMinimize);
            delete meta_win.dtd_onMinimize;
        }
        if (meta_win && meta_win.dtd_onFocus) {
            meta_win.disconnect(meta_win.dtd_onFocus);
            delete meta_win.dtd_onVisible;
        }
    }
    _windowsEvent(meta_win) {
        log("meta_win.maximized_verticallymeta_win.maximized_vertically" + meta_win.maximized_vertically);
        if (meta_win.maximized_vertically) {
            this._setTransparent( !meta_win.maximized_vertically);
        }
        else {
            this._setTransparent( !meta_win.maximized_vertically);
        }
    }
    _updateTransparent() {

        if (Main.panel.has_style_pseudo_class('overview') || !Main.sessionMode.hasWindows) {
            this._setTransparent(true);
            return;
        }

        if (!Main.layoutManager.primaryMonitor) {
            return;
        }

        // Get all the windows in the active workspace that are in the primary monitor and visible.
        const workspaceManager = global.workspace_manager;
        const activeWorkspace = workspaceManager.get_active_workspace();
        const windows = activeWorkspace.list_windows().filter(metaWindow => {
            return metaWindow.is_on_primary_monitor()
                && metaWindow.showing_on_its_workspace()
                && !metaWindow.is_hidden()
                && metaWindow.get_window_type() !== Meta.WindowType.DESKTOP
                && metaWindow.get_window_type() === 0
        });
        for (let i = windows.length - 1; i >= 0; i--) {
            let current_window = windows[i];
            if (!current_window.showing_on_its_workspace() || !current_window.is_on_primary_monitor()) {
                continue;
            }
            /* Make sure the window is on the correct monitor, isn't minimized, isn't supposed to be excluded, and is actually maximized. */
            if (!is_valid(current_window)) {
                continue;
            }
            if (current_window.maximized_vertically) {
                /* Make sure the top-most window is selected */
                this._setTransparent(false);
                return;
            }
            /*
            let frame = current_window.get_frame_rect();

            if (Main.layoutManager._rightPanelBarrier) {
                let overlap = this.panel_bounds.x < frame.x + frame.width &&
                    this.panel_bounds.x + this.panel_bounds.width > frame.x &&
                    this.panel_bounds.y < frame.y + frame.height &&
                    this.panel_bounds.height + this.panel_bounds.y > frame.y;

                if (overlap) {
                    add_transparency = true;
                    maximized_window = null;
                }
            }*/
        }

        // Check if at least one window is near enough to the panel.
        /*        const panelTop = Main.panel.get_transformed_position()[1];
                const panelBottom = panelTop + Main.panel.get_height();
                const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
                const isNearEnough = windows.some(metaWindow => {
                    const verticalPosition = metaWindow.get_frame_rect().y;
                    return verticalPosition < panelBottom + 5 * scale;
                });*/
        this._setTransparent(true);
        return;

    }
    _setTransparent(transparent) {
        if (transparent) {
            Main.panel.set_style('background-color: rgba(0, 0, 0, 0.07);');
        } else {
            Main.panel.set_style(null);
        }
    }
    // Filter windows by type
    // inspired by Opacify@gnome-shell.localdomain.pl
    _handledWindow(metaWindow) {
        // The DropDownTerminal extension uses the POPUP_MENU window type hint
        // so we match its window by wm class instead
        if (metaWindow.get_wm_class() == 'DropDownTerminalWindow')
            return true;

        let wtype = metaWindow.get_window_type();
        for (let i = 0; i < handledWindowTypes.length; i++) {
            var hwtype = handledWindowTypes[i];
            if (hwtype == wtype) {
                return true;
            } else if (hwtype > wtype) {
                return false;
            }
        }
        return false;
    }

    _updateBounds() {
        const panel = Compat.getActorOf(Main.panel);

        this.panel_bounds = {
            x: panel.get_x(),
            y: panel.get_y(),
            height: panel.get_height(),
            width: panel.get_width(),
            is_top: true
        };

        this.scale_factor = St.ThemeContext.get_for_stage(global.stage).scale_factor;

        let pivot_y = -Main.layoutManager.panelBox.get_pivot_point()[1];

        // Adjust for bottom panel.
        if (pivot_y > 0) {
            this.panel_bounds.y = pivot_y;
            this.panel_bounds.is_top = false;
        }
    }

}

function is_valid(window) {
    if (!Meta) {
        Meta = imports.gi.Meta;
    }

    let windowTypes = [
        Meta.WindowType.NORMAL,
        Meta.WindowType.DIALOG,
        Meta.WindowType.MODAL_DIALOG,
        Meta.WindowType.TOOLBAR,
        Meta.WindowType.MENU,
        Meta.WindowType.UTILITY,
    ];

    let type = window.get_window_type();

    return (windowTypes.indexOf(type) !== -1);
}