import * as intf from "./topology_interfaces";

import * as async from "async";
import * as path from "path";
import * as cp from "child_process";
import * as EventEmitter from "events";

import * as fb from "./std_nodes/filter_bolt";
import * as pb from "./std_nodes/post_bolt";
import * as cb from "./std_nodes/console_bolt";
import * as ab from "./std_nodes/attacher_bolt";
import * as gb from "./std_nodes/get_bolt";
import * as rb from "./std_nodes/router_bolt";
import * as bb from "./std_nodes/bomb_bolt";

import * as rs from "./std_nodes/rest_spout";
import * as ts from "./std_nodes/timer_spout";
import * as gs from "./std_nodes/get_spout";
import * as tss from "./std_nodes/test_spout";

import * as utils from "./util/helpers";
import * as tel from "./util/telemetry";

/** Wrapper for "spout" in-process */
export class TopologySpoutInproc {

    private name: string;
    private context: any;
    private working_dir: string;
    private cmd: string;
    private init_params: any
    private isStarted: boolean;
    private isClosed: boolean;
    private isExit: boolean;
    private isError: boolean;
    private onExit: boolean;
    private isPaused: boolean;
    private nextTs: number;

    private telemetry: tel.Telemetry;
    private telemetry_total: tel.Telemetry;

    private child: intf.Spout;
    private emitCallback: intf.BoltEmitCallback;

    /** Constructor needs to receive all data */
    constructor(config: any, context: any) {
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
            } else {
                this.working_dir = path.resolve(this.working_dir); // path may be relative to current working dir
                let module_path = path.join(this.working_dir, this.cmd);
                this.child = require(module_path).create(context);
            }
            this.isStarted = true;
        } catch (e) {
            console.error("Error while creating an inproc spout", e);
            this.isStarted = true;
            this.isClosed = true;
            this.isExit = true;
            this.isError = true;
        }

        self.emitCallback = async (data, stream_id) => {
            return await config.onEmit(data, stream_id);
        };
        self.isPaused = true;
        self.nextTs = Date.now();
    }

    /** Returns name of this node */
    getName(): string {
        return this.name;
    }

    /** Returns inner spout object */
    getSpoutObject(): intf.Spout {
        return this.child;
    }

    /** Handler for heartbeat signal */
    async heartbeat() {
        let self = this;
        self.child.heartbeat();

        // emit telemetry
        await self.emitCallback(self.telemetry.get(), "$telemetry");
        self.telemetry.reset();
        await self.emitCallback(self.telemetry_total.get(), "$telemetry-total");
    }

    /** Shuts down the process */
    async shutdown(): Promise<void> {
        await this.child.shutdown();
    }

    /** Initializes child object. */
    async init(): Promise<void> {
        await this.child.init(this.name, this.init_params);
    }


    /** Sends run signal and starts the "pump"" */
    async run() {
        let self = this;
        this.isPaused = false;
        this.child.run();
        while (!self.isPaused) {
            if (Date.now() < this.nextTs) {
                let sleep = this.nextTs - Date.now();
                await utils.delay(sleep);
            } else {
                await self.next();
            }
        }
    }

    /** Requests next data message */
    async next(): Promise<void> {
        let self = this;
        if (this.isPaused) {
            return;
        } else {
            let ts_start = Date.now();
            await utils.delay(0);
            let { err, data, stream_id, callback } = await self.child.next();
            self.telemetryAdd(Date.now() - ts_start);
            if (err) {
                console.error(err);
                return;
            }
            if (!data) {
                self.nextTs = Date.now() + 1 * 1000; // sleep for 1 sec if spout is empty
            } else {
                let err = await self.emitCallback(data, stream_id);
                // in case child object expects confirmation call for this tuple
                if (callback) {
                    await callback(err);
                }
            }
        }
    }

    /** Sends pause signal to child */
    pause() {
        this.isPaused = true;
        this.child.pause();
    }

    /** Factory method for sys spouts */
    private createSysSpout(spout_config: any, context: any): intf.Spout {
        switch (spout_config.cmd) {
            case "timer": return new ts.TimerSpout();
            case "get": return new gs.GetSpout();
            case "rest": return new rs.RestSpout();
            case "test": return new tss.TestSpout();
            default: throw new Error("Unknown sys spout type: " + spout_config.cmd);
        }
    }

    /** Adds duration to internal telemetry */
    private telemetryAdd(duration: number) {
        this.telemetry.add(duration);
        this.telemetry_total.add(duration);
    }
}

/** Wrapper for "bolt" in-process */
export class TopologyBoltInproc {

    private name: string;
    private context: any;
    private working_dir: string;
    private cmd: string;
    private init_params: any
    private isStarted: boolean;
    private isClosed: boolean;
    private isExit: boolean;
    private isError: boolean;
    private onExit: boolean;
    private isPaused: boolean;
    private isShuttingDown: boolean;
    private nextTs: number;
    private allow_parallel: boolean;
    private inSend: number;
    private pendingSendRequests: any[];
    private pendingShutdownCallback: intf.SimpleCallback;

    private telemetry: tel.Telemetry;
    private telemetry_total: tel.Telemetry;

    private child: intf.Bolt;
    private emitCallback: intf.BoltEmitCallback;

    /** Constructor needs to receive all data */
    constructor(config, context: any) {
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
            } else {
                this.working_dir = path.resolve(this.working_dir); // path may be relative to current working dir
                let module_path = path.join(this.working_dir, this.cmd);
                this.child = require(module_path).create(context);
            }
            this.isStarted = true;
        } catch (e) {
            console.error("Error while creating an inproc bolt", e);
            this.isStarted = true;
            this.isClosed = true;
            this.isExit = true;
            this.isError = true;
        }
    }

    /** Returns name of this node */
    getName(): string {
        return this.name;
    }

    /** Returns inner bolt object */
    getBoltObject(): intf.Bolt {
        return this.child;
    }

    /** Handler for heartbeat signal */
    async heartbeat() {
        let self = this;
        self.child.heartbeat();

        // emit telemetry
        await self.emitCallback(self.telemetry.get(), "$telemetry");
        self.telemetry.reset();
        await self.emitCallback(self.telemetry_total.get(), "$telemetry-total");
    }

    /** Shuts down the child */
    async shutdown(): Promise<void> {
        this.isShuttingDown = true;
        if (this.inSend === 0) {
            await this.child.shutdown();
        } else {
            this.pendingShutdownCallback = callback;
        }
    }

    /** Initializes child object. */
    async init() : Promise<void>{
        await this.child.init(this.name, this.init_params);
    }

    /** Sends data to child object. */
    async receive(data: any, stream_id: string): Promise<void> {
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
        } else {
            self.inSend++;
            await self.child.receive(data, stream_id);
                callback(err);
                self.inSend--;
                if (self.inSend === 0) {
                    if (self.pendingSendRequests.length > 0) {
                        let d = self.pendingSendRequests[0];
                        self.pendingSendRequests = self.pendingSendRequests.slice(1);
                        self.receive(d.data, stream_id, d.callback);
                    } else if (self.pendingShutdownCallback) {
                        self.shutdown(self.pendingShutdownCallback);
                        self.pendingShutdownCallback = null;
                    }
                }
        }
    }

    /** Factory method for sys bolts */
    private createSysBolt(bolt_config: any, context: any) {
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
    private telemetryAdd(duration: number) {
        this.telemetry.add(duration);
        this.telemetry_total.add(duration);
    }
}
