const {Shell, Meta} = imports.gi;
const Me = imports.misc.extensionUtils.getCurrentExtension();
var {TilingManager} = Me.imports.tilingManager.tilingManager;
const St = imports.gi.St;
const Main = imports.ui.main;
/* exported TilingModule */
var TilingModule = class TilingModule {
    constructor() {
        this.signals = [];
    }
    enable() {
        global.tilingManager = new TilingManager();
        let tracker = Shell.WindowTracker.get_default();
        /* this.signals.push({
            from: tracker,
            id: tracker.connect('tracked-windows-changed', () => {
                
                global.tilingManager.tileWindows();
            })
        }); */

        /*         this.signals.push({
            from: global.display,
            id: global.display.connect('window-created', (_, metaWindow) => {
                this.subscribeToWindowSignals(metaWindow);
            })
        }); */

        /* this.signals.push({
            from: global.display,
            id: global.display.connect(
                'window-entered-monitor',
                (display, monitorIndex, window) => {
                    
                    this.windowChangedSomething(window);
                }
            )
        });

        this.signals.push({
            from: global.display,
            id: global.display.connect(
                'window-left-monitor',
                (display, monitorIndex, window) => {
                    
                    this.windowChangedSomething(window);
                }
            )
        }); */

        this.signals.push({
            from: global.display,
            id: global.display.connect(
                'grab-op-begin',
                (display1, display2, window, op) => {
                    if (op !== Meta.GrabOp.MOVING) return;
                    this.grabInProgress = true;
                    this.grabWindow = window;
                    window.grabbed = true;
                }
            )
        });

        this.signals.push({
            from: global.display,
            id: global.display.connect('grab-op-end', () => {
                if (this.grabInProgress) {
                    this.grabInProgress = false;
                    this.grabWindow.grabbed = false;
                    global.tilingManager.tileWindows();
                }
            })
        });
    }

    disable() {
        global.tilingManager.onDestroy();
        this.signals.forEach(signal => {
            signal.from.disconnect(signal.id);
        });
        this.signals = [];
    }
};
