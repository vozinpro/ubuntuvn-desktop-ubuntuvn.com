const Me = imports.misc.extensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const BoxPointer = imports.ui.boxpointer;
const Shell = imports.gi.Shell;
var TweaksSystemMenuExtension = class TweaksSystemMenuExtension {
    constructor() {
        this._systemMenu = null;
        this._tweaksItem = null;
        this._systemMenu = Main.panel.statusArea.aggregateMenu._system;
    }

    // Show/hide item
    enable() {
        let [icon1, name1] = ['utilities-tweak-tool-symbolic',
            "Ubuntuvn setting"];
        this._tweaksItem = new PopupMenu.PopupImageMenuItem(name1, icon1);
        this._tweaksItem.connect('activate', this._on_activate.bind(this));
        Main.panel.statusArea.aggregateMenu._system.menu.box.insert_child_at_index(this._tweaksItem, Main.panel.statusArea.aggregateMenu._system._sessionSubMenu);
        //tiling app
        let [icon, name] = ['view-dual-symbolic',
            "Window tiling"];
        this._tilingItem = new PopupMenu.PopupImageMenuItem(name, icon);
        this._tilingItem.connect('activate', this._on_tiling.bind(this));
        Main.panel.statusArea.aggregateMenu._system.menu.box.insert_child_at_index(this._tilingItem, Main.panel.statusArea.aggregateMenu._system._sessionSubMenu);

        //Main.panel.statusArea.aggregateMenu._system.menu.box.insert_child_at_index(Main.panel.statusArea.aggregateMenu._system._sessionSubMenu, this._systemMenu.menu.length);
    }
    disable() {
        this._tweaksItem.destroy();
        this._tilingItem.destroy();
    }
    _on_tiling() {
        if (Main.panel._rightBox.get_child_at_index(1).name !== "tilingAction") {
            this._systemMenu.menu.itemActivated(BoxPointer.PopupAnimation.NONE);
            Main.overview.hide();
            global.UbuntuvnDesktop.enable_material_shell();
        } else {
            this._systemMenu.menu.itemActivated(BoxPointer.PopupAnimation.NONE);
            Main.overview.hide();
            global.UbuntuvnDesktop.disable_material_shell();
        }
    }
    _on_activate() {
        this._systemMenu.menu.itemActivated(BoxPointer.PopupAnimation.NONE);
        Main.overview.hide();

        let command = ["gnome-shell-extension-prefs"];
        Util.spawn(command.concat([Me.metadata.uuid]));
    }
};