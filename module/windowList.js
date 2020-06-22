/*
	Windows List
	Copyright fthx 2020
	Copyright Ubuntuvn respin 2020
	License GPL v3
*/
const AppDisplay = imports.ui.appDisplay;
const AppFavorites = imports.ui.appFavorites;
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const Util = imports.misc.util;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const Clutter = imports.gi.Clutter;
const AppMenu = Main.panel.statusArea.appMenu;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const ThumbnailsSlider = imports.ui.overviewControls.ThumbnailsSlider.prototype;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Lib = Me.imports.lib;
const schemaDesktop = 'org.gnome.desktop.interface';
// translation needed to restore Places Menu label when disable extension
const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;
const N_ = x => x;
// opacity of inactive or hidden windows (0=min, 255=max)
var HIDDEN_OPACITY = 127;
const LEFTBUTTON = 1;
const MIDDLEBUTTON = 2;
const RIGHTBUTTON = 3;
var WindowList = new Lang.Class({
    Name: 'WindowList.WindowList',
    preview: null,
    previewTimer2: null,
    previewTimer: null,
    // create the task bar container and signals
    _init: function () {
        log('----------------');
        log('INIT TASKLIST');
        log('----------------');
        this.apps_menu = null;
        let settingDesktop = new Lib.Settings(schemaDesktop);
        this.settingsDesktop = settingDesktop.getSettings();
        this.panelSize = Me.settings.get_int('panel-size');
        this.installedDock = [
            {
                uuid: 'ubuntu-dock@ubuntu.com',
                disable: extension => {
                    if (extension.stateObj) extension.stateObj.disable();
                },
                enable: extension => {
                    if (extension.stateObj) extension.stateObj.enable();
                }

            },
            {
                //dash-to-dock@micxgx.gmail.com
                uuid: 'dash-to-dock@micxgx.gmail.com',
                disable: extension => {
                    if (extension.stateObj) extension.stateObj.disable();
                },
                enable: extension => {
                    if (extension.stateObj) extension.stateObj.enable();
                }
            }
        ];

    },

    enable: function () {
        this.initThumbFunctionsZoom = ThumbnailsSlider._getAlwaysZoomOut;
        this.initThumbFunctionsSlider = ThumbnailsSlider.getNonExpandedWidth;
        //show desktop
        this._showDesktopButton = new St.Bin({
            style_class: 'showdesktop-button',
            reactive: true,
            can_focus: true,
            x_fill: true,
            y_fill: true,
            track_hover: true
        });
        let sytle = 'border-left-width:1px;width: 5px';
        this._showDesktopButton.set_style(sytle);
        this._showDesktopButton.connect("button-press-event", Lang.bind(this, this.onClickDesktopButton));
        this.apps_menu = null;
        Main.panel._rightBox.insert_child_at_index(this._showDesktopButton, Main.panel._rightBox.get_children().length);
        //disable activities
        let activities_indicator = Main.panel.statusArea['activities'];
        if (activities_indicator) {
            activities_indicator.container.hide();
        }
        AppMenu._iconBox.hide();
        this.apps_menu = new St.BoxLayout({});
        this.taskList = true;
        //Reinit Extension on Param Change
        this.setSignals();
        // change Places label to folder icon
        if (this.taskList) {
            let places_menu_indicator = Main.panel.statusArea['places-menu'];
            if (places_menu_indicator) {
                places_menu_indicator.remove_child(places_menu_indicator.get_first_child());
                let places_menu_box = new St.BoxLayout({style_class: 'panel-status-menu-box'});
                let places_menu_icon = new St.Icon({icon_name: 'folder-symbolic', style_class: 'system-status-icon'});
                places_menu_box.add_child(places_menu_icon);
                places_menu_box.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));
                places_menu_indicator.add_actor(places_menu_box);
            }
            this._showUpdateMenu = Main.overview.connect('showing', Lang.bind(this, this._updateMenu));
            this._showResetPreview = Main.overview.connect('showing', Lang.bind(this, this.resetPreview));
            this._hideUpdateMenu = Main.overview.connect('hiding', Lang.bind(this, this._updateMenu));
            this._eventOver = Main.overview.connect('showing', Lang.bind(this, this._eventOverview));
            this._hideResetPreview = Main.overview.connect('hiding', Lang.bind(this, this.resetPreview));
            this._restacked = global.display.connect('restacked', Lang.bind(this, this._updateMenu));
            this._window_change_monitor = global.display.connect('window-left-monitor', Lang.bind(this, this._updateMenu));
            this._workspace_changed = global.workspace_manager.connect('active-workspace-changed', Lang.bind(this, this._updateMenu));
            this._workspace_number_changed = global.workspace_manager.connect('notify::n-workspaces', Lang.bind(this, this._updateMenu));
            let position = 1;
            if ('places-menu' in Main.panel.statusArea)
                position++;
            Main.panel._leftBox.insert_child_at_index(this.apps_menu, position);
            Main.panel.connect('scroll-event', (actor, event) => this._scrollWorkspace(actor, event));
        }
        this.initDisplayApplicationMenu();
        this.initDisplayDateMenu();
        this.initDisplayWorkspaceSelector();
        this.displaySystemMenu();
        this.changPanelSize();

    },

    // destroy the task bar
    disable: function () {
        // disconnect all signals
        Main.overview.disconnect(this._eventOver);
        Main.overview.disconnect(this._showResetPreview);
        Main.overview.disconnect(this._showUpdateMenu);
        Main.overview.disconnect(this._hideUpdateMenu);
        Main.overview.disconnect(this._hideResetPreview);
        global.display.disconnect(this._restacked);
        global.display.disconnect(this._window_change_monitor);
        global.workspace_manager.disconnect(this._workspace_changed);
        global.workspace_manager.disconnect(this._workspace_number_changed);
        // destroy task bar container
        delete this.initThumbFunctionsZoom;
        delete this.initThumbFunctionsSlider;
        this.apps_menu.destroy();
        this.taskList = false;
        Main.panel._rightBox.remove_child(this._showDesktopButton);
        this._showDesktopButton.destroy();
        // restore default AppMenu label
        AppMenu._iconBox.show();
        // display Places label instead of icon
        let places_menu_indicator = Main.panel.statusArea['places-menu'];
        if (places_menu_indicator) {
            places_menu_indicator.remove_child(places_menu_indicator.get_first_child());
            let places_menu_box = new St.BoxLayout({style_class: 'panel-status-menu-box'});
            let places_menu_label = new St.Label({
                text: _('Places'),
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
            });
            places_menu_box.add_child(places_menu_label);
            places_menu_box.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));
            places_menu_indicator.add_actor(places_menu_box);
        }
        // display Activities label ; take care of locked session to not display Activities label on it
        let activities_indicator = Main.panel.statusArea['activities'];
        if (activities_indicator && !Main.sessionMode.isLocked) {
            activities_indicator.container.show();
        }

    },
    _updateMenu: function () {
        //init dash
        this.initDisplayDash();
        // destroy old task bar
        this.apps_menu.destroy_all_children();
        let iconStyle = "margin-right: " + Me.settings.get_int("tasks-spaces") + "px";
        if (this.taskList) {
            //Init the favorite list
            let favoriteList = [];
            if (Me.settings.get_boolean("display-favorites") || Main.overview._shown) {
                let favorites = global.settings.get_strv(AppFavorites.getAppFavorites().FAVORITE_APPS_KEY);
                for (let i = 0; i < favorites.length; ++i) {
                    let favoriteapp = Shell.AppSystem.get_default().lookup_app(favorites[i]);
                    if (favoriteapp === null) {
                        continue;
                    }
                    let box = new St.Bin({
                        visible: true,
                        reactive: true, can_focus: true, track_hover: true
                    });
                    box.app = favoriteapp;
                    box.icon = favoriteapp.create_icon_texture(this.panelSize - 3);
                    box.connect("button-press-event", Lang.bind(this, this.onClickFavoriteButton, favoriteapp));
                    box.connect('scroll-event', (actor, event) => this._scrollWindows(actor, event));
                    //box.icon.set_opacity(FAVORITE_OPACITY);
                    box.style_class = 'favorite-app';
                    box.set_style(iconStyle);
                    box.set_child(box.icon);
                    favoriteList.push(box);
                }
            }
            // track windows and get the number of workspaces
            this.tracker = Shell.WindowTracker.get_default();
            this.workspaces_count = global.workspace_manager.get_n_workspaces();
            this.buttonPadding = "padding-right:"+ Me.settings.get_int("tasks-spaces") + "px;";
            //init overview button
            if (!this.settingsDesktop.get_boolean("enable-hot-corners")) {
                this.overButton = new St.Button();
                this.overButton.child = new St.Icon({icon_name: 'cs-overview'});
                this.overButton.connect('clicked', () => this._activateWorkspace(global.workspace_manager.get_active_workspace()));
                this.overButton.connect('scroll-event', (actor, event) => this._scrollWorkspace(actor, event));
                this.appOverviewStyle = "margin: 1px; height:" + this.appOverviewHeight + "px; width: " + this.appOverviewHeight + "px; padding-right:" + Me.settings.get_int("tasks-spaces") + "px;";
                this.overButton.set_style(this.appOverviewStyle);
                this.buttonPadding = "";
            }
            // add Show app button
            this.appOverviewHeight = this.panelSize - 6;
            this.appButtonStyle = "margin: 1px; height:" + this.panelSize + "px; width: " + this.panelSize + "px; " + this.buttonPadding;
            this.iconPath = Me.settings.get_string("appview-button-icon");
            if (this.iconPath === 'unset')
                this.iconPath = Me.path + '/images/logo.png';
            this.showAppsIcon = Gio.icon_new_for_string(this.iconPath);
            this.appButton = new St.Button();
            this.appButton.child = new St.Icon({
                gicon: this.showAppsIcon,
            });
            this.appButton.connect('clicked', () => this._changePage(true));
            this.appButton.connect('scroll-event', (actor, event) => this._scrollWorkspace(actor, event));
            this.appButton.set_style(this.appButtonStyle);
            this.apps_menu.add_actor(this.appButton);
            if (!this.settingsDesktop.get_boolean("enable-hot-corners")) {
                this.apps_menu.add_actor(this.overButton);
            }
            // do this for all existing workspaces
            for (let workspace_index = 0; workspace_index < this.workspaces_count; ++workspace_index) {
                let appList = favoriteList.slice();
                let metaWorkspace = global.workspace_manager.get_workspace_by_index(workspace_index);
                this.windows = metaWorkspace.list_windows().sort(this._sortWindows);
                if (global.workspace_manager.get_active_workspace() === metaWorkspace) {
                    this.windows = this.windows.filter(
                        function (w) {
                            return !w.is_skip_taskbar() && !w.is_on_all_workspaces();
                        }
                    );
                    // create all normal windows icons and buttons
                    if (Me.settings.get_boolean("display-tasks")) {
                        for (let i = 0; i < this.windows.length; ++i) {
                            let metaWindow = this.windows[i];
                            let box = null;
                            let buttonTaskLayout = null;
                            if (Me.settings.get_enum("tasks-label") !== 0) {
                                box = new St.Button({
                                    style_class: "tkb-task-button",

                                    x_align: St.Align.START
                                });
                            } else {
                                box = new St.Bin({
                                    visible: true,
                                    reactive: true, can_focus: true, track_hover: true
                                });
                            }
                            box.button = this;
                            box.window = this.windows[i];
                            //this.setIconGeometry(this,box.window);
                            //box.window.connect("notify::title", this._updateTitle);
                            box.tooltip = box.window.get_title();
                            box.app = this.tracker.get_window_app(box.window);
                            box.icon = box.app.create_icon_texture(this.panelSize - 4);
                            if (metaWindow.is_hidden()) {
                                box.icon.set_opacity(HIDDEN_OPACITY);
                                box.style_class = 'hidden-app';
                            } else {
                                if (metaWindow.has_focus()) {
                                    this.backgroundColor = Me.settings.get_string("active-task-background-color");
                                    if (Me.settings.get_boolean("active-task-background-color-set"))
                                        this.backgroundStyleColor = "background-color: " + this.backgroundColor + "; ";
                                    box.style_class = 'focused-app';
                                    box.set_style(this.backgroundStyleColor);
                                } else {
                                    if (Me.settings.get_enum("tasks-label") === 0) {
                                        box.style_class = 'unfocused-app';
                                    }
                                }
                            }
                            if (Me.settings.get_enum("tasks-label") !== 0) {
                                buttonTaskLayout = new St.BoxLayout({
                                    style_class: "tkb-task-button"
                                });
                                buttonTaskLayout.add_actor(box.icon);
                                if (Me.settings.get_enum("tasks-label") === 1) {
                                    labelTask = new St.Label({
                                        text: (" " + box.window.get_title() + " ")
                                    });
                                } else {
                                    labelTask = new St.Label({
                                        text: (" " + box.app.get_name() + " ")
                                    });
                                }
                                buttonTaskLayout.add_actor(labelTask);
                                labelTask.set_style('font-size: ' + (this.panelSize - 13) + 'px; padding-top: ' + ((this.panelSize - 7 - (this.panelSize - 7)) / 2 + 4) + 'px;');
                                this.tasksWidth = Me.settings.get_int("tasks-width");
                                box.set_width(this.tasksWidth);
                                box.set_child(buttonTaskLayout)
                            } else {
                                if (box.get_style() !== null) {
                                    box.set_style(box.get_style() + iconStyle);
                                } else {
                                    box.set_style(iconStyle);
                                }
                                box.set_child(box.icon);

                            }
                            box.connect("button-press-event", Lang.bind(this, this.onClickTaskButton, metaWindow));
                            box.connect("enter-event", Lang.bind(this, this.showPreview, box.window));
                            box.connect("leave-event", Lang.bind(this, this.resetPreview, box.window));
                            box.connect('scroll-event', (actor, event) => this._scrollWindows(actor, event));
                            let objIndex = appList.findIndex((boxF => (boxF.app.get_name() == box.app.get_name() && !boxF.instancePanel)));
                            if (objIndex > -1) {
                                box.instancePanel = true;
                                appList[objIndex] = box;
                            } else {
                                box.instancePanel = true;
                                appList.push(box);
                            }
                        }
                    }

                    //add app to panel
                    for (let j = 0; j < appList.length; ++j) {
                        this.apps_menu.add_actor(appList[j]);
                    }

                }
            }
        }
    },
    //Event overview
    _eventOverview() {
        const windows = global.get_window_actors().filter(windowActor => {
            return windowActor.metaWindow.get_window_type() !== Meta.WindowType.DESKTOP && windowActor.metaWindow.get_window_type() === 0;
        });
        if (windows.length === 0) {
            Main.overview.viewSelector._showAppsButton.checked = true;
        }
    },
    //Show apps
    _changePage(appsButtonChecked) {
        // selecting the same view again will hide the overview
        if (Main.overview._shown && appsButtonChecked == Main.overview.viewSelector._showAppsButton.checked) {
            Main.overview.hide();
            return;
        }
        Main.overview.viewSelector._showAppsButton.checked = appsButtonChecked;
        if (!Main.overview._shown)
            Main.overview.show();
    },
    // windows list sort function by reverse window id
    _sortWindows: function (w1, w2) {
        return w1.get_id() - w2.get_id();
    },

    // displays the focused window title
    _updateTitle: function () {
        if (global.display.get_focus_window()) {
            AppMenu._label.set_text(global.display.get_focus_window().get_title());
        }
        ;
    },

    // hover on app icon button b shows its window title tt
    _onHover: function (b, tt) {
        if (b.hover) {
            AppMenu._label.set_text(tt);
        } else {
            this._updateTitle();
        }
        ;
    },

    // activate workspace ws
    _activateWorkspace: function (ws) {
        if (global.workspace_manager.get_active_workspace() === ws) {
            Main.overview.toggle();
        } else {
            Main.overview.show();
        }
        ;
        ws.activate(global.get_current_time());
    },

    // switch to workspace ws and activate window w
    _activateWindow: function (w) {
        if (w.has_focus()
            && !(Main.overview.visible)) {
            w.minimize();
        } else {
            //w.unminimize();
            //w.unshade(global.get_current_time());
            w.activate(global.get_current_time());
        }
        ;
        Main.overview.hide();

    },
    setSignals: function () {
        //Reinit Extension on Param Change
        this.settingSignals = [
            Me.settings.connect("changed::tasks-spaces", Lang.bind(this, this.changPanelSize)),
            Me.settings.connect("changed::display-tasks", Lang.bind(this, this.changPanelSize)),
            Me.settings.connect("changed::display-favorites", Lang.bind(this, this.changPanelSize)),
            Me.settings.connect("changed::enable-hot-corners", Lang.bind(this, this.changPanelSize)),
            Me.settings.connect("changed::panel-size", Lang.bind(this, this.changPanelSize)),
            Me.settings.connect("changed::active-task-background-color", Lang.bind(this, this.changPanelSize)),
            Me.settings.connect("changed::active-task-background-color-set", Lang.bind(this, this.changPanelSize)),
            Me.settings.connect("changed::tasks-label", Lang.bind(this, this.changPanelSize)),
            Me.settings.connect("changed::tasks-label-color", Lang.bind(this, this.changPanelSize)),
            Me.settings.connect("changed::display-tasks-label-color", Lang.bind(this, this.changPanelSize)),
            Me.settings.connect("changed::inactive-tasks-label-color", Lang.bind(this, this.changPanelSize)),
            Me.settings.connect("changed::display-inactive-tasks-label-color", Lang.bind(this, this.changPanelSize)),
            Me.settings.connect("changed::display-tasks", Lang.bind(this, this.changPanelSize)),
            Me.settings.connect("changed::application-menu", Lang.bind(this, this.initDisplayApplicationMenu)),
            Me.settings.connect("changed::workspace-selector", Lang.bind(this, this.initDisplayWorkspaceSelector)),
            Me.settings.connect("changed::date-menu", Lang.bind(this, this.displayDateMenu)),
            Me.settings.connect("changed::system-menu", Lang.bind(this, this.displaySystemMenu)),
            Me.settings.connect("changed::dash", Lang.bind(this, this.initDisplayDash)),
            Me.settings.connect("changed::bottom-panel", Lang.bind(this, this.changPanelSize)),
            Me.settings.connect("changed::dock-enable", Lang.bind(this, this.changPanelSize)),
            Me.settings.connect("changed::export-settings", Lang.bind(this, this.exportSettings)),
            Me.settings.connect("changed::import-settings", Lang.bind(this, this.importSettings)),
            Me.settings.connect("changed::reset-all", Lang.bind(this, this.resetAll)),
            Me.settings.connect("changed::reset-flag", Lang.bind(this, this.onParamChanged))
        ];
    },
    onParamChanged: function () {
        this.disable();
        this.enable();
    },
    //Align Position
    onPositionChanged: function () {
        if (Me.settings.get_boolean("bottom-panel")) {
            this.hideDock();
            global.UbuntuvnDesktop._toBottom();
        } else {
            global.UbuntuvnDesktop._toTop();
            if (Me.settings.get_boolean("dock-enable")) {
                //dockenable
                this.showDock();
                this.taskList = false;
            } else {
                this.hideDock();
                this.taskList = true;
            }
        }
    },
    showDock: function () {
        for (let willDisableExtension of this.installedDock) {
            let extension = Main.extensionManager.lookup(willDisableExtension.uuid);
            if (extension) {
                Util.spawnCommandLine('gnome-extensions enable ' + willDisableExtension.uuid);
                //willDisableExtension.enable(extension);
            }
        }
    },
    hideDock: function () {
        for (let willDisableExtension of this.installedDock) {
            let extension = Main.extensionManager.lookup(willDisableExtension.uuid);
            if (extension) {
                willDisableExtension.disable(extension);
                Util.spawnCommandLine('gnome-extensions disable ' + willDisableExtension.uuid);

            }
        }
    },
    resetAll: function () {
        if (Me.settings.get_boolean("reset-all")) {
            Util.spawnCommandLine('dconf reset -f /org/gnome/shell/extensions/ubuntuvn-desktop/');
        }
    },
    onClickTaskButton: function (button, pspec, window) {
        this.resetPreview(button, window)
        let numButton = pspec.get_button();
        let buttonAction = 0;
        if (numButton === LEFTBUTTON)
            buttonAction = Me.settings.get_enum("tasks-left-click");
        else if (numButton === MIDDLEBUTTON)
            buttonAction = Me.settings.get_enum("tasks-middle-click");
        else if (numButton === RIGHTBUTTON)
            buttonAction = Me.settings.get_enum("tasks-right-click");
        let app = Shell.WindowTracker.get_default().get_window_app(window);
        switch (buttonAction) {
            case 0: //Action === 'none'
                return;
            case 1: //Action === 'minmax'
                this._activateWindow(window);
                break;
            case 2: //Action === 'openmenu'
                this.clickActionOpenMenu(button);
                break;
            case 3: //Action === 'close'
                window.delete(global.get_current_time());
                break;
            case 4: //Action === 'new_instance'
                app.open_new_window(-1);
                break;
            default: //Same as 'none'
                return;
        }
    },
    onClickFavoriteButton: function (button, pspec, app) {
        button.icon.set_opacity(HIDDEN_OPACITY);
        let numButton = pspec.get_button();
        let buttonAction = 0;

        if (numButton === LEFTBUTTON)
            buttonAction = Me.settings.get_enum("tasks-left-click");
        else if (numButton === MIDDLEBUTTON)
            buttonAction = Me.settings.get_enum("tasks-middle-click");
        else if (numButton === RIGHTBUTTON)
            buttonAction = Me.settings.get_enum("tasks-right-click");
        switch (buttonAction) {
            case 0: //Action === 'none'
                return;
            case 1: //Action === 'minmax'
                if (Main.overview.viewSelector._showAppsButton.checked) {
                    Main.overview.hide();
                }
                app.open_new_window(-1);
                break;
            case 2: //Action === 'openmenu'
                this.clickActionOpenMenu(button);
                break;
            case 4: //Action === 'new_instance'
                app.open_new_window(-1);
                break;
            default: //Same as 'none'
                return;
        }
    },
    clickActionOpenMenu: function (button) {
        this.hidePreview();
        this.taskMenu = null;
        let taskMenuManager = new PopupMenu.PopupMenuManager(button);
        button.animateLaunch = function () {

        }
        this.manu = new MyAppIconMenu(button);
        taskMenuManager.addMenu(this.manu);
        Main.uiGroup.add_actor(this.manu.actor);
        this.taskMenuUp = true;
        taskMenuManager.ignoreRelease();
        this.manu.popup();
    },
    initDisplayApplicationMenu: function () {
        this.appMenuContainer = Main.panel.statusArea.appMenu.container;
        if (!Me.settings.get_boolean("application-menu")) {
            this.appMenuContainer.hide();
            this.hidingId = Main.overview.connect('hiding', function () {
                Main.panel.statusArea.appMenu.container.hide();
            });
            this.hidingId2 = Shell.WindowTracker.get_default().connect('notify::focus-app', function () {
                Main.panel.statusArea.appMenu.container.hide();
            });
        } else {
            this.appMenuContainer.show();
        }
    },
    initDisplayWorkspaceSelector: function () {

        if (!Me.settings.get_boolean("workspace-selector")) {

            ThumbnailsSlider._getAlwaysZoomOut = function () {
                return false;
            }
            ThumbnailsSlider.getNonExpandedWidth = function () {
                return 0;
            }
        }
        else {
            ThumbnailsSlider._getAlwaysZoomOut = this.initThumbFunctionsZoom;
            //ThumbnailsSlider.getNonExpandedWidth =  this.initThumbFunctionsSlider
            ThumbnailsSlider.getNonExpandedWidth = function () {
                return 5;
            }

        }
    },
    //Date Menu
    displayDateMenu: function () {
        this.initDisplayDateMenu();
        if (Me.settings.get_boolean("date-menu"))
            this.dateMenuContainer.show();
    },

    initDisplayDateMenu: function () {
        this.dateMenuContainer = Main.panel.statusArea.dateMenu.container;
        if (!Me.settings.get_boolean("date-menu")) {
            this.dateMenuContainer.hide();
        }
        this.dateMenuColor = Me.settings.get_string("date-menu-color");
        if (this.dateMenuColor !== "unset")
            this.colorDateMenu();
    },
    //System Menu
    displaySystemMenu: function () {
        this.initDisplaySystemMenu();
        if (Me.settings.get_boolean("system-menu"))
            this.systemMenuContainer.show();
    },

    initDisplaySystemMenu: function () {
        this.systemMenuContainer = Main.panel.statusArea.aggregateMenu.container;
        if (!Me.settings.get_boolean("system-menu")) {
            this.systemMenuContainer.hide();
        }
        this.systemMenuColor = Me.settings.get_string("system-menu-color");
        if (this.systemMenuColor !== "unset")
            this.colorSystemMenu();
    },
    //Application Menu
    displayApplicationMenu: function () {
        this.initDisplayApplicationMenu();
        if (Me.settings.get_boolean("application-menu")) {
            let variant = GLib.Variant.new('a{sv}', {
                'Gtk/ShellShowsAppMenu': GLib.Variant.new('i', 1)
            });
            let xsettings = new Gio.Settings({
                schema: 'org.gnome.settings-daemon.plugins.xsettings'
            });
            xsettings.set_value('overrides', variant);
            this.appMenuContainer.show();
            Shell.WindowTracker.get_default().disconnect(this.hidingId2);
            Main.overview.disconnect(this.hidingId);
        }
    },
    //Dash
    displayDash: function () {
        this.initDisplayDash();
        if (Me.settings.get_boolean("dash")) {
            Main.overview.dash.show();
        }
    },
    initDisplayDash: function () {
        if (!Me.settings.get_boolean("dash") && !Me.settings.get_boolean("dock-enable")) {
            Main.overview.dash.hide();
        }
    },
    //Export Settings
    exportSettings: function () {
        if (Me.settings.get_boolean("export-settings")) {
            Util.spawnCommandLine('sh ' + Me.path + '/scripts/export.sh');
            Me.settings.set_boolean("export-settings", false);
        }
    },

    //Import Settings
    importSettings: function () {
        if (Me.settings.get_boolean("import-settings")) {
            Util.spawnCommandLine('sh ' + Me.path + '/scripts/import.sh');
            Me.settings.set_boolean("import-settings", false);
        }
    },
    onClickDesktopButton: function (button, pspec) {
        this.lastFocusedWindowUserTime = null;
        let maxWindows = false;
        let userTime = null;
        let activeWorkspace = global.workspace_manager.get_active_workspace();
        let windows = activeWorkspace.list_windows().filter(function (w) {
            return w.get_window_type() !== Meta.WindowType.DESKTOP;
        });
        let numButton = pspec.get_button();
        if (numButton === LEFTBUTTON) //Left Button
        {
            for (let i = 0; i < windows.length; ++i) {
                if ((this.desktopView) && (!Main.overview.visible)) {
                    userTime = windows[i].user_time;
                    if (userTime > this.lastFocusedWindowUserTime) {
                        this.lastFocusedWindowUserTime = userTime;
                        this.lastFocusedWindow = windows[i];
                    }
                    windows[i].unminimize();
                    maxWindows = true;
                } else {
                    windows[i].minimize();
                }
            }
            if (maxWindows) {
                this.lastFocusedWindow.activate(global.get_current_time());
            }
            this.desktopView = !this.desktopView;
            if (Main.overview.visible)
                Main.overview.hide();
        }
    },
    changPanelSize: function () {
        this.panelSize = Me.settings.get_int('panel-size');
        Main.panel.set_height(this.panelSize);
        this.onPositionChanged();
        this._updateMenu();


    },
    //Preview
    getThumbnail: function (window, size) {
        let thumbnail = null;
        let mutterWindow = window.get_compositor_private();
        if (mutterWindow) {
            let windowTexture = mutterWindow.get_texture();
            let width, height;
            if (windowTexture.get_size) {
                [width, height] = windowTexture.get_size();
            } else {
                let preferred_size_ok;
                [preferred_size_ok, width, height] = windowTexture.get_preferred_size();
            }
            let scale = Math.min(1.0, size / width, size / height);
            thumbnail = new Clutter.Clone({
                source: mutterWindow,
                reactive: true,
                width: width * scale,
                height: height * scale
            });
        }
        return thumbnail;
    },
    showPreview: function (button, pspec, window) {

        //Switch Task on Hover
        this.resetHover = false;
        if (Me.settings.get_boolean("hover-switch-task")) {
            if (Me.settings.get_int("hover-delay") === 0)
                this.onClickTaskButton(button, window);
            else
                this.previewTimer2 = Mainloop.timeout_add(Me.settings.get_int("hover-delay"),
                    Lang.bind(this, this.onClickTaskButton, button, window));
        }
        //Hide current preview if necessary
        this.hidePreview();
        this.grouped = false;
        if ((Me.settings.get_enum("display-label") !== 0) || (Me.settings.get_boolean("display-thumbnail"))) {
            if (Me.settings.get_int("preview-delay") === 0)
                this.showPreview2(button, window);
            else
                this.previewTimer = Mainloop.timeout_add(Me.settings.get_int("preview-delay"),
                    Lang.bind(this, this.showPreview2, button, window));
        }
    },
    showPreview2: function (button, window) {
        //Hide current preview if necessary

        this.hidePreview();
        let app = Shell.WindowTracker.get_default().get_window_app(window);
        this.previewFontSize = Me.settings.get_int("preview-font-size");
        this.preview = new St.BoxLayout({
            vertical: true
        });
        if (Me.settings.get_enum("display-label") !== 0) {
            if (Me.settings.get_enum("display-label") !== 2) {
                let labelNamePreview;
                if (this.grouped) {
                    labelNamePreview = new St.Label({
                        text: ' ' + app.get_name() + ' (Group) '
                    });
                } else {
                    labelNamePreview = new St.Label({
                        text: ' ' + app.get_name() + ' '
                    });
                }
                if ((Me.settings.get_string("preview-label-color") !== 'unset') && (Me.settings.get_boolean("display-preview-label-color"))) {
                    this.previewLabelColor = Me.settings.get_string("preview-label-color");
                    this.labelNamePreviewStyle = "color: " + this.previewLabelColor + "; font-weight: bold; font-size: " + this.previewFontSize + "pt; text-align: center;";
                    labelNamePreview.set_style(this.labelNamePreviewStyle);
                } else {
                    this.labelNamePreviewStyle = "color: rgba(255,255,255,1); font-weight: bold; font-size: " + this.previewFontSize + "pt; text-align: center;";
                    labelNamePreview.set_style(this.labelNamePreviewStyle);
                }
                this.preview.add_actor(labelNamePreview);
            }
            if (Me.settings.get_enum("display-label") !== 1) {
                let title = window.get_title();
                if ((title.length > 50) && (Me.settings.get_boolean("display-thumbnail")))
                    title = title.substr(0, 47) + "...";
                let labelTitlePreview = new St.Label({
                    text: ' ' + title + ' '
                });
                if ((Me.settings.get_string("preview-label-color") !== 'unset') && (Me.settings.get_boolean("display-preview-label-color"))) {
                    this.previewLabelColor = Me.settings.get_string("preview-label-color");
                    this.labelTitlePreviewStyle = "color: " + this.previewLabelColor + "; font-weight: bold; font-size: " + this.previewFontSize + "pt; text-align: center;";
                    labelTitlePreview.set_style(this.labelTitlePreviewStyle);
                } else {
                    this.labelTitlePreviewStyle = "color: rgba(255,255,255,1.0); font-weight: bold; font-size: " + this.previewFontSize + "pt; text-align: center;";
                    labelTitlePreview.set_style(this.labelTitlePreviewStyle);
                }
                this.preview.add_actor(labelTitlePreview);
            }
        }
        if (Me.settings.get_boolean("display-thumbnail")) {
            let thumbnail = this.getThumbnail(window, Me.settings.get_int("preview-size"));
            this.preview.add_actor(thumbnail);
        }
        if ((Me.settings.get_string("preview-background-color") !== 'unset') && (Me.settings.get_boolean("display-preview-background-color"))) {
            this.previewBackgroundColor = Me.settings.get_string("preview-background-color");
            this.previewStyle = "background-color: " + this.previewBackgroundColor + "; padding: 5px; border-radius: 8px; -y-offset: 6px;";
            this.preview.set_style(this.previewStyle);
        } else {
            this.previewStyle = "background-color: rgba(0,0,0,0.9); padding: 5px; border-radius: 8px; -y-offset: 6px;";
            this.preview.set_style(this.previewStyle);
        }
        global.stage.add_actor(this.preview);
        this.button = button;
        this.currentWindows = window;
        this.setPreviewPosition();
    },
    setIconGeometry(button, window) {
        let [stageX, stageY] = button.get_transformed_position();
        //set icon geometry
        let rect = new Meta.Rectangle();
        [rect.x, rect.y] = [stageX, stageY];
        [rect.width, rect.height] = button.get_transformed_size();
        window.set_icon_geometry(rect);
    },
    setPreviewPosition: function () {
        let [stageX, stageY] = this.button.get_transformed_position();
        //set icon geometry

        let rect = new Meta.Rectangle();
        [rect.x, rect.y] = [stageX, stageY];
        [rect.width, rect.height] = this.button.get_transformed_size();
        this.currentWindows.set_icon_geometry(rect);

        //set windows preview geometry

        let itemHeight = this.button.allocation.y2 - this.button.allocation.y1;
        let itemWidth = this.button.allocation.x2 - this.button.allocation.x1;
        let labelWidth = this.preview.get_width();
        let labelHeight = this.preview.get_height();
        let node = this.preview.get_theme_node();
        let yOffset = node.get_length('-y-offset');
        let y = null;
        if ((Me.settings.get_boolean("bottom-panel")))
            y = stageY - labelHeight - yOffset;
        else
            y = stageY + itemHeight + yOffset;
        let x = Math.floor(stageX + itemWidth / 2 - labelWidth / 2);
        let posparent = this.preview.get_parent();
        let posparentWidth = posparent.allocation.x2 - posparent.allocation.x1;
        x = Math.max(x, 6);
        x = Math.min(x, posparentWidth - labelWidth - 6);
        if (!isNaN(x) && !isNaN(y)) {
            this.preview.set_position(x, y);
        }
    },
    resetPreview: function (button, window) {
        //Reset Hover
        this.resetHover = true;
        if (this.previewTimer2 !== null) {
            Mainloop.source_remove(this.previewTimer2);
            this.previewTimer2 = null;
        }
        this.hidePreview();
    },
    hidePreview: function () {
        //Remove preview programmed if necessary
        if (this.previewTimer !== null) {
            Mainloop.source_remove(this.previewTimer);
            this.previewTimer = null;
        }
        //Destroy Preview if displaying
        if (this.preview !== null) {
            this.preview.destroy();
            this.preview = null;
        }
    },
    _scrollWindows(actor, event) {
        let workspace = global.workspace_manager.get_active_workspace();
        let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, workspace);
        if (windows.length < 2)
            return;

        switch (event.get_scroll_direction()) {
            case Clutter.ScrollDirection.UP:
                windows[windows.length - 1].activate(global.get_current_time());
                break;
            case Clutter.ScrollDirection.DOWN:
                windows[windows.length - windows.length > 2 ? 2 : 1].activate(global.get_current_time());
                //windows[0].lower(); // the windows loses focus using this method
                break;
        }

        return Clutter.EVENT_STOP;
    },
    _scrollWorkspace(actor, event) {

        let workspace = global.workspace_manager.get_active_workspace();

        switch (event.get_scroll_direction()) {
            case Clutter.ScrollDirection.UP:
                if (workspace.index() == 0)
                    return;
                else
                    workspace.get_neighbor(Meta.MotionDirection.UP).activate(global.get_current_time());
                break;
            case Clutter.ScrollDirection.DOWN:
                if (workspace.index() + 1 == global.workspace_manager.n_workspaces)
                    return;
                else
                    workspace.get_neighbor(Meta.MotionDirection.DOWN).activate(global.get_current_time());
                break;
        }

        return Clutter.EVENT_STOP;
    }

});
const MyAppIconMenu = class MyAppIconMenu extends AppDisplay.AppIconMenu {
    constructor(source) {
        super(source);
        let side = null;
        if (Me.settings.get_boolean('bottom-panel')) {
            side = St.Side.BOTTOM;
        } else {
            side = St.Side.TOP;
        }
        this._arrowSide = side;
        this._boxPointer._arrowSide = side;
        this._boxPointer._userArrowSide = side;
    }

    _redisplay() {
        // This will be removed by 3.36.1
        return this._rebuildMenu();
    }

    _rebuildMenu() {
        this.removeAll();


        if (super._rebuildMenu)
            super._rebuildMenu();
        else
            super._redisplay();
        // quit menu
        this._appendSeparator();
        this._quitfromMenuItem = this._appendMenuItem(_("Quit"));
        this._quitfromMenuItem.connect('activate', () => {
            this._source.window.delete(global.get_current_time());
        });

        this.update();
    }

    update() {

        let windows = this._source.app.get_windows().filter(w => !w.skip_taskbar);
        // update, show or hide the quit menu
        if (windows.length == 0) {
            this._quitfromMenuItem.actor.hide();
        }
        // Update separators
        this._getMenuItems().forEach(this._updateSeparatorVisibility.bind(this));
    }
};