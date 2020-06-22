//  ubuntuvn-desktop
//  Copyright (C) 2013-2018 zpydr
//  Copyright (C) 2020 c0ldplasma (Taskbar 2020)
//	Copyright (C) 2020 PapyElGringo (Gnome material shell)
//  Copyright (C) 2020 Ubuntuvn respin - https://ubuntuvn.com
//
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
//	For more information: https://ubuntuvn.com
//

const Lang = imports.lang;

function Windows(callBackThis, callbackWindowsListChanged, callbackWindowChanged) {
    this.init(callBackThis, callbackWindowsListChanged, callbackWindowChanged);
}

Windows.prototype = {
    workspace: null,
    windowsList: [],
    callBackThis: null,
    callbackWindowsListChanged: null,
    callbackWindowChanged: null,
    workspaceSwitchSignal: null,
    windowAddedSignal: null,
    windowRemovedSignal: null,
    windowsSignals: [],

    init: function (callBackThis, callbackWindowsListChanged, callbackWindowChanged) {
        //Set User Callback
        this.callBackThis = callBackThis;
        this.callbackWindowsListChanged = callbackWindowsListChanged;
        this.callbackWindowChanged = callbackWindowChanged;

        //Init WindowsList
        this.workspaceSignals = new Map();
        this.buildWindowsList();
        this.onWorkspaceChanged();

        //Add window manager signals
        this.workspaceSwitchSignal = global.workspace_manager.connect('workspace-switched', Lang.bind(this, this.buildWindowsList));
        this.nWorkspacesSignal = global.workspace_manager.connect('notify::n-workspaces', Lang.bind(this, this.onWorkspaceChanged));
    },

    destruct: function () {
        //Remove window manager signals
        let numWorkspaces = global.workspace_manager.n_workspaces;
        for (let i = 0; i < numWorkspaces; i++) {
            let workspace = global.workspace_manager.get_workspace_by_index(i);
            let signals = this.workspaceSignals.get(workspace);
            this.workspaceSignals.delete(workspace);
            workspace.disconnect(signals.windowAddedId);
            workspace.disconnect(signals.windowRemovedId);
        }

        //Clean windows list
        this.cleanWindowsList();
    },

    onWorkspaceChanged: function () {
        let numWorkspaces = global.workspace_manager.n_workspaces;
        for (let i = 0; i < numWorkspaces; i++) {
            let workspace = global.workspace_manager.get_workspace_by_index(i);
            if (this.workspaceSignals.has(workspace))
                continue;
            let signals = {
                windowAddedId: 0,
                windowRemovedId: 0
            };
            signals.windowAddedId = workspace.connect_after('window-added', Lang.bind(this, this.buildWindowsList));
            signals.windowRemovedId = workspace.connect('window-removed', Lang.bind(this, this.buildWindowsList));
            this.workspaceSignals.set(workspace, signals);
        }
    },

    buildWindowsList: function () {
        //Clean windows list
        this.cleanWindowsList();

        //Build windows list
        let totalWorkspaces = global.workspace_manager.n_workspaces;
        for (let i = 0; i < totalWorkspaces; i++) {
            let activeWorkspace = global.workspace_manager.get_workspace_by_index(i);
            activeWorkspace.list_windows().sort(this.sortWindowsCompareFunction).forEach(
                function (window) {
                    this.addWindowInList(window);
                },
                this
            );
        }

        //Call User Callback
        this.callbackWindowsListChanged.call(this.callBackThis, this.windowsList, 0, null);
    },

    sortWindowsCompareFunction: function (windowA, windowB) {
        return windowA.get_stable_sequence() > windowB.get_stable_sequence();
    },

    onWindowChanged: function (window, object, type) {
        if (type === 0) { //Focus changed
            if (window.appears_focused) {
                this.callbackWindowChanged.call(this.callBackThis, window, 0);
            }
        } else if (type === 1) { //Title changed
            this.callbackWindowChanged.call(this.callBackThis, window, 1);
        } else if (type === 2) { //Minimized
            this.callbackWindowChanged.call(this.callBackThis, window, 2);
        } else if (type === 3) { //Icon
            this.callbackWindowChanged.call(this.callBackThis, window, 3);
        } else if (type === 4) { //Icon
            this.callbackWindowChanged.call(this.callBackThis, window, 4);
        }
    },

    searchWindowInList: function (window) {
        let index = null;
        for (let indexWindow in this.windowsList) {
            if (this.windowsList[indexWindow] === window) {
                index = indexWindow;
                break;
            }
        }
        return index;
    },

    addWindowInList: function (window) {
        let index = this.searchWindowInList(window);
        if (index === null && !window.is_skip_taskbar()) {
            this.windowsList.push(window);

            //Add window signals
            let objectAndSignals = [
                window, [
                    window.connect('notify::appears-focused', Lang.bind(this, this.onWindowChanged, 0)),
                    window.connect('notify::title', Lang.bind(this, this.onWindowChanged, 1)),
                    window.connect('notify::minimized', Lang.bind(this, this.onWindowChanged, 2)),
                    window.connect('notify::wm-class', Lang.bind(this, this.onWindowChanged, 3)),
                    window.connect('notify::gtk-application-id', Lang.bind(this, this.onWindowChanged, 4))
                ]
            ];
            this.windowsSignals.push(objectAndSignals);
            return true;
        } else
            return false;
    },

    removeWindowInList: function (window) {
        let index = this.searchWindowInList(window);
        if (index !== null) {
            this.windowsList.splice(index, 1);

            //Remove window signals
            for (let indexSignal in this.windowsSignals) {
                let [object, signals] = this.windowsSignals[indexSignal];
                if (object === window) {
                    signals.forEach(
                        function (signal) {
                            object.disconnect(signal);
                        },
                        this
                    );
                    this.windowsSignals.splice(indexSignal, 1);
                    break;
                }
            }
            return true;
        } else
            return false;
    },

    cleanWindowsList: function () {
        for (let i = this.windowsList.length - 1; i >= 0; i--)
            this.removeWindowInList(this.windowsList[i]);
    }
}
