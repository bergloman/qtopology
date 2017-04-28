"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fb = require("./std_nodes/filter_bolt");
const pb = require("./std_nodes/post_bolt");
const cb = require("./std_nodes/console_bolt");
const ab = require("./std_nodes/attacher_bolt");
const gb = require("./std_nodes/get_bolt");
const rb = require("./std_nodes/router_bolt");
const bb = require("./std_nodes/bomb_bolt");
const rs = require("./std_nodes/rest_spout");
const ts = require("./std_nodes/timer_spout");
const gs = require("./std_nodes/get_spout");
const tss = require("./std_nodes/test_spout");
const tel = require("./util/telemetry");
/** Wrapper for "spout" in-process */
class TopologySpoutInproc {
    /** Constructor needs to receive all data */
    constructor(config, context) {
        this.name = config.name;
        this.context = context;
        this.working_dir = config.working_dir;
        this.cmd = config.cmd;
        this.init_params = config.init || {};
        this.isStarted = false;
        this.isClosed = false;
        this.isExit = false;
        this.isError = false;
        this.onExit = null;
        this.telemetry = new tel.Telemetry(config.name);
        this.telemetry_total = new tel.Telemetry(config.name);
        let self = this;
        try {
            if (config.type == "sys") {
                this.child = this.createSysSpout(config, context);
            }
            else {
                this.working_dir = path.resolve(this.working_dir); // path may be relative to current working dir
                let module_path = path.join(this.working_dir, this.cmd);
                this.child = require(module_path).create(context);
            }
            this.isStarted = true;
        }
        catch (e) {
            console.error("Error while creating an inproc spout", e);
            this.isStarted = true;
            this.isClosed = true;
            this.isExit = true;
            this.isError = true;
        }
        self.emitCallback = (data, stream_id) => __awaiter(this, void 0, void 0, function* () {
            return yield config.onEmit(data, stream_id);
        });
        self.isPaused = true;
        self.nextTs = Date.now();
    }
    /** Returns name of this node */
    getName() {
        return this.name;
    }
    /** Returns inner spout object */
    getSpoutObject() {
        return this.child;
    }
    /** Handler for heartbeat signal */
    heartbeat() {
        return __awaiter(this, void 0, void 0, function* () {
            let self = this;
            self.child.heartbeat();
            // emit telemetry
            yield self.emitCallback(self.telemetry.get(), "$telemetry");
            self.telemetry.reset();
            yield self.emitCallback(self.telemetry_total.get(), "$telemetry-total");
        });
    }
    /** Shuts down the process */
    shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.child.shutdown();
        });
    }
    /** Initializes child object. */
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.child.init(this.name, this.init_params);
        });
    }
    delay(t) {
        return new Promise((resolve) => {
            setTimeout(resolve, t);
        });
    }
    /** Sends run signal and starts the "pump"" */
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            let self = this;
            this.isPaused = false;
            this.child.run();
            while (!self.isPaused) {
                if (Date.now() < this.nextTs) {
                    let sleep = this.nextTs - Date.now();
                    yield self.delay(sleep);
                }
                else {
                    yield self.next();
                }
            }
        });
    }
    /** Requests next data message */
    next() {
        return __awaiter(this, void 0, void 0, function* () {
            let self = this;
            if (this.isPaused) {
                return;
            }
            else {
                let ts_start = Date.now();
                yield self.delay(0);
                let { err, data, stream_id, callback } = yield self.child.next();
                self.telemetryAdd(Date.now() - ts_start);
                if (err) {
                    console.error(err);
                    return;
                }
                if (!data) {
                    self.nextTs = Date.now() + 1 * 1000; // sleep for 1 sec if spout is empty
                }
                else {
                    let err = yield self.emitCallback(data, stream_id);
                    // in case child object expects confirmation call for this tuple
                    if (callback) {
                        yield callback(err);
                    }
                }
            }
        });
    }
    /** Sends pause signal to child */
    pause() {
        this.isPaused = true;
        this.child.pause();
    }
    /** Factory method for sys spouts */
    createSysSpout(spout_config, context) {
        switch (spout_config.cmd) {
            case "timer": return new ts.TimerSpout();
            case "get": return new gs.GetSpout();
            case "rest": return new rs.RestSpout();
            case "test": return new tss.TestSpout();
            default: throw new Error("Unknown sys spout type: " + spout_config.cmd);
        }
    }
    /** Adds duration to internal telemetry */
    telemetryAdd(duration) {
        this.telemetry.add(duration);
        this.telemetry_total.add(duration);
    }
}
exports.TopologySpoutInproc = TopologySpoutInproc;
/** Wrapper for "bolt" in-process */
class TopologyBoltInproc {
    /** Constructor needs to receive all data */
    constructor(config, context) {
        let self = this;
        this.name = config.name;
        this.context = context;
        this.working_dir = config.working_dir;
        this.cmd = config.cmd;
        this.init_params = config.init || {};
        this.init_params.onEmit = (data, stream_id, callback) => {
            if (self.isShuttingDown) {
                return callback("Bolt is shutting down:", self.name);
            }
            config.onEmit(data, stream_id, callback);
        };
        this.emitCallback = this.init_params.onEmit;
        this.allow_parallel = config.allow_parallel || false;
        this.isStarted = false;
        this.isShuttingDown = false;
        this.isClosed = false;
        this.isExit = false;
        this.isError = false;
        this.onExit = null;
        this.inSend = 0;
        this.pendingSendRequests = [];
        this.pendingShutdownCallback = null;
        this.telemetry = new tel.Telemetry(config.name);
        this.telemetry_total = new tel.Telemetry(config.name);
        try {
            if (config.type == "sys") {
                this.child = this.createSysBolt(config, context);
            }
            else {
                this.working_dir = path.resolve(this.working_dir); // path may be relative to current working dir
                let module_path = path.join(this.working_dir, this.cmd);
                this.child = require(module_path).create(context);
            }
            this.isStarted = true;
        }
        catch (e) {
            console.error("Error while creating an inproc bolt", e);
            this.isStarted = true;
            this.isClosed = true;
            this.isExit = true;
            this.isError = true;
        }
    }
    /** Returns name of this node */
    getName() {
        return this.name;
    }
    /** Returns inner bolt object */
    getBoltObject() {
        return this.child;
    }
    /** Handler for heartbeat signal */
    heartbeat() {
        return __awaiter(this, void 0, void 0, function* () {
            let self = this;
            self.child.heartbeat();
            // emit telemetry
            yield self.emitCallback(self.telemetry.get(), "$telemetry");
            self.telemetry.reset();
            yield self.emitCallback(self.telemetry_total.get(), "$telemetry-total");
        });
    }
    /** Shuts down the child */
    shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            this.isShuttingDown = true;
            if (this.inSend === 0) {
                yield this.child.shutdown();
            }
            else {
                this.pendingShutdownCallback = callback;
            }
        });
    }
    /** Initializes child object. */
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.child.init(this.name, this.init_params);
        });
    }
    /** Sends data to child object. */
    receive(data, stream_id) {
        return __awaiter(this, void 0, void 0, function* () {
            let self = this;
            let ts_start = Date.now();
            if (self.inSend > 0 && !self.allow_parallel) {
                self.pendingSendRequests.push({
                    data: data,
                    stream_id: stream_id,
                    callback: (err) => {
                        self.telemetryAdd(Date.now() - ts_start);
                        callback(err);
                    }
                });
            }
            else {
                self.inSend++;
                yield self.child.receive(data, stream_id);
                callback(err);
                self.inSend--;
                if (self.inSend === 0) {
                    if (self.pendingSendRequests.length > 0) {
                        let d = self.pendingSendRequests[0];
                        self.pendingSendRequests = self.pendingSendRequests.slice(1);
                        self.receive(d.data, stream_id, d.callback);
                    }
                    else if (self.pendingShutdownCallback) {
                        self.shutdown(self.pendingShutdownCallback);
                        self.pendingShutdownCallback = null;
                    }
                }
            }
        });
    }
    /** Factory method for sys bolts */
    createSysBolt(bolt_config, context) {
        switch (bolt_config.cmd) {
            case "console": return new cb.ConsoleBolt();
            case "filter": return new fb.FilterBolt();
            case "attacher": return new ab.AttacherBolt();
            case "post": return new pb.PostBolt();
            case "get": return new gb.GetBolt();
            case "router": return new rb.RouterBolt();
            case "bomb": return new bb.BombBolt();
            default: throw new Error("Unknown sys bolt type: " + bolt_config.cmd);
        }
    }
    /** Adds duration to internal telemetry */
    telemetryAdd(duration) {
        this.telemetry.add(duration);
        this.telemetry_total.add(duration);
    }
}
exports.TopologyBoltInproc = TopologyBoltInproc;
//# sourceMappingURL=topology_local_inprocess.js.map