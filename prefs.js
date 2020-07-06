//  ubuntuvn-desktop
//  Copyright (C) 2020 Ubuntuvn respin - https://ubuntuvn.com
//
//  This program is free software: you can redistribute it and/or modify
//  it under the terms of the GNU General Public License as published by
//  the Free Software Foundation, either version 3 of the License, or
//  (at your option) any later version.
//
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License
//  along with this program.  If not, see <https://www.gnu.org/licenses/>.
//

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gdk = imports.gi.Gdk;
const GdkPixbuf = imports.gi.GdkPixbuf;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Lib = Extension.imports.lib;
const Gettext = imports.gettext.domain('Ubuntuvn');
const _ = Gettext.gettext;
const {ShellVersionMatch} = Extension.imports.utils.compatibility;
const Config = imports.misc.config;
const ExtensionUtils = imports.misc.extensionUtils;
const ShellVersion = imports.misc.config.PACKAGE_VERSION.split(".").map(function (x) {
    return +x;
});

const schema = "org.gnome.shell.extensions.ubuntuvn-desktop";
const schemaDock = 'org.gnome.shell.extensions.dash-to-dock';
const schemaDesktop = 'org.gnome.desktop.interface';
const RESETCOLOR = 'rgba(0,0,0,0)';
const RESETCOLORBLACK = 'rgba(0,0,0,1.0)';
const RESETCOLORWHITE = 'rgba(255,255,255,1.0)';
const APPVIEWICON = Extension.path + '/images/logo.png';
const DONATIONICON = Extension.path + '/images/donate.png';
const HOMEICON = Extension.path + '/images/settings-home.png';
const GPLICON = Extension.path + '/images/settings-gpl.png';
const SPACERICON = Extension.path + '/images/settings-1px.png';

function init() {
    initTranslations("Ubuntuvn");
}

/**
 * initTranslations:
 * @domain: (optional): the gettext domain to use
 *
 * Initialize Gettext to load translations from extensionsdir/locale.
 * If @domain is not provided, it will be taken from metadata['gettext-domain']
 */
function initTranslations(domain) {
    let extension = ExtensionUtils.getCurrentExtension();

    domain = domain || extension.metadata['gettext-domain'];

    let localeDir = extension.dir.get_child('locale');
    if (localeDir.query_exists(null))
        imports.gettext.bindtextdomain(domain, localeDir.get_path());
    else
        imports.gettext.bindtextdomain(domain, Config.LOCALEDIR);
}

function buildPrefsWidget() {
    let prefs = new Prefs(schema);
    return prefs.buildPrefsWidget();
}

function Prefs(schema) {
    this.init(schema);
}

Prefs.prototype = {
    settings: null,

    init: function (schema) {
        let settings = new Lib.Settings(schema);
        this.settings = settings.getSettings();

        let settingDesktop = new Lib.Settings(schemaDesktop);
        this.settingsDesktop = settingDesktop.getSettings();
        this.dockAvailable = false;
        this.hidePanelAvaillable = false;
        if (this.checkAvaillableExtension("ubuntu-dock@ubuntu.com")) {
            this.dockAvailable = true;
        }
        if (this.checkAvaillableExtension("dash-to-dock@micxgx.gmail.com")) {
            this.dockAvailable = true;
        }
        if (this.checkAvaillableExtension("hidetopbar@mathieu.bidon.ca")) {
            this.hidePanelAvaillable = true;
            this.settings.set_boolean("hide-panel-enable", this.checkEnabledExtension("hidetopbar@mathieu.bidon.ca"));
        }
        if (this.dockAvailable) {
            let settingsDock = new Lib.Settings(schemaDock);
            this.settingsDock = settingsDock.getSettings();
        }
    },

    buildPrefsWidget: function () {
        let notebook = new Gtk.Notebook();
        notebook.set_scrollable(true);
        notebook.popup_enable;
        notebook.set_tab_pos(2);

        //
        // About
        //

        this.gridTaskBar = new Gtk.Grid();
        this.gridTaskBar.margin = this.gridTaskBar.row_spacing = 10;
        this.gridTaskBar.column_spacing = 2;

        let scrollWindowTaskBar = this.gridTaskBar;

        scrollWindowTaskBar.show_all();
        let labelTaskBar = new Gtk.Label({
            label: _("About")
        });
        notebook.append_page(scrollWindowTaskBar, labelTaskBar);

        let linkImage1 = new Gtk.Image({
            file: HOMEICON
        });
        let linkImage2 = new Gtk.Image({
            file: HOMEICON
        });
        let linkDonationImage = new Gtk.Image({
            file: DONATIONICON
        });
        let logoImage = new Gtk.Image({
            file: APPVIEWICON
        });
        this.gridTaskBar.attach(logoImage, 0, 0, 5, 1);
        let labelLink2 = new Gtk.LinkButton({
            image: linkImage1,
            label: " ubuntuvn.com",
            uri: "https://ubuntuvn.com",
            xalign: 0
        });
        labelLink2.set_always_show_image(true);
        this.gridTaskBar.attach(labelLink2, 1, 5, 1, 1);

        let labelLink3 = new Gtk.LinkButton({
            image: linkImage2,
            label: " github.com/vozinpro",
            uri: "https://github.com/vozinpro",
            xalign: 0
        });
        labelLink3.set_always_show_image(true);
        this.gridTaskBar.attach(labelLink3, 3, 5, 1, 1);

        let exportButton = new Gtk.Button({
            label: _("Export Settings")
        });
        exportButton.connect('clicked', Lang.bind(this, this.exportSettings));
        exportButton.set_tooltip_text(_("Export All TaskBar Settings. This will create a taskbar.dconf file in your home folder."));
        this.gridTaskBar.attach(exportButton, 1, 9, 1, 1);

        let importButton = new Gtk.Button({
            label: _("Import Settings")
        });
        importButton.connect('clicked', Lang.bind(this, this.importSettings));
        importButton.set_tooltip_text(_("Import All TaskBar Settings. This will import the taskbar.dconf file located in your home folder."));
        this.gridTaskBar.attach(importButton, 3, 9, 1, 1);

        let resetAllButton = new Gtk.Button({
            label: _("RESET ALL !")
        });
        resetAllButton.modify_fg(Gtk.StateType.NORMAL, new Gdk.Color({
            red: 65535,
            green: 0,
            blue: 0
        }));
        resetAllButton.connect('clicked', Lang.bind(this, this.resetAll));
        resetAllButton.set_tooltip_text(_("Reset All ubuntuvn-desktop Settings to the Original TaskBar Settings"));
        this.gridTaskBar.attach(resetAllButton, 2, 9, 1, 1);

        let labelSpaceTaskBar1 = new Gtk.Label({
            label: "\t",
            xalign: 0
        });
        this.gridTaskBar.attach(labelSpaceTaskBar1, 0, 10, 1, 1);
        let labelSpaceTaskBar2 = new Gtk.Label({
            label: "\t",
            xalign: 0,
            hexpand: true
        });
        this.gridTaskBar.attach(labelSpaceTaskBar2, 2, 10, 1, 1);
        let labelSpaceTaskBar3 = new Gtk.Label({
            label: "<b>" + _("Version ") + ExtensionUtils.getCurrentExtension().metadata['version'] + "</b>",
            hexpand: true
        });
        labelSpaceTaskBar3.set_use_markup(true);
        this.gridTaskBar.attach(labelSpaceTaskBar3, 0, 1, 5, 1);

        let labelLinkDonation = new Gtk.LinkButton({
            image: linkDonationImage,
            label: "https://ubuntuvn.com/donation/",
            uri: "https://ubuntuvn.com/donation/",
            xalign: 0
        });

        let labelDonation = new Gtk.Label({
            label: "   If you interested in our efforts, please support us by following the link below",
            xalign: 0
        });


        this.gridTaskBar.attach(labelDonation, 1, 11, 5, 1);
        this.gridTaskBar.attach(labelLinkDonation, 1, 12, 5, 1);

        let labelSpaceTaskBar4 = new Gtk.Label({
            label: "\t",
            xalign: 0
        });
        this.gridTaskBar.attach(labelSpaceTaskBar4, 4, 8, 1, 1);

        //
        // Overview
        //
        this.gridComponents = new Gtk.Grid();
        this.gridComponents.margin = this.gridComponents.row_spacing = 10;
        this.gridComponents.column_spacing = 2;

        let scrollWindowComponents = this.gridComponents;

        scrollWindowComponents.show_all();
        let labelComponents = new Gtk.Label({
            label: _("Overview")
        });
        notebook.append_page(scrollWindowComponents, labelComponents);

        let logoImage2 = new Gtk.Image({
            file: APPVIEWICON,
            xalign: 1
        });
        //display-tasks
        let labelDisplayTask = new Gtk.Label({
            label: _("Task list"),
            xalign: 0
        });
        this.gridComponents.attach(labelDisplayTask, 1, 4, 1, 1);
        this.valueDisplayTask = new Gtk.Switch({
            active: this.settings.get_boolean("display-tasks")
        });
        this.valueDisplayTask.set_halign(Gtk.Align.END);
        this.valueDisplayTask.connect('notify::active', Lang.bind(this, this.changeDisplayTasks));
        this.gridComponents.attach(this.valueDisplayTask, 3, 4, 2, 1);

        let labelDisplayFavorites = new Gtk.Label({
            label: _("Favorites"),
            xalign: 0
        });
        this.gridComponents.attach(labelDisplayFavorites, 1, 5, 1, 1);
        this.valueDisplayFavorites = new Gtk.Switch({
            active: this.settings.get_boolean("display-favorites")
        });
        this.valueDisplayFavorites.set_halign(Gtk.Align.END);
        this.valueDisplayFavorites.connect('notify::active', Lang.bind(this, this.changeDisplayFavorites));
        this.gridComponents.attach(this.valueDisplayFavorites, 3, 5, 2, 1);

        let labelDynamicTransparent = new Gtk.Label({
            label: _("Dynamic Transparent"),
            xalign: 0
        });
        this.gridComponents.attach(labelDynamicTransparent, 1, 6, 1, 1);
        this.valueDynamicTransparnent = new Gtk.Switch({
            active: this.settings.get_boolean("dynamic-transparent")
        });
        this.valueDynamicTransparnent.set_halign(Gtk.Align.END);
        this.valueDynamicTransparnent.connect('notify::active', Lang.bind(this, this.changeDynamicTransparent));
        this.gridComponents.attach(this.valueDynamicTransparnent, 3, 6, 2, 1);

        let labelBottomPanel = new Gtk.Label({
            label: _("Windows 10 style"),
            xalign: 0
        });
        this.gridComponents.attach(labelBottomPanel, 1, 8, 1, 1);
        this.valueBottomPanel = new Gtk.Switch({
            active: this.settings.get_boolean("bottom-panel")
        });
        this.valueBottomPanel.set_halign(Gtk.Align.END);
        this.valueBottomPanel.connect('notify::active', Lang.bind(this, this.changeBottomPanel));
        this.gridComponents.attach(this.valueBottomPanel, 3, 8, 2, 1);

        //check dock

        if (this.dockAvailable) {
            let labelDock = new Gtk.Label({
                label: _("Dock"),
                xalign: 0
            });
            this.gridComponents.attach(labelDock, 1, 9, 1, 1);
            this.valueDock = new Gtk.Switch({
                active: this.settings.get_boolean("dock-enable")
            });
            this.valueDock.set_halign(Gtk.Align.END);
            this.valueDock.connect('notify::active', Lang.bind(this, this.changeDock));
            this.gridComponents.attach(this.valueDock, 3, 9, 2, 1);
        }

        if (this.hidePanelAvaillable && false) {
            let labelHidePanel = new Gtk.Label({
                label: _("Hide panel"),
                xalign: 0
            });
            this.gridComponents.attach(labelHidePanel, 1, 10, 1, 1);
            this.valueHidePanel = new Gtk.Switch({
                active: this.settings.get_boolean("hide-panel-enable")
            });
            this.valueHidePanel.set_halign(Gtk.Align.END);
            this.valueHidePanel.connect('notify::active', Lang.bind(this, this.changeHidePanel));
            this.gridComponents.attach(this.valueHidePanel, 3, 10, 2, 1);
        }

        let resetComponentsButton = new Gtk.Button({
            label: _("Reset Overview Tab")
        });
        resetComponentsButton.modify_fg(Gtk.StateType.NORMAL, new Gdk.Color({
            red: 65535,
            green: 0,
            blue: 0
        }));
        resetComponentsButton.connect('clicked', Lang.bind(this, this.resetComponents));
        resetComponentsButton.set_tooltip_text(_("Reset the Overview Tab to the Original Overview Settings"));
        this.gridComponents.attach(resetComponentsButton, 1, 12, 1, 1);


        let labelSpaceComponents1 = new Gtk.Label({
            label: "\t",
            xalign: 0
        });
        this.gridComponents.attach(labelSpaceComponents1, 0, 13, 1, 1);
        let labelSpaceComponents2 = new Gtk.Label({
            label: "\t",
            xalign: 0,
            hexpand: true
        });
        this.gridComponents.attach(labelSpaceComponents2, 2, 9, 1, 1);
        let labelSpaceComponents3 = new Gtk.Label({
            label: "<b>" + _("Overview") + "</b>",
            hexpand: true
        });
        labelSpaceComponents3.set_use_markup(true);

        this.gridComponents.attach(labelSpaceComponents3, 0, 0, 6, 1);
        let labelSpaceComponents4 = new Gtk.Label({
            label: "\t",
            xalign: 0
        });

        //this.gridComponents.attach(logoImage2, 0, 0, 4, 1);
        this.gridComponents.attach(labelSpaceComponents4, 5, 1, 1, 1);

        //
        // Panels
        //

        this.gridSettings = new Gtk.Grid();
        this.gridSettings.margin = this.gridSettings.row_spacing = 10;
        this.gridSettings.column_spacing = 2;

        let scrollWindowSettings = this.gridSettings;

        scrollWindowSettings.show_all();
        let labelSettings = new Gtk.Label({
            label: _("Panel & Dock")
        });
        notebook.append_page(scrollWindowSettings, labelSettings);

        let labelPanelBackgroundColor = new Gtk.Label({
            label: _("Panel Background\nColor & Opacity"),
            xalign: 0
        });
        let tooltipPanelBackgroundColor = _("Panel Background Color & Opacity\nClick the color button to set the color and opacity of the active task background. This opens a new window with a table of preset colors to choose from. Click the '+' button under 'Custom' to customize color and opacity. Clicking '+' changes the window. In the center is a color picker, the left slider changes color and the bottom slider changes opacity. At the top, a indicator and entry field displays hexadecimal values in the form: #RRGGBB, where RR (red), GG (green) and BB (blue) are values between 00 and FF. When selected, customized colors will be available in all color settings. Back on the 'Tasks (III)' tab, flip the switch next to the color button to activate/deactivate the background color.\nToggle tasks at the 'Overview' tab.");
        labelPanelBackgroundColor.set_tooltip_text(tooltipPanelBackgroundColor);
        this.gridSettings.attach(labelPanelBackgroundColor, 1, 1, 1, 1);
        let panelColor = this.settings.get_string("panel-background-color");
        let rgbaPanel = new Gdk.RGBA();
        rgbaPanel.parse(panelColor);
        this.valuePanelBackgroundColor = new Gtk.ColorButton({
            title: "TaskBar - Set Active Task Background Color"
        });
        this.valuePanelBackgroundColor.set_tooltip_text(tooltipPanelBackgroundColor);
        this.valuePanelBackgroundColor.set_use_alpha(true);
        this.valuePanelBackgroundColor.set_rgba(rgbaPanel);
        this.valuePanelBackgroundColor.connect('color-set', Lang.bind(this, this.changePanelBackgroundColor));
        this.gridSettings.attach(this.valuePanelBackgroundColor, 3, 1, 1, 1);


        let labelIconSize = new Gtk.Label({
            label: _("Panel Size"),
            xalign: 0
        });
        this.gridSettings.attach(labelIconSize, 1, 3, 1, 1);
        this.valueIconSize = new Gtk.Adjustment({
            lower: 10,
            upper: 96,
            step_increment: 1
        });
        let value2IconSize = new Gtk.SpinButton({
            adjustment: this.valueIconSize,
            snap_to_ticks: true
        });
        value2IconSize.set_value(this.settings.get_int("panel-size"));
        value2IconSize.connect("value-changed", Lang.bind(this, this.changeIconSize));
        this.gridSettings.attach(value2IconSize, 3, 3, 2, 1);
        if (this.dockAvailable) {
            let labelDockSize = new Gtk.Label({
                label: _("Dock Size"),
                xalign: 0
            });
            this.gridSettings.attach(labelDockSize, 1, 4, 1, 1);
            this.valueDockSize = new Gtk.Adjustment({
                lower: 1,
                upper: 96,
                step_increment: 1
            });
            let value2DockSize = new Gtk.SpinButton({
                adjustment: this.valueDockSize,
                snap_to_ticks: true
            });
            value2DockSize.set_value(this.settingsDock.get_int("dash-max-icon-size"));
            value2DockSize.connect("value-changed", Lang.bind(this, this.changeDockSize));
            this.gridSettings.attach(value2DockSize, 3, 4, 2, 1);

            let labelDockPosition = new Gtk.Label({
                label: _("Dock position"),
                xalign: 0
            });
            this.gridSettings.attach(labelDockPosition, 1, 5, 1, 1);
            this.valueDockPosition = new Gtk.ComboBoxText();
            this.valueDockPosition.append_text(_("Top"));
            this.valueDockPosition.append_text(_("Right"));
            this.valueDockPosition.append_text(_("Bottom"));
            this.valueDockPosition.append_text(_("Left"));
            this.valueDockPosition.set_active(this.settingsDock.get_enum("dock-position"));
            this.valueDockPosition.connect('changed', Lang.bind(this, this.changeDockPosition));
            this.gridSettings.attach(this.valueDockPosition, 3, 5, 2, 1);
        }

        let labelSpaceSettings1 = new Gtk.Label({
            label: "\t",
            xalign: 0
        });
        this.gridSettings.attach(labelSpaceSettings1, 0, 12, 1, 1);
        let labelSpaceSettings2 = new Gtk.Label({
            label: "\t",
            xalign: 0,
            hexpand: true
        });
        this.gridSettings.attach(labelSpaceSettings2, 2, 2, 1, 1);
        let labelSpaceSettings3 = new Gtk.Label({
            label: "\t",
            xalign: 0
        });
        this.gridSettings.attach(labelSpaceSettings3, 5, 10, 1, 1);
        let labelSpaceSettings4 = new Gtk.Label({
            label: "<b>" + _("Panel, Dock") + "</b>",
            hexpand: true
        });
        labelSpaceSettings4.set_use_markup(true);
        this.gridSettings.attach(labelSpaceSettings4, 0, 0, 9, 1);
        let labelSpaceSettings5 = new Gtk.Label({
            label: "\t",
            xalign: 0
        });
        this.gridSettings.attach(labelSpaceSettings5, 8, 1, 1, 1);

        //
        // Tasks
        //

        this.gridTasks = new Gtk.Grid();
        this.gridTasks.margin = this.gridTasks.row_spacing = 10;
        this.gridTasks.column_spacing = 2;

        let scrollWindowTasks = this.gridTasks;

        scrollWindowTasks.show_all();
        let labelTasks = new Gtk.Label({
            label: _("Tasks")
        });
        notebook.append_page(scrollWindowTasks, labelTasks);

        let labelActiveTaskBackgroundColor = new Gtk.Label({
            label: _("Active Task Background\nColor & Opacity"),
            xalign: 0
        });
        let tooltipActiveTaskBackgroundColor = _("Active Task Background Color & Opacity\nClick the color button to set the color and opacity of the active task background. This opens a new window with a table of preset colors to choose from. Click the '+' button under 'Custom' to customize color and opacity. Clicking '+' changes the window. In the center is a color picker, the left slider changes color and the bottom slider changes opacity. At the top, a indicator and entry field displays hexadecimal values in the form: #RRGGBB, where RR (red), GG (green) and BB (blue) are values between 00 and FF. When selected, customized colors will be available in all color settings. Back on the 'Tasks (III)' tab, flip the switch next to the color button to activate/deactivate the background color.\nToggle tasks at the 'Overview' tab.");
        labelActiveTaskBackgroundColor.set_tooltip_text(tooltipActiveTaskBackgroundColor);
        this.gridTasks.attach(labelActiveTaskBackgroundColor, 1, 1, 1, 1);
        let activeColor = this.settings.get_string("active-task-background-color");
        let rgbaActive = new Gdk.RGBA();
        rgbaActive.parse(activeColor);
        this.valueActiveTaskBackgroundColor = new Gtk.ColorButton({
            title: "TaskBar - Set Active Task Background Color"
        });
        this.valueActiveTaskBackgroundColor.set_tooltip_text(tooltipActiveTaskBackgroundColor);
        this.valueActiveTaskBackgroundColor.set_use_alpha(true);
        this.valueActiveTaskBackgroundColor.set_rgba(rgbaActive);
        this.valueActiveTaskBackgroundColor.connect('color-set', Lang.bind(this, this.changeActiveTaskBackgroundColor));
        this.gridTasks.attach(this.valueActiveTaskBackgroundColor, 3, 1, 1, 1);
        this.value2ActiveTaskBackgroundColor = new Gtk.Switch({
            active: this.settings.get_boolean("active-task-background-color-set")
        });


        let labelTasksLabel = new Gtk.Label({
            label: _("Tasks Label"),
            xalign: 0
        });
        this.gridTasks.attach(labelTasksLabel, 1, 3, 1, 1);
        this.valueTasksLabel = new Gtk.ComboBoxText();
        this.valueTasksLabel.append_text(_("OFF"));
        this.valueTasksLabel.append_text(_("Window Title"));
        this.valueTasksLabel.append_text(_("App Name"));
        this.valueTasksLabel.set_active(this.settings.get_enum("tasks-label"));
        this.valueTasksLabel.connect('changed', Lang.bind(this, this.changeTasksLabel));
        this.gridTasks.attach(this.valueTasksLabel, 3, 3, 2, 1);

        let labelTasksLabelWidth = new Gtk.Label({
            label: _("Tasks Label Width"),
            xalign: 0
        });
        this.gridTasks.attach(labelTasksLabelWidth, 1, 4, 2, 1);
        this.valueTasksLabelWidth = new Gtk.Adjustment({
            lower: 0,
            upper: 1000,
            step_increment: 1
        });
        let value2TasksLabelWidth = new Gtk.SpinButton({
            adjustment: this.valueTasksLabelWidth,
            snap_to_ticks: true
        });
        value2TasksLabelWidth.set_value(this.settings.get_int("tasks-width"));
        value2TasksLabelWidth.connect("value-changed", Lang.bind(this, this.changeTasksLabelWidth));

        this.gridTasks.attach(value2TasksLabelWidth, 3, 4, 2, 1);
        let labelTasksSpaces = new Gtk.Label({
            label: _("Space between Tasks"),
            xalign: 0
        });
        this.gridTasks.attach(labelTasksSpaces, 1, 6, 2, 1);
        this.valueTasksSpaces = new Gtk.Adjustment({
            lower: 0,
            upper: 1000,
            step_increment: 1
        });
        let value2TasksSpaces = new Gtk.SpinButton({
            adjustment: this.valueTasksSpaces,
            snap_to_ticks: true
        });
        value2TasksSpaces.set_value(this.settings.get_int("tasks-spaces"));
        value2TasksSpaces.connect("value-changed", Lang.bind(this, this.changeTasksSpaces));
        this.gridTasks.attach(value2TasksSpaces, 3, 6, 2, 1);
        //Array of action strings
        let arrayTasksClickMenus = [
            "OFF",
            "Min/Max Task",
            "Open App Menu",
            "Close Task",
            "New Instance"
        ];

        //Left Click actions menu
        let labelLeftClickMenu = new Gtk.Label({
            label: _("Left Click"),
            xalign: 0
        });
        this.gridTasks.attach(labelLeftClickMenu, 1, 7, 1, 1);
        this.valueTasksLeftClickMenu = new Gtk.ComboBoxText();
        arrayTasksClickMenus.forEach(string => {
            this.valueTasksLeftClickMenu.append_text(_(string));
        });
        this.valueTasksLeftClickMenu.set_active(this.settings.get_enum("tasks-left-click"));
        this.valueTasksLeftClickMenu.connect('changed', Lang.bind(this, this.changeTasksLeftClickMenu));
        this.gridTasks.attach(this.valueTasksLeftClickMenu, 3, 7, 2, 1);

        //Middle Click actions menu
        let labelMiddleClickMenu = new Gtk.Label({
            label: _("Middle Click"),
            xalign: 0
        });
        this.gridTasks.attach(labelMiddleClickMenu, 1, 8, 1, 1);
        this.valueTasksMiddleClickMenu = new Gtk.ComboBoxText();
        arrayTasksClickMenus.forEach(string => {
            this.valueTasksMiddleClickMenu.append_text(_(string));
        });
        this.valueTasksMiddleClickMenu.set_active(this.settings.get_enum("tasks-middle-click"));
        this.valueTasksMiddleClickMenu.connect('changed', Lang.bind(this, this.changeTasksMiddleClickMenu));
        this.gridTasks.attach(this.valueTasksMiddleClickMenu, 3, 8, 2, 1);

        //Right Click actions menu
        let labelRightClickMenu = new Gtk.Label({
            label: _("Right Click"),
            xalign: 0
        });
        this.gridTasks.attach(labelRightClickMenu, 1, 9, 1, 1);
        this.valueTasksRightClickMenu = new Gtk.ComboBoxText();
        arrayTasksClickMenus.forEach(string => {
            this.valueTasksRightClickMenu.append_text(_(string));
        });
        this.valueTasksRightClickMenu.set_active(this.settings.get_enum("tasks-right-click"));
        this.valueTasksRightClickMenu.connect('changed', Lang.bind(this, this.changeTasksRightClickMenu));
        this.gridTasks.attach(this.valueTasksRightClickMenu, 3, 9, 2, 1);

        let resetTasksButton = new Gtk.Button({
            label: _("Reset Tasks Tab")
        });
        resetTasksButton.modify_fg(Gtk.StateType.NORMAL, new Gdk.Color({
            red: 65535,
            green: 0,
            blue: 0
        }));
        resetTasksButton.connect('clicked', Lang.bind(this, this.resetTasks));
        resetTasksButton.set_tooltip_text(_("Reset the Tasks (I) Tab to the Original Tasks Settings"));
        this.gridTasks.attach(resetTasksButton, 1, 11, 1, 1);

        let labelSpaceTasks1 = new Gtk.Label({
            label: "\t",
            xalign: 0
        });
        this.gridTasks.attach(labelSpaceTasks1, 0, 12, 1, 1);
        let labelSpaceTasks2 = new Gtk.Label({
            label: "\t",
            xalign: 0,
            hexpand: true
        });
        this.gridTasks.attach(labelSpaceTasks2, 2, 10, 1, 1);
        let labelSpaceTasks3 = new Gtk.Label({
            label: "\t\t",
            xalign: 0
        });
        this.gridTasks.attach(labelSpaceTasks3, 3, 0, 1, 1);
        let labelSpaceTasks4 = new Gtk.Label({
            label: "<b>" + _("Tasks") + "</b>",
            hexpand: true
        });
        labelSpaceTasks4.set_use_markup(true);
        this.gridTasks.attach(labelSpaceTasks4, 0, 0, 6, 1);
        let labelSpaceTasks5 = new Gtk.Label({
            label: "\t",
            xalign: 0
        });
        this.gridTasks.attach(labelSpaceTasks5, 5, 1, 1, 1);


        //
        // Buttons
        //

        this.gridButtons = new Gtk.Grid();
        this.gridButtons.margin = this.gridButtons.row_spacing = 10;
        this.gridButtons.column_spacing = 2;

        let scrollWindowButtons = this.gridButtons;

        scrollWindowButtons.show_all();
        let labelButtons = new Gtk.Label({
            label: _("Buttons")
        });
        notebook.append_page(scrollWindowButtons, labelButtons);


        let labelAppviewButtonIcon = new Gtk.Label({
            label: _("Appview Button Icon"),
            xalign: 0
        });
        this.gridButtons.attach(labelAppviewButtonIcon, 1, 8, 1, 1);
        this.appviewIconFilename = this.settings.get_string("appview-button-icon");
        if (this.appviewIconFilename === 'unset')
            this.appviewIconFilename = APPVIEWICON;
        this.valueAppviewButtonIcon = new Gtk.Image();
        this.loadAppviewIcon();
        this.valueAppviewButtonIcon2 = new Gtk.Button({
            image: this.valueAppviewButtonIcon
        });
        this.valueAppviewButtonIcon2.connect('clicked', Lang.bind(this, this.changeAppviewButtonIcon));
        this.gridButtons.attach(this.valueAppviewButtonIcon2, 4, 8, 1, 1);

        let resetButtonsButton = new Gtk.Button({
            label: _("Reset Buttons Tab")
        });
        resetButtonsButton.modify_fg(Gtk.StateType.NORMAL, new Gdk.Color({
            red: 65535,
            green: 0,
            blue: 0
        }));
        resetButtonsButton.connect('clicked', Lang.bind(this, this.resetButtons));
        resetButtonsButton.set_tooltip_text(_("Reset the Buttons Tab except the Icons to the Original Buttons Settings.\nThe Icons can be Reset within their own Settings."));
        this.gridButtons.attach(resetButtonsButton, 1, 13, 1, 1);

        let labelSpaceButtons1 = new Gtk.Label({
            label: "\t",
            xalign: 0
        });
        this.gridButtons.attach(labelSpaceButtons1, 0, 14, 1, 1);
        let labelSpaceButtons2 = new Gtk.Label({
            label: "\t",
            xalign: 0,
            hexpand: true
        });
        this.gridButtons.attach(labelSpaceButtons2, 2, 1, 1, 1);
        let labelSpaceButtons3 = new Gtk.Label({
            label: "\t",
            xalign: 0
        });
        this.gridButtons.attach(labelSpaceButtons3, 3, 12, 1, 1);
        let labelSpaceButtons4 = new Gtk.Label({
            label: "<b>" + _("Buttons") + "</b>",
            hexpand: true
        });
        labelSpaceButtons4.set_use_markup(true);
        this.gridButtons.attach(labelSpaceButtons4, 0, 0, 7, 1);
        let labelSpaceButtons5 = new Gtk.Label({
            label: "\t",
            xalign: 0
        });
        this.gridButtons.attach(labelSpaceButtons5, 6, 1, 1, 1);

        //
        // Preview
        //

        this.gridPreview = new Gtk.Grid();
        this.gridPreview.margin = this.gridPreview.row_spacing = 10;
        this.gridPreview.column_spacing = 2;

        let scrollWindowPreview = this.gridPreview;

        scrollWindowPreview.show_all();
        let labelPreview = new Gtk.Label({
            label: _("Preview")
        });
        notebook.append_page(scrollWindowPreview, labelPreview);

        let labelDisplayLabel = new Gtk.Label({
            label: _("Tasks Label Preview"),
            xalign: 0
        });
        this.gridPreview.attach(labelDisplayLabel, 1, 1, 1, 1);
        this.valueDisplayLabel = new Gtk.ComboBoxText();
        this.valueDisplayLabel.append_text(_("OFF"));
        this.valueDisplayLabel.append_text(_("App Name"));
        this.valueDisplayLabel.append_text(_("Window Title"));
        this.valueDisplayLabel.append_text(_("App Name &\nWindow Title"));
        this.valueDisplayLabel.set_active(this.settings.get_enum("display-label"));
        this.valueDisplayLabel.connect('changed', Lang.bind(this, this.changeDisplayLabel));
        this.gridPreview.attach(this.valueDisplayLabel, 3, 1, 2, 1);

        let labelDisplayThumbnail = new Gtk.Label({
            label: _("Tasks Thumbnail Preview"),
            xalign: 0
        });
        this.gridPreview.attach(labelDisplayThumbnail, 1, 2, 1, 1);
        this.valueDisplayThumbnail = new Gtk.Switch({
            active: this.settings.get_boolean("display-thumbnail")
        });
        this.valueDisplayThumbnail.set_halign(Gtk.Align.END);
        this.valueDisplayThumbnail.connect('notify::active', Lang.bind(this, this.changeDisplayThumbnail));
        this.gridPreview.attach(this.valueDisplayThumbnail, 4, 2, 1, 1);

        let labelDisplayFavoritesLabel = new Gtk.Label({
            label: _("Favorites Label Preview"),
            xalign: 0
        });
        this.gridPreview.attach(labelDisplayFavoritesLabel, 1, 3, 1, 1);
        this.valueDisplayFavoritesLabel = new Gtk.ComboBoxText();
        this.valueDisplayFavoritesLabel.append_text(_("OFF"));
        this.valueDisplayFavoritesLabel.append_text(_("App Name"));
        this.valueDisplayFavoritesLabel.append_text(_("Description"));
        this.valueDisplayFavoritesLabel.append_text(_("App Name &\nDescription"));
        this.valueDisplayFavoritesLabel.set_active(this.settings.get_enum("display-favorites-label"));
        this.valueDisplayFavoritesLabel.connect('changed', Lang.bind(this, this.changeDisplayFavoritesLabel));
        this.gridPreview.attach(this.valueDisplayFavoritesLabel, 3, 3, 2, 1);

        let labelPreviewSize = new Gtk.Label({
            label: _("Thumbnail Preview Size") + " (350 px)",
            xalign: 0
        });
        this.gridPreview.attach(labelPreviewSize, 1, 4, 1, 1);
        this.valuePreviewSize = new Gtk.Adjustment({
            lower: 100,
            upper: 1000,
            step_increment: 1
        });
        let value2PreviewSize = new Gtk.SpinButton({
            adjustment: this.valuePreviewSize,
            snap_to_ticks: true
        });
        value2PreviewSize.set_value(this.settings.get_int("preview-size"));
        value2PreviewSize.connect("value-changed", Lang.bind(this, this.changePreviewSize));
        this.gridPreview.attach(value2PreviewSize, 3, 4, 2, 1);

        let labelPreviewDelay = new Gtk.Label({
            label: _("Preview Delay") + " (500 ms)",
            xalign: 0
        });
        this.gridPreview.attach(labelPreviewDelay, 1, 5, 2, 1);
        this.valuePreviewDelay = new Gtk.Adjustment({
            lower: 0,
            upper: 10000,
            step_increment: 1
        });
        let value2PreviewDelay = new Gtk.SpinButton({
            adjustment: this.valuePreviewDelay,
            snap_to_ticks: true
        });
        value2PreviewDelay.set_value(this.settings.get_int("preview-delay"));
        value2PreviewDelay.connect("value-changed", Lang.bind(this, this.changePreviewDelay));
        this.gridPreview.attach(value2PreviewDelay, 3, 5, 2, 1);

        let labelDisplayPreviewBackgroundColor = new Gtk.Label({
            label: _("Preview Background Color"),
            xalign: 0
        });
        this.gridPreview.attach(labelDisplayPreviewBackgroundColor, 1, 6, 1, 1);
        let colorPreviewBackground = this.settings.get_string("preview-background-color");
        this.valuePreviewBackgroundColor = new Gtk.ColorButton({
            title: "TaskBar - Set Preview Background Color"
        });
        this.valuePreviewBackgroundColor.set_use_alpha(true);
        let rgbaPreviewBackground = new Gdk.RGBA();
        if (colorPreviewBackground === 'unset')
            colorPreviewBackground = RESETCOLORBLACK;
        rgbaPreviewBackground.parse(colorPreviewBackground);
        this.valuePreviewBackgroundColor.set_rgba(rgbaPreviewBackground);
        this.valuePreviewBackgroundColor.connect('color-set', Lang.bind(this, this.changePreviewBackgroundColor));
        this.gridPreview.attach(this.valuePreviewBackgroundColor, 3, 6, 1, 1);
        this.valueDisplayPreviewBackgroundColor = new Gtk.Switch({
            active: this.settings.get_boolean("display-preview-background-color")
        });
        this.valueDisplayPreviewBackgroundColor.set_halign(Gtk.Align.END);
        this.valueDisplayPreviewBackgroundColor.set_valign(Gtk.Align.CENTER);
        this.valueDisplayPreviewBackgroundColor.connect('notify::active', Lang.bind(this, this.displayPreviewBackgroundColor));
        this.gridPreview.attach(this.valueDisplayPreviewBackgroundColor, 4, 6, 1, 1);

        let labelDisplayPreviewLabelColor = new Gtk.Label({
            label: _("Preview Label Color"),
            xalign: 0
        });
        this.gridPreview.attach(labelDisplayPreviewLabelColor, 1, 7, 1, 1);
        let colorPreviewLabel = this.settings.get_string("preview-label-color");
        this.valuePreviewLabelColor = new Gtk.ColorButton({
            title: "TaskBar - Set Preview Label Color"
        });
        this.valuePreviewLabelColor.set_use_alpha(true);
        let rgbaPreviewLabel = new Gdk.RGBA();
        if (colorPreviewLabel === 'unset')
            colorPreviewLabel = RESETCOLORWHITE;
        rgbaPreviewLabel.parse(colorPreviewLabel);
        this.valuePreviewLabelColor.set_rgba(rgbaPreviewLabel);
        this.valuePreviewLabelColor.connect('color-set', Lang.bind(this, this.changePreviewLabelColor));
        this.gridPreview.attach(this.valuePreviewLabelColor, 3, 7, 1, 1);
        this.valueDisplayPreviewLabelColor = new Gtk.Switch({
            active: this.settings.get_boolean("display-preview-label-color")
        });
        this.valueDisplayPreviewLabelColor.set_halign(Gtk.Align.END);
        this.valueDisplayPreviewLabelColor.set_valign(Gtk.Align.CENTER);
        this.valueDisplayPreviewLabelColor.connect('notify::active', Lang.bind(this, this.displayPreviewLabelColor));
        this.gridPreview.attach(this.valueDisplayPreviewLabelColor, 4, 7, 1, 1);

        let labelPreviewFontSize = new Gtk.Label({
            label: _("Preview Font Size") + " (9 pt)",
            xalign: 0
        });
        this.gridPreview.attach(labelPreviewFontSize, 1, 8, 2, 1);
        this.valuePreviewFontSize = new Gtk.Adjustment({
            lower: 1,
            upper: 96,
            step_increment: 1
        });
        let value2PreviewFontSize = new Gtk.SpinButton({
            adjustment: this.valuePreviewFontSize,
            snap_to_ticks: true
        });
        value2PreviewFontSize.set_value(this.settings.get_int("preview-font-size"));
        value2PreviewFontSize.connect("value-changed", Lang.bind(this, this.changePreviewFontSize));
        this.gridPreview.attach(value2PreviewFontSize, 3, 8, 2, 1);

        let resetPreviewButton = new Gtk.Button({
            label: _("Reset Preview Tab")
        });
        resetPreviewButton.modify_fg(Gtk.StateType.NORMAL, new Gdk.Color({
            red: 65535,
            green: 0,
            blue: 0
        }));
        resetPreviewButton.connect('clicked', Lang.bind(this, this.resetPreview));
        resetPreviewButton.set_tooltip_text(_("Reset the Preview Tab to the Original Preview Settings"));
        this.gridPreview.attach(resetPreviewButton, 1, 10, 1, 1);

        let labelSpacePreview1 = new Gtk.Label({
            label: "\t",
            xalign: 0
        });
        this.gridPreview.attach(labelSpacePreview1, 0, 11, 1, 1);
        let labelSpacePreview2 = new Gtk.Label({
            label: "\t",
            xalign: 0,
            hexpand: true
        });
        this.gridPreview.attach(labelSpacePreview2, 2, 1, 1, 1);
        let labelSpacePreview3 = new Gtk.Label({
            label: "\t",
            xalign: 0
        });
        this.gridPreview.attach(labelSpacePreview3, 3, 9, 1, 1);
        let labelSpacePreview4 = new Gtk.Label({
            label: "<b>" + _("Preview") + "</b>",
            hexpand: true
        });
        labelSpacePreview4.set_use_markup(true);
        this.gridPreview.attach(labelSpacePreview4, 0, 0, 6, 1);
        let labelSpacePreview5 = new Gtk.Label({
            label: "\t",
            xalign: 0
        });
        this.gridPreview.attach(labelSpacePreview5, 5, 1, 1, 1);

        this.gridKeybindings = new Gtk.Grid();
        this.gridKeybindings.margin = this.gridKeybindings.row_spacing = 10;
        this.gridKeybindings.column_spacing = 2;

        /* //Key binding
         let scrollWindowKeybindings = this.gridKeybindings;

         scrollWindowKeybindings.show_all();
         let labelKeybindings = new Gtk.Label({
             label: _("Keybindings")
         });
         notebook.append_page(scrollWindowKeybindings, labelKeybindings);

         let model = new Gtk.ListStore();
         model.set_column_types([
             GObject.TYPE_STRING,
             GObject.TYPE_STRING,
             GObject.TYPE_INT,
             GObject.TYPE_INT
         ]);
         let key;
         let settings = this.settings;
         for (key in pretty_names) {
             this.append_hotkey(model, settings, key, pretty_names[key]);
         }
         let treeview = new Gtk.TreeView({
             'expand': true,
             'model': model
         });
         let col;
         let cellrend;
         cellrend = new Gtk.CellRendererText();
         col = new Gtk.TreeViewColumn({
             'title': 'Keybinding',
             'expand': true
         });
         col.pack_start(cellrend, true);
         col.add_attribute(cellrend, 'text', 1);
         treeview.append_column(col);
         cellrend = new Gtk.CellRendererAccel({
             'editable': true,
             'accel-mode': Gtk.CellRendererAccelMode.GTK
         });
         cellrend.connect('accel-edited', function (rend, iter, key, mods) {
             let value = Gtk.accelerator_name(key, mods);
             let success = false;
             [success, iter] = model.get_iter_from_string(iter);
             if (!success) {
                 throw new Error("Something be broken, yo.");
             }
             let name = model.get_value(iter, 0);
             model.set(iter, [2, 3], [mods, key]);
             settings.set_strv(name, [value]);
         });
         cellrend.connect('accel-cleared', function (rend, iter, key, mods) {
             let success = false;
             [success, iter] = model.get_iter_from_string(iter);
             if (!success) {
                 throw new Error("Error clearing keybinding");
             }
             let name = model.get_value(iter, 0);
             model.set(iter, [2, 3], [0, 0]);
             settings.set_strv(name, ['']);
         });
         col = new Gtk.TreeViewColumn({
             'title': 'Accel'
         });
         col.pack_end(cellrend, false);
         col.add_attribute(cellrend, 'accel-mods', 2);
         col.add_attribute(cellrend, 'accel-key', 3);
         treeview.append_column(col);
         this.gridKeybindings.attach(treeview, 1, 1, 5, 1);

         let labelBackspace = new Gtk.Label({
             label: _("Backspace to disable Keybindings"),
             xalign: 0
         });
         this.gridKeybindings.attach(labelBackspace, 1, 2, 5, 1);

         let labelSpaceKeybindings1 = new Gtk.Label({
             label: "\t",
             xalign: 0
         });
         this.gridKeybindings.attach(labelSpaceKeybindings1, 2, 3, 1, 1);
         let labelSpaceKeybindings2 = new Gtk.Label({
             label: "<b>" + _("Keybindings") + "</b>",
             hexpand: true
         });
         labelSpaceKeybindings2.set_use_markup(true);
         this.gridKeybindings.attach(labelSpaceKeybindings2, 0, 0, 7, 1);*/

        this.gridMisc = new Gtk.Grid();
        this.gridMisc.margin = this.gridMisc.row_spacing = 10;
        this.gridMisc.column_spacing = 2;

        let scrollWindowMisc = this.gridMisc;

        scrollWindowMisc.show_all();
        let labelMisc = new Gtk.Label({
            label: _("Misc")
        });
        notebook.append_page(scrollWindowMisc, labelMisc);



        let labelDisplayApplicationMenu = new Gtk.Label({
            label: _("Application Menu"),
            xalign: 0
        });
        this.gridMisc.attach(labelDisplayApplicationMenu, 1, 3, 1, 1);
        this.valueDisplayApplicationMenu = new Gtk.Switch({
            active: this.settings.get_boolean("application-menu")
        });
        this.valueDisplayApplicationMenu.set_halign(Gtk.Align.END);
        this.valueDisplayApplicationMenu.set_valign(Gtk.Align.CENTER);
        this.valueDisplayApplicationMenu.connect('notify::active', Lang.bind(this, this.changeDisplayApplicationMenu));
        this.gridMisc.attach(this.valueDisplayApplicationMenu, 3, 3, 1, 1);


        let labelDisplayDateMenu = new Gtk.Label({
            label: _("Date Menu"),
            xalign: 0
        });
        this.gridMisc.attach(labelDisplayDateMenu, 1, 4, 1, 1);
        this.valueDisplayDateMenu = new Gtk.Switch({
            active: this.settings.get_boolean("date-menu")
        });
        this.valueDisplayDateMenu.set_halign(Gtk.Align.END);
        this.valueDisplayDateMenu.set_valign(Gtk.Align.CENTER);
        this.valueDisplayDateMenu.connect('notify::active', Lang.bind(this, this.changeDisplayDateMenu));
        this.gridMisc.attach(this.valueDisplayDateMenu, 3, 4, 1, 1);


        let labelDisplaySystemMenu = new Gtk.Label({
            label: _("System Menu"),
            xalign: 0
        });
        this.gridMisc.attach(labelDisplaySystemMenu, 1, 5, 1, 1);
        this.valueDisplaySystemMenu = new Gtk.Switch({
            active: this.settings.get_boolean("system-menu")
        });
        this.valueDisplaySystemMenu.set_halign(Gtk.Align.END);
        this.valueDisplaySystemMenu.set_valign(Gtk.Align.CENTER);
        this.valueDisplaySystemMenu.connect('notify::active', Lang.bind(this, this.changeDisplaySystemMenu));
        this.gridMisc.attach(this.valueDisplaySystemMenu, 3, 5, 1, 1);


        let labelEnableHotCorner = new Gtk.Label({
            label: _("Hot Corner"),
            xalign: 0
        });
        this.gridMisc.attach(labelEnableHotCorner, 1, 6, 1, 1);
        this.valueEnableHotCorner = new Gtk.Switch({
            active: this.settingsDesktop.get_boolean("enable-hot-corners")
        });
        this.valueEnableHotCorner.connect('notify::active', Lang.bind(this, this.changeEnableHotCorner));
        this.gridMisc.attach(this.valueEnableHotCorner, 3, 6, 1, 1);

        let labelDisplayDash = new Gtk.Label({
            label: _("Dash (require restart)"),
            xalign: 0
        });
        this.gridMisc.attach(labelDisplayDash, 1, 7, 1, 1);
        this.valueDisplayDash = new Gtk.Switch({
            active: this.settings.get_boolean("dash")
        });
        this.valueDisplayDash.connect('notify::active', Lang.bind(this, this.changeDisplayDash));
        this.gridMisc.attach(this.valueDisplayDash, 3, 7, 1, 1);


        let labelDisplayWorkspaceSelector = new Gtk.Label({
            label: _("Workspace Selector"),
            xalign: 0
        });
        this.gridMisc.attach(labelDisplayWorkspaceSelector, 1, 8, 1, 1);
        this.valueDisplayWorkspaceSelector = new Gtk.Switch({
            active: this.settings.get_boolean("workspace-selector")
        });
        this.valueDisplayWorkspaceSelector.connect('notify::active', Lang.bind(this, this.changeDisplayWorkspaceSelector));
        this.gridMisc.attach(this.valueDisplayWorkspaceSelector, 3, 8, 1, 1);

        let resetBgButton = new Gtk.Button({
            label: _("Match login background")
        });
        resetBgButton.modify_fg(Gtk.StateType.NORMAL, new Gdk.Color({
            red: 65535,
            green: 0,
            blue: 65535
        }));
        resetBgButton.connect('clicked', Lang.bind(this, this.resetLoginBackground));
        resetBgButton.set_tooltip_text(_("Reset the login background to current desktop background"));
        this.gridMisc.attach(resetBgButton, 1, 10, 1, 1);

        let resetMiscButton = new Gtk.Button({
            label: _("Reset Misc Tab")
        });
        resetMiscButton.modify_fg(Gtk.StateType.NORMAL, new Gdk.Color({
            red: 65535,
            green: 0,
            blue: 0
        }));
        resetMiscButton.connect('clicked', Lang.bind(this, this.resetMisc));
        resetMiscButton.set_tooltip_text(_("Reset the Misc Tab to the Original Misc Settings"));
        this.gridMisc.attach(resetMiscButton, 1, 11, 1, 1);

        let labelSpaceMisc1 = new Gtk.Label({
            label: "\t",
            xalign: 0
        });
        this.gridMisc.attach(labelSpaceMisc1, 0, 12, 1, 1);
        let labelSpaceMisc2 = new Gtk.Label({
            label: "\t",
            xalign: 0,
            hexpand: true
        });
        this.gridMisc.attach(labelSpaceMisc2, 2, 1, 1, 1);
        let labelSpaceMisc3 = new Gtk.Label({
            label: "<b>" + _("Misc") + "</b>",
            hexpand: true
        });
        labelSpaceMisc3.set_use_markup(true);
        this.gridMisc.attach(labelSpaceMisc3, 0, 0, 8, 1);
        let labelSpaceMisc4 = new Gtk.Label({
            label: "\t",
            xalign: 0
        });
        this.gridMisc.attach(labelSpaceMisc4, 4, 10, 1, 1);
        let labelSpaceMisc5 = new Gtk.Label({
            label: "\t",
            xalign: 0
        });
        this.gridMisc.attach(labelSpaceMisc5, 7, 10, 1, 1);

        this.gridGPL = new Gtk.Grid();
        this.gridGPL.margin = this.gridGPL.row_spacing = 10;
        this.gridGPL.column_spacing = 2;

        let scrollWindowGPL = this.gridGPL;

        scrollWindowGPL.show_all();
        let labelTitleGPL = new Gtk.Label({
            label: _("GNU GPL")
        });
        notebook.append_page(scrollWindowGPL, labelTitleGPL);

        let gplImage = new Gtk.Image({
            file: GPLICON,
            xalign: 1
        });
        let gplSpacer = new Gtk.Image({
            file: SPACERICON
        });

        let labelGPL = new Gtk.Label({
            label: "ubuntuvn-desktop\nCopyright (C) 2020 Ubuntuvn respin\n\nModule included: material-shell@papyelgringo \nInspired by: simple-task-bar@fthx, TaskBar@c0ldplasma, dynamic-panel-transparency \n\n\n This program is free software: you can redistribute it and/or modify\nit under the terms of the GNU General Public License as published by\nthe Free Software Foundation, either version 3 of the License, or\n(at your option) any later version.\n\nThis program is distributed in the hope that it will be useful,\nbut WITHOUT ANY WARRANTY; without even the implied warranty of\nMERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the\nGNU General Public License for more details.\n\nYou should have received a copy of the GNU General Public License\nalong with this program. If not, see",
            xalign: 0
        });
        let labelLinkGPL = new Gtk.LinkButton({
            image: gplSpacer,
            label: "https://www.gnu.org/licenses/",
            uri: "https://www.gnu.org/licenses/",
            xalign: 0
        });
        this.gridGPL.attach(labelGPL, 1, 1, 2, 1);
        this.gridGPL.attach(labelLinkGPL, 1, 2, 1, 1);
        this.gridGPL.attach(gplImage, 2, 3, 1, 1);

        let labelSpaceGPL1 = new Gtk.Label({
            label: "\t",
            xalign: 0
        });
        this.gridGPL.attach(labelSpaceGPL1, 0, 1, 1, 1);
        let labelSpaceGPL2 = new Gtk.Label({
            label: "\t",
            xalign: 0,
            hexpand: true
        });
        this.gridGPL.attach(labelSpaceGPL2, 2, 1, 1, 1);
        let labelSpaceGPL3 = new Gtk.Label({
            label: "<b>" + _("GNU General Public License") + "</b>",
            hexpand: true
        });
        labelSpaceGPL3.set_use_markup(true);
        this.gridGPL.attach(labelSpaceGPL3, 0, 0, 4, 1);
        let labelSpaceGPL4 = new Gtk.Label({
            label: "\t",
            xalign: 0
        });
        this.gridGPL.attach(labelSpaceGPL4, 3, 4, 1, 1);

        notebook.set_current_page(1);
        notebook.show_all();
        return notebook;
    },

    changeDisplayTasks: function (object, pspec) {
        this.settings.set_boolean("display-tasks", object.active);
    },

    changeDisplayWorkspaceButton: function (object, pspec) {
        this.settings.set_boolean("display-workspace-button", object.active);
    },


    changeDisplayFavorites: function (object, pspec) {
        this.settings.set_boolean("display-favorites", object.active);
    },
    onHoverEvent: function (object) {
        this.hoverComponent = this.settings.get_enum("appearance-selection");
        this.settings.set_int("hover-event", this.hoverComponent + 1);
    },


    changeTasksSpaces: function(object) {
        this.settings.set_int("tasks-spaces", this.valueTasksSpaces.get_value());
    },

    changeDynamicTransparent: function (object, pspec) {
        this.settings.set_boolean("dynamic-transparent", object.active);
    },

    changeBottomPanel: function (object, pspec) {
        //check dock enable or not
        if (this.settings.get_boolean("dock-enable") && object.active) {
            this.settings.set_boolean("dock-enable", false);
            this.valueDock.active = false;
        }
        this.settings.set_boolean("bottom-panel", object.active);
    },
    changeDock: function (object, pspec) {
        if (this.settings.get_boolean("bottom-panel") && object.active) {
            this.settings.set_boolean("bottom-panel", false);
            this.valueBottomPanel.active = false;
        }
        this.settings.set_boolean("dock-enable", object.active);
    },
    changeHidePanel: function (object, pspec) {
        if (!this.settings.get_boolean("bottom-panel"))
            this.settings.set_boolean("hide-panel-enable", object.active);
    },
    checkAvaillableExtension: function (extensionName) {
        let schemaSettings = new Gio.Settings({
            schema: 'org.gnome.shell'
        });
        let enabled_extensions = schemaSettings.get_strv('enabled-extensions');
        let disabled_extensions = schemaSettings.get_strv('disabled-extensions');
        if (enabled_extensions.indexOf(extensionName) !== -1) {
            return true;
        }
        if (disabled_extensions.indexOf(extensionName) !== -1) {
            return true;
        }

        return false;

    },

    checkEnabledExtension: function (extensionName) {
        let schemaSettings = new Gio.Settings({
            schema: 'org.gnome.shell'
        });
        let enabled_extensions = schemaSettings.get_strv('enabled-extensions');
        if (enabled_extensions.indexOf(extensionName) !== -1) {
            return true;
        }
        return false;

    },

    changeIconSize: function (object) {
        this.settings.set_int("panel-size", this.valueIconSize.get_value());
    },

    changeDockSize: function (object) {
        this.settingsDock.set_int("dash-max-icon-size", this.valueDockSize.get_value());
    },


    changeTasksLabel: function (object) {
        this.settings.set_enum("tasks-label", this.valueTasksLabel.get_active());
    },

    changeTasksLabelWidth: function (object) {
        this.settings.set_int("tasks-width", this.valueTasksLabelWidth.get_value());
    },



    changeTasksLeftClickMenu: function (object) {
        this.settings.set_enum("tasks-left-click", this.valueTasksLeftClickMenu.get_active());
    },

    changeTasksMiddleClickMenu: function (object) {
        this.settings.set_enum("tasks-middle-click", this.valueTasksMiddleClickMenu.get_active());
    },

    changeTasksRightClickMenu: function (object) {
        this.settings.set_enum("tasks-right-click", this.valueTasksRightClickMenu.get_active());
    },


    changeActiveTaskBackgroundColor: function () {
        this.backgroundColor = this.valueActiveTaskBackgroundColor.get_rgba().to_string();
        this.settings.set_string("active-task-background-color", this.backgroundColor);
    },
    changePanelBackgroundColor: function () {
        this.backgroundColor = this.valuePanelBackgroundColor.get_rgba().to_string();
        this.settings.set_string("panel-background-color", this.backgroundColor);
    },




    changeDockPosition: function (object) {
        this.settingsDock.set_enum("dock-position", this.valueDockPosition.get_active());
    },


    displayWorkspaceButtonColor: function (object, pspec) {
        this.settings.set_boolean("display-workspace-button-color", object.active);
    },



    changeAppviewButtonIcon: function () {
        let iconPath = this.settings.get_string("appview-button-icon");
        this.dialogAppviewIcon = new Gtk.FileChooserDialog({
            title: _("Ubuntuvn - Set Appview Button Icon"),
            action: Gtk.FileChooserAction.OPEN
        });
        this.dialogAppviewIcon.add_button(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL);
        this.dialogAppviewIcon.add_button(Gtk.STOCK_OPEN, Gtk.ResponseType.ACCEPT);
        this.dialogAppviewIcon.add_button("RESET", Gtk.ResponseType.NONE);
        this.dialogAppviewIcon.set_filename(iconPath);
        this.preview = new Gtk.Image();
        this.dialogAppviewIcon.set_preview_widget(this.preview);
        this.dialogAppviewIcon.set_use_preview_label(false);
        this.initAppviewIconPath = iconPath;
        this.loadAppviewIconPreview();
        this.initAppviewIconPath = null;
        this.updatePreview = this.dialogAppviewIcon.connect("update-preview", Lang.bind(this, this.loadAppviewIconPreview));
        let filter = new Gtk.FileFilter();
        filter.set_name(_("Images"));
        filter.add_pattern("*.png");
        filter.add_pattern("*.jpg");
        filter.add_pattern("*.gif");
        filter.add_pattern("*.svg");
        filter.add_pattern("*.ico");
        this.dialogAppviewIcon.add_filter(filter);
        let response = this.dialogAppviewIcon.run();
        if (response === -3) {
            this.appviewIconFilename = this.dialogAppviewIcon.get_filename();
            if (this.appviewIconFilename !== iconPath) {
                iconPath = this.appviewIconFilename;
                this.loadAppviewIcon();
            }
        }
        if (response === -1) {
            this.appviewIconFilename = APPVIEWICON;
            this.loadAppviewIcon();
        }
        this.dialogAppviewIcon.disconnect(this.updatePreview);
        this.dialogAppviewIcon.destroy();
    },

    loadAppviewIcon: function () {
        let pixbuf;
        try {
            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(this.appviewIconFilename, 24, 24, null);
        } catch (e) {
            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(APPVIEWICON, 24, 24, null);
            this.appviewIconFilename = APPVIEWICON;
        }
        this.valueAppviewButtonIcon.set_from_pixbuf(pixbuf);
        let settings = this.settings.get_string("appview-button-icon");
        if (this.appviewIconFilename !== settings)
            this.settings.set_string("appview-button-icon", this.appviewIconFilename);
    },

    loadAppviewIconPreview: function () {
        let pixbuf;
        if (this.initAppviewIconPath !== null)
            this.previewFilename = this.initAppviewIconPath;
        else
            this.previewFilename = this.dialogAppviewIcon.get_preview_filename();
        try {
            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(this.previewFilename, 48, 48, null);
            this.preview.set_from_pixbuf(pixbuf);
            have_preview = true;
        } catch (e) {
            have_preview = false;
        }
        this.dialogAppviewIcon.set_preview_widget_active(have_preview);
    },


    changeEnableHotCorner: function (object, pspec) {
        this.settingsDesktop.set_boolean("enable-hot-corners", object.active);
    },

    changeDisplayApplicationMenu: function (object, pspec) {
        this.settings.set_boolean("application-menu", object.active);
    },



    changeDisplayDateMenu: function (object, pspec) {
        this.settings.set_boolean("date-menu", object.active);
    },

    changeDisplaySystemMenu: function (object, pspec) {
        this.settings.set_boolean("system-menu", object.active);
    },

    changeDisplayDash: function (object, pspec) {
        this.settings.set_boolean("dash", object.active);
    },

    changeDisplayWorkspaceSelector: function (object, pspec) {
        this.settings.set_boolean("workspace-selector", object.active);
    },

    changeDisplayLabel: function (object) {
        this.settings.set_enum("display-label", this.valueDisplayLabel.get_active());
    },

    changeDisplayThumbnail: function (object, pspec) {
        this.settings.set_boolean("display-thumbnail", object.active);
    },

    changeDisplayFavoritesLabel: function (object) {
        this.settings.set_enum("display-favorites-label", this.valueDisplayFavoritesLabel.get_active());
    },

    changePreviewSize: function (object) {
        this.settings.set_int("preview-size", this.valuePreviewSize.get_value());
    },

    changePreviewDelay: function (object) {
        this.settings.set_int("preview-delay", this.valuePreviewDelay.get_value());
    },

    changePreviewBackgroundColor: function () {
        this.previewBackgroundColor = this.valuePreviewBackgroundColor.get_rgba().to_string();
        this.settings.set_string("preview-background-color", this.previewBackgroundColor);
    },

    displayPreviewBackgroundColor: function (object, pspec) {
        this.settings.set_boolean("display-preview-background-color", object.active);
    },

    changePreviewLabelColor: function () {
        this.previewLabelColor = this.valuePreviewLabelColor.get_rgba().to_string();
        this.settings.set_string("preview-label-color", this.previewLabelColor);
    },

    displayPreviewLabelColor: function (object, pspec) {
        this.settings.set_boolean("display-preview-label-color", object.active);
    },

    changePreviewFontSize: function (object) {
        this.settings.set_int("preview-font-size", this.valuePreviewFontSize.get_value());
    },


    exportSettings: function () {
        this.settings.set_boolean("export-settings", true);
    },

    importSettings: function () {
        this.settings.set_boolean("import-settings", true);
    },

    resetLoginBackground: function () {
        this.settings.set_boolean("reset-login-background", true);
    },

    resetComponents: function () {
        this.settings.set_boolean("reset-flag", true);
        this.valueDisplayTasks.set_active(true);
        this.valueDisplayWorkspaceButton.set_active(false);
        //this.valueDisplayShowAppsButton.set_active(true);
        //this.valueDisplayFavorites.set_active(false);
        this.settings.set_int("hover-event", 0);
        //this.valueAppearance.set_active(0);
        this.settings.set_int("position-tasks", 4);
        //this.settings.set_int("position-desktop-button", 3);
        this.settings.set_int("position-workspace-button", 2);
        this.settings.set_int("position-appview-button", 1);
        //this.settings.set_int("position-favorites", 0);
        //this.valueTopPanel.set_active(true);
        this.valueBottomPanel.set_active(false);
        this.valueDock.set_active(false);
        this.settings.set_boolean("position-changed", true);
        this.settings.set_boolean("reset-flag", false);
    },

    resetTasks: function () {
        this.settings.set_boolean("reset-flag", true);
        this.settings.set_string("active-task-background-color", "rgba(214,209,209,0.323843)");
        //this.valueAllWorkspaces.set_active(false);
        // this.valueSortTasks.set_active(0);
        this.valueTasksLabel.set_active(0);
        this.valueTasksLabelWidth.set_value(150);
        // this.valueTasksContainerWidth.set_value(0);
        // this.valueTasksSpaces.set_value(12);
        this.valueTasksLeftClickMenu.set_active(1);
        this.valueTasksMiddleClickMenu.set_active(0);
        this.valueTasksRightClickMenu.set_active(2);
        this.settings.set_boolean("reset-flag", false);
    },


    resetButtons: function () {
        this.valueDesktopButtonRightClick.set_active(true);
        this.valueWorkspaceButtonIndex.set_active(0);
        this.valueScrollWorkspaces.set_active(0);
        let color = RESETCOLORWHITE;
        let rgba = new Gdk.RGBA();
        rgba.parse(color);
        this.valueWorkspaceButtonColor.set_rgba(rgba);
        this.settings.set_string("workspace-button-color", "unset");
        this.valueDisplayWorkspaceButtonColor.set_active(false);
        this.valueWorkspaceButtonWidth.set_value(0);
        this.valueShowAppsButtonToggle.set_active(0);
    },


    resetPreview: function () {
        this.settings.set_boolean("reset-flag", true);
        this.valueDisplayLabel.set_active(3);
        this.valueDisplayThumbnail.set_active(true);
        this.valueDisplayFavoritesLabel.set_active(3);
        this.valuePreviewSize.set_value(350);
        this.valuePreviewDelay.set_value(500);
        this.valuePreviewFontSize.set_value(9);
        let color = 'rgba(239,239,239,0.87)';
        let rgba = new Gdk.RGBA();
        rgba.parse(color);
        this.valuePreviewBackgroundColor.set_rgba(rgba);
        this.settings.set_string("preview-background-color", "rgba(239,239,239,0.87)");
        this.valueDisplayPreviewBackgroundColor.set_active(true);
        let color2 = 'rgb(85,87,83)';
        let rgba2 = new Gdk.RGBA();
        rgba2.parse(color2);
        this.valuePreviewLabelColor.set_rgba(rgba2);
        this.settings.set_string("preview-label-color", "rgb(85,87,83)");
        this.valueDisplayPreviewLabelColor.set_active(true);
        this.settings.set_boolean("reset-flag", false);
    },

    resetMisc: function () {
        this.settings.set_boolean("reset-flag", true);
        let color = RESETCOLOR;
        let rgba = new Gdk.RGBA();
        rgba.parse(color);
        /*		this.valueDisplayActivitiesButton.set_active(false);
                this.valueActivitiesColor.set_rgba(rgba);
                this.settings.set_string("activities-button-color", "unset");*/
        this.valueDisplayApplicationMenu.set_active(false);
        this.valueApplicationMenuColor.set_rgba(rgba);
        this.settings.set_string("application-menu-color", "unset");
        this.valueDisplayDateMenu.set_active(true);
        this.valueDateMenuColor.set_rgba(rgba);
        this.settings.set_string("date-menu-color", "unset");
        this.valueDisplaySystemMenu.set_active(true);
        this.valueSystemMenuColor.set_rgba(rgba);
        this.settings.set_string("system-menu-color", "unset");
        //this.valueDisplayDash.set_active(true);
        this.valueDisplayWorkspaceSelector.set_active(true);
        this.valueOverview.set_active(false);
        this.settings.set_boolean("reset-flag", false);
    },

    resetAll: function () {
        this.settings.set_boolean("reset-all", true);
    }
}
