/* Ubuntuvn desktop extension
 * https://ubuntuvn.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Signals = imports.signals;
const Main = imports.ui.main;
const Overview = imports.ui.overview;
const PanelBox = Main.layoutManager.panelBox;
const Util = imports.misc.util;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const schema = "org.gnome.shell.extensions.ubuntuvn-desktop";
const Lib = Me.imports.lib;
const {DisableIncompatibleExtensionsModule} = Me.imports.module.disableIncompatibleExtensionsModule;
const {SuperWorkspaceModule} = Me.imports.module.superWorkspaceModule;
const {HotKeysModule} = Me.imports.module.hotKeysModule;
const {RequiredSettingsModule} = Me.imports.module.requiredSettingsModule;
const {TilingModule} = Me.imports.module.tilingModule;
const {StateManager} = Me.imports.stateManager;
const ExtensionUtils = imports.misc.extensionUtils;
const {TweaksSystemMenuExtension} = Me.imports.module.tweaksSystemMenuExtension;
const {DynamicTransparent} = Me.imports.module.dynamicTransparent;
const {WindowList} = Me.imports.module.windowList;
const {GestureModule} = Me.imports.module.gestureModule;
const {YouTubeSearchProvider} = Me.imports.module.youTubeSearchProvider;
let disableIncompatibleExtensionsModule, tilingModules, _startupPreparedId, systemModules,injections,dynamicTransparent;

class UbuntuvnDesktop {
    constructor() {
        log('----------------');
        log('CONSTRUCTOR UBUNTUVN DESKTOP');
        log('----------------');
        Me.stateManager = null;
        Me.noUimode = false;
        Me.loaded = false;
        Me.showAppsButton = null;
        disableIncompatibleExtensionsModule = null;
        systemModules = null;
        tilingModules = null;
        injections=[];
        Me.tilingButton = new St.Bin({
            style_class: 'panel-button',
            reactive: true,
            can_focus: true,
            x_fill: true,
            y_fill: false,
            track_hover: true
        });
        Me.tilingButtonOff = new St.Bin({
            style_class: 'panel-button',
            reactive: true,
            can_focus: true,
            x_fill: true,
            y_fill: false,
            track_hover: true
        });
        this.tilingIconOff = new St.Icon({icon_name: 'window-close-symbolic', style_class: 'system-status-icon'})
        Me.tilingButtonOff.set_child(this.tilingIconOff);
        Me.tilingButtonOff.connect('button-press-event', this.disable_material_shell);
        this._shadeBackground = Overview.Overview.prototype['_shadeBackgrounds'];
    }
    enable() {
        log('----------------');
        log('ENABLE UBUNTUVN DESKTOP');
        log('----------------');
        //inject function
        Overview.Overview.prototype['_shadeBackgrounds'] = function () {
        };
        Signals.addSignalMethods(Me);
        global.materialShell = Me;
        let settings = new Lib.Settings(schema);
        Me.settings = settings.getSettings();
        this.initPanelBackground(true);
        dynamicTransparent = new DynamicTransparent();
        systemModules = [
            new TweaksSystemMenuExtension(),
            new WindowList(),
            new GestureModule(global.stage),
            new YouTubeSearchProvider()
        ];
        tilingModules = [
            new RequiredSettingsModule(),
            new TilingModule(),
            new SuperWorkspaceModule(),
            new HotKeysModule(),
        ];
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            //Then disable incompatibles extensions;
            if (Me.settings.get_boolean("dynamic-transparent")) {
                dynamicTransparent.enable();
            }
            return GLib.SOURCE_REMOVE;
        });
        systemModules.forEach(module => {
            if(!Me.settings.get_boolean("dynamic-transparent") && module.hasOwnProperty('_actorSignalIds')) {
                //do nothing
                log("dynamic transparent disabled");
            }
            else {
                module.enable();
            }

        });
        //Reinit Extension on Param Change
        this.setSignals();
        this.ubuntuvnHotKey();
    }
    disable() {
        log('----------------');
        log('DISABLE UBUNTUVN DESKTOP');
        log('----------------');
        this.initPanelBackground(false);
        //disable material shell
        if (Main.panel._rightBox.get_child_at_index(1).name === "tilingAction") {
            this.disable_material_shell();
        }
        //disable system module
        systemModules.reverse().forEach(module => {
            if(!Me.settings.get_boolean("dynamic-transparent") && module.hasOwnProperty('_actorSignalIds')) {
                //do nothing
                log("dynamic transparent disabled");
            }
            else {
                module.disable();
            }
        });
        if (Me.settings.get_boolean("dynamic-transparent")) {
            dynamicTransparent.disable();
        }
        //Disconnect Setting Signals
        if (this.settingSignals !== null) {
            this.settingSignals.forEach(
                function (signal) {
                    Me.settings.disconnect(signal);
                },
                this
            );
            this.settingSignals = null;
        }

        Overview.Overview.prototype['_shadeBackgrounds'] = this._shadeBackground
        Me.settings = null;
        Me.initTransparent = null;
        systemModules = null;
        tilingModules = null;
        delete global.materialShell;
    }
    _toTop() {
        //Init the top panel
        if (PanelBox.anchor_x !== 0 || PanelBox.anchor_y !== 0) {
            PanelBox.set_anchor_point(0, 0);
        }
        if (!Main.panel.statusArea.dateMenu)
            return;
        let dateMenuContainer = Main.panel.statusArea.dateMenu.container;

        let parent = dateMenuContainer.get_parent();
        let destination;
        if (!parent) {
            return;
        }
        let refSibling = null;
        if (Me.settings.get_enum("tasks-label") !== 0) {
            refSibling = Main.panel.statusArea.aggregateMenu ? Main.panel.statusArea.aggregateMenu.container : null;
            destination = Main.panel._rightBox;
        } else {
            destination = Main.panel._centerBox;
        }
        if (parent != destination) {
            parent.remove_actor(dateMenuContainer);
            destination.add_actor(dateMenuContainer);
        }
        if (refSibling !== null) {
            destination['set_child_below_sibling'](dateMenuContainer, refSibling);
        }
        destination.queue_relayout();
    }

    _toBottom() {
        //Move the panel to bottom
        let monitor = Main.layoutManager.primaryMonitor;
        if (PanelBox.anchor_x !== 0 || PanelBox.anchor_y !== (-1) * (monitor.height - PanelBox.height)) {
            PanelBox.set_anchor_point(0, (-1) * (monitor.height - PanelBox.height));
            Me.settings.set_boolean("hide-panel-enable", false);
            //Move the datetime to right panel
            if (!Main.panel.statusArea.dateMenu)
                return;
            let dateMenuContainer = Main.panel.statusArea.dateMenu.container;

            let parent = dateMenuContainer.get_parent();
            let destination;
            let refSibling = null;
            if (!parent) {
                return;
            }
            refSibling = Main.panel.statusArea.aggregateMenu ? Main.panel.statusArea.aggregateMenu.container : null;
            destination = Main.panel._rightBox;
            if (parent != destination) {
                parent.remove_actor(dateMenuContainer);
                destination.add_actor(dateMenuContainer);
            }
            destination['set_child_below_sibling'](dateMenuContainer, refSibling);
            destination.queue_relayout();
        }
    }

    enable_material_shell() {
        log('----------------');
        log('ENABLE TILING');
        log('----------------');
        disableIncompatibleExtensionsModule = new DisableIncompatibleExtensionsModule();
        Me.stateManager = new StateManager();
        //disable the Dynamic transparent
        Me.initTransparent = Me.settings.get_boolean("dynamic-transparent");
        if (Me.initTransparent) {
            Me.settings.set_boolean("dynamic-transparent", false);
        }
        Main.panel._rightBox.insert_child_at_index( Me.tilingButtonOff, 0);
        //disable the animation
        Main.wm._blockAnimations = true;
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            //Then disable incompatibles extensions;
            disableIncompatibleExtensionsModule.enable();
            Me.stateManager.loadRegistry(() => {
                tilingModules.forEach(module => {
                    module.enable();
                });
                if (Main.layoutManager._startingUp) {
                    _startupPreparedId = Main.layoutManager.connect(
                        'startup-complete',
                        () => this.loaded(true)
                    );
                } else {
                    this.loaded(false);
                }
            });
            return GLib.SOURCE_REMOVE;
        });
        Main.notify(
            'Windows tiling ON',
            `Press SUPER + SPACE to change tiling mode, SUPER + ESC to hide panel, CTRL + ALT + (UP, DOWN) to change workspace.`
        );
    }

    loaded(disconnect) {
        if (disconnect) {
            Main.layoutManager.disconnect(_startupPreparedId);
        }
        Me.loaded = true;
        Main.wm._blockAnimations = false;
        Me.emit('extension-loaded');
    }

    disable_material_shell() {
        log('----------------');
        log('DISABLE TILING');
        log('----------------');
        tilingModules.reverse().forEach(module => {
            module.disable();
        });
        Me.loaded = false;
        Me.settings.set_boolean("dynamic-transparent", Me.initTransparent);
        Main.panel._rightBox.remove_child( Me.tilingButtonOff);
        disableIncompatibleExtensionsModule.disable();
        disableIncompatibleExtensionsModule = null;
    }
    setSignals() {
        //Reinit Extension on Param Change
        this.settingSignals = [
            Me.settings.connect("changed::dynamic-transparent", Lang.bind(this, this.resetDynamicTransparent)),
            Me.settings.connect("changed::reset-login-background", Lang.bind(this, this.resetLoginBackground)),
            Me.settings.connect("changed::panel-background-color", Lang.bind(this, this.initPanelBackground)),
        ];
    }

    resetLoginBackground() {
        if (Me.settings.get_boolean("reset-login-background")) {
            Me.settings.set_boolean("reset-login-background", false);
            Util.spawnCommandLine('gnome-terminal -e "ubuntuvn-setting -b"');

        }
    }
    resetDynamicTransparent() {
        if (Me.settings.get_boolean("dynamic-transparent")) {
            dynamicTransparent.enable();
        } else {
            dynamicTransparent.disable();
        }
    }
    initPanelBackground(disable) {
        if (Me.settings.get_string("panel-background-color") !== 'unset' && disable) {
            this.initPanelColor = Main.panel.get_style();
            if (Main.panel.get_style() !== null) {
                Main.panel.set_style(Main.panel.get_style() + 'background-color:' + Me.settings.get_string("panel-background-color") + ';');
            }
            else {
                Main.panel.set_style('background-color:' + Me.settings.get_string("panel-background-color") + ';');
            }
        }
        else {
            Main.panel.style_class ='transparent-top-bar--solid';
        }
    }
    ubuntuvnHotKey() {
        Main.wm.addKeybinding(
            'toggle-material-shell-ui',
            Me.settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL,
            () => {
                const noUImode = Me.noUimode;
                Me.noUimode = !noUImode;
                Main.panel.get_parent().visible = noUImode;
                if (Main.panel._rightBox.get_child_at_index(1).name === "tilingAction") {
                    global.superWorkspaceManager.noUImode = !noUImode;
                }
                Main.panel.visible = noUImode;
                Main.panel
                    .get_parent()
                    .set_width(!noUImode ? 0 : -1);
                Main.layoutManager.panelBox.visible = noUImode;
                Main.layoutManager.panelBox.set_height(!noUImode ? 0 : -1);
                Main.layoutManager.monitors.forEach(monitor => {
                    Main.layoutManager._queueUpdateRegions();
                    // if the tiling is ON
                    if (Main.panel._rightBox.get_child_at_index(1).name === "tilingAction") {
                        let superWorkspace;
                        if (Main.layoutManager.primaryIndex === monitor.index) {
                            superWorkspace = global.superWorkspaceManager.getActiveSuperWorkspace();
                        } else {
                            superWorkspace = global.superWorkspaceManager.getSuperWorkspacesOfMonitorIndex(
                                monitor.index
                            )[0];
                        }
                        superWorkspace.updateUI();
                        superWorkspace.panel.set_height(!noUImode ? 0 : -1);
                        superWorkspace.tilingLayout.onTile();
                    }
                });
            }
        );
        Main.wm.addKeybinding(
            'enable-window-tiling',
            Me.settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL,
            () => {
                if (Main.panel._rightBox.get_child_at_index(1).name === "tilingAction") {
                    this.disable_material_shell();
                }
                else {
                    this.enable_material_shell();
                }
            }
        );
    }

    init_workspace_categories() {
        let WorkspaceCategories = {};
        this.workspaces_count = global.workspace_manager.n_workspaces;
        for (let workspace_index = 1; workspace_index <= this.workspaces_count; ++workspace_index) {
            WorkspaceCategories['wp' + workspace_index] = {
                icon: Gio.icon_new_for_string(
                    `${Me.path}/assets/icons/package-symbolic.svg`
                ),
                title: 'wp' + workspace_index,
                categoriesIncluded: [],
                categoriesExcluded: [],
                acceptAll: true,
                acceptOrphans: true,
                primary: true
            }
        }
        WorkspaceCategories['wp0'] = {
            icon: Gio.icon_new_for_string(
                `${Me.path}/assets/icons/package-symbolic.svg`
            ),
            title: 'wp0',
            categoriesIncluded: [],
            categoriesExcluded: [],
            acceptAll: true,
            acceptOrphans: true,
            primary: false
        }
        return WorkspaceCategories;
    }
}
function injectToFunction(parent, name, func)
{
    let origin = parent[name];
    parent[name] = function()
    {
        let ret;
        ret = origin.apply(this, arguments);
        if (ret === undefined)
            ret = func.apply(this, arguments);
        return ret;
    }
    return origin;
}

function removeInjection(object, injection, name)
{
    if (injection[name] === undefined)
        delete object[name];
    else
        object[name] = injection[name];
}
function init() {
    global.UbuntuvnDesktop = new UbuntuvnDesktop();
    return global.UbuntuvnDesktop;
}
