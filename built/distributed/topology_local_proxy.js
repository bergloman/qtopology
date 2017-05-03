"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const cp = require("child_process");
const intf = require("../topology_interfaces");
/**
 * This class acts as a proxy for local topology inside parent process.
 */
class TopologyLocalProxy {
    /** Constructor that sets up call routing */
    constructor(child_exit_callback) {
        let self = this;
        this.init_cb = null;
        this.run_cb = null;
        this.pause_cb = null;
        this.shutdown_cb = null;
        this.was_shut_down = false;
        this.child_exit_callback = child_exit_callback || (() => { });
        this.child = cp.fork(path.join(__dirname, "topology_local_wrapper"), [], { silent: false });
        self.child.on("message", (msgx) => {
            let msg = msgx;
            if (msg.cmd == intf.ChildMsgCode.response_init) {
                if (self.init_cb) {
                    self.init_cb(msg.data.err);
                    self.init_cb = null;
                }
            }
            if (msg.cmd == intf.ChildMsgCode.response_run) {
                if (self.run_cb) {
                    self.run_cb(msg.data.err);
                    self.run_cb = null;
                }
            }
            if (msg.cmd == intf.ChildMsgCode.response_pause) {
                if (self.pause_cb) {
                    self.pause_cb(msg.data.err);
                    self.pause_cb = null;
                }
            }
            if (msg.cmd == intf.ChildMsgCode.response_shutdown) {
                self.was_shut_down = true;
                self.callPendingCallbacks2(null);
            }
        });
        self.child.on("error", (e) => {
            if (self.was_shut_down)
                return;
            self.callPendingCallbacks(e);
            self.child_exit_callback(e);
            self.callPendingCallbacks2(e);
        });
        self.child.on("close", (code) => {
            if (self.was_shut_down)
                return;
            let e = new Error("CLOSE Child process exited with code " + code);
            self.callPendingCallbacks(e);
            if (code === 0) {
                e = null;
            }
            self.child_exit_callback(e);
            self.callPendingCallbacks2(e);
        });
        self.child.on("exit", (code) => {
            if (self.was_shut_down)
                return;
            let e = new Error("EXIT Child process exited with code " + code);
            self.callPendingCallbacks(e);
            if (code === 0) {
                e = null;
            }
            self.child_exit_callback(e);
            self.callPendingCallbacks2(e);
        });
    }
    /** Check if this object has been shut down already */
    wasShutDown() {
        return this.was_shut_down;
    }
    /** Calls all pending callbacks with given error and clears them. */
    callPendingCallbacks(e) {
        if (this.init_cb) {
            this.init_cb(e);
            this.init_cb = null;
        }
        if (this.run_cb) {
            this.run_cb(e);
            this.run_cb = null;
        }
        if (this.pause_cb) {
            this.pause_cb(e);
            this.pause_cb = null;
        }
    }
    /** Calls pending shutdown callback with given error and clears it. */
    callPendingCallbacks2(e) {
        if (this.shutdown_cb) {
            this.shutdown_cb(null);
            this.shutdown_cb = null;
        }
    }
    /** Sends initialization signal to underlaying process */
    init(config) {
        return new Promise((resolve, reject) => {
            if (this.init_cb) {
                return reject(new Error("Pending init callback already exists."));
            }
            this.init_cb = resolve;
            this.send(intf.ParentMsgCode.init, config);
        });
    }
    /** Sends run signal to underlaying process */
    run() {
        return new Promise((resolve, reject) => {
            if (this.run_cb) {
                return reject(new Error("Pending run callback already exists."));
            }
            this.run_cb = resolve;
            this.send(intf.ParentMsgCode.run, {});
        });
    }
    /** Sends pause signal to underlaying process */
    pause() {
        return new Promise((resolve, reject) => {
            if (this.pause_cb) {
                return reject(new Error("Pending pause callback already exists."));
            }
            this.pause_cb = resolve;
            this.send(intf.ParentMsgCode.pause, {});
        });
    }
    /** Sends shutdown signal to underlaying process */
    shutdown() {
        return new Promise((resolve, reject) => {
            if (this.shutdown_cb) {
                return reject(new Error("Pending shutdown callback already exists."));
            }
            this.shutdown_cb = resolve;
            this.send(intf.ParentMsgCode.shutdown, {});
        });
    }
    /** Internal method for sending messages to child process */
    send(code, data) {
        let msg = { cmd: code, data: data };
        this.child.send(msg);
    }
}
exports.TopologyLocalProxy = TopologyLocalProxy;
//# sourceMappingURL=topology_local_proxy.js.map