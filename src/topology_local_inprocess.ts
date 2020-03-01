import * as intf from "./topology_interfaces";

import * as async from "async";
import * as path from "path";

import * as log from "./util/logger";
import { SpoutAsyncWrapper, BoltAsyncWrapper } from "./topology_async_wrappers";

const NEXT_SLEEP_TIMEOUT: number = 1 * 1000; // number of miliseconds to "sleep" when spout.next() returned no data

/** Base class for spouts and bolts - contains telemetry support */
export class TopologyNodeBase {

    protected name: string;
    protected firstErrorMessage: string;

    constructor(name: string, telemetry_timeout: number) {
        this.name = name;
        this.firstErrorMessage = "";
    }
}

/** Wrapper for spout */
export class TopologySpoutWrapper extends TopologyNodeBase {

    private context: any;
    private working_dir: string;
    private cmd: string;
    private subtype: string;
    private init_params: any;
    private isPaused: boolean;
    private isShuttingDown: boolean;
    private initCalled: boolean;
    private nextTs: number;

    private spout: intf.ISpout;
    private emitCallback: intf.BoltEmitCallback;

    /** Constructor needs to receive all data */
    constructor(config: any, context: any) {
        super(config.name, config.telemetry_timeout);

        this.name = config.name;
        this.context = context;
        this.working_dir = config.working_dir;
        this.cmd = config.cmd;
        this.subtype = config.subtype;
        this.init_params = config.init || {};
        this.isError = false;

        try {
            if (config.type == "sys") {
                this.spout = createSysSpout(config);
            } else if (config.type == "module_class") {
                this.makeWorkingDirAbsolute();
                const module = require(this.working_dir);
                const obj = new module[this.cmd](this.subtype);
                if (!obj) {
                    throw new Error(
                        `Spout factory returned null: ${this.working_dir}, cmd=${this.cmd}, subtype=${this.subtype}`);
                }
                if (obj.init.length < 4) {
                    this.spout = new SpoutAsyncWrapper(obj);
                } else {
                    this.spout = obj;
                }
            } else if (config.type == "module_method") {
                this.makeWorkingDirAbsolute();
                const module = require(this.working_dir);
                const obj = module[this.cmd](this.subtype);
                if (!obj) {
                    throw new Error(
                        `Spout factory returned null: ${this.working_dir}, cmd=${this.cmd}, subtype=${this.subtype}`);
                }
                if (obj.init.length < 4) {
                    this.spout = new SpoutAsyncWrapper(obj);
                } else {
                    this.spout = obj;
                }
            } else {
                this.working_dir = path.resolve(this.working_dir); // path may be relative to current working dir
                const module_path = path.join(this.working_dir, this.cmd);
                const obj = require(module_path).create(this.subtype);
                if (!obj) {
                    throw new Error(`Spout factory returned null: ${module_path}, subtype=${this.subtype}`);
                }
                if (obj.init.length < 4) {
                    this.spout = new SpoutAsyncWrapper(obj);
                } else {
                    this.spout = obj;
                }
            }
        } catch (e) {
            log.logger().error(`Error while creating an inproc spout (${this.name})`);
            log.logger().exception(e);
            throw e;
        }

        this.emitCallback = (data, stream_id, callback) => {
            config.onEmit(data, stream_id, callback);
        };
        this.errorCallback = config.onError || (() => {
            // no-op
        });
        this.errorCallback = this.wrapCallbackSetError(this.errorCallback);
        this.isPaused = true;
        this.isShuttingDown = false;
        this.nextTs = Date.now();
    }

    /** Returns name of this node */
    public getName(): string {
        return this.name;
    }

    /** Returns inner spout object */
    public getSpoutObject(): intf.ISpout {
        return this.spout;
    }

    /** Shuts down the process */
    public async shutdown(): Promise<void> {
        await this.spout.shutdown();
    }

    /** Initializes child object. */
    public async init(): Promise<void> {
        await this.spout.init(this.name, this.init_params, this.context);
    }

    /** Sends run signal and starts the "pump" */
    public run() {
        if (!this.isPaused) {
            return; // already running
        }
        this.isPaused = false;
        try {
            this.spout.run();
        } catch (e) {
            log.logger().error(`Error in spout (${this.name}) run`);
            log.logger().exception(e);
            this.errorCallback(e);
            return;
        }
        async.whilst(
            () => !this.isPaused && !this.isError,
            xcallback => {
                if (Date.now() < this.nextTs) {
                    const sleep = this.nextTs - Date.now();
                    setTimeout(() => { xcallback(); }, sleep);
                } else {
                    this.next(xcallback);
                }
            },
            (err: Error) => {
                if (err) {
                    log.logger().error(`Error in spout (${this.name}) next`);
                    log.logger().exception(err);
                    this.errorCallback(err);
                }
            });
    }

    /** Sends pause signal to child */
    public pause() {
        if (this.isPaused) {
            return; // already paused
        }
        this.isPaused = true;
        this.spout.pause();
    }

    /** Requests next data message */
    private async next(): Promise<void> {
        if (this.isPaused) {
            return;
        }
        const ts_start = Date.now();
        setImmediate(() => {
            try {
                this.spout.next((err, data, stream_id) => {
                    this.telemetryAdd(Date.now() - ts_start);
                    if (err) {
                        log.logger().exception(err);
                        return callback(err);
                    }
                    if (!data) {
                        this.nextTs = Date.now() + NEXT_SLEEP_TIMEOUT;
                        return callback();
                    } else {
                        try {
                            this.emitCallback(data, stream_id, callback);
                        } catch (e) {
                            // there was an error, don't call the child's xcallback
                            return callback(e);
                        }
                    }
                });
            } catch (e) {
                return callback(e);
            }
        });
    }

    /** Utility function for making working dir absolute - used to avoid some problematic situations */
    private makeWorkingDirAbsolute() {
        if (!path.isAbsolute(this.working_dir)) {
            this.working_dir = path.resolve(this.working_dir);
        }
    }
}

/** Wrapper for bolt */
export class TopologyBoltWrapper extends TopologyNodeBase {

    private context: any;
    private working_dir: string;
    private cmd: string;
    private subtype: string;
    private init_params: any;
    private isShuttingDown: boolean;
    private initCalled: boolean;
    private allow_parallel: boolean;
    private inSend: number;
    private pendingSendRequests: any[];
    private pendingShutdownCallback: intf.SimpleCallback;

    private bolt: intf.IBolt; // TODO rename child to bolt
    private emitCallback: intf.BoltEmitCallback;

    /** Constructor needs to receive all data */
    constructor(config: any, context: any) {
        super(config.name, config.telemetry_timeout);
        this.name = config.name;
        this.context = context;
        this.working_dir = config.working_dir;
        this.cmd = config.cmd;
        this.subtype = config.subtype;
        this.isError = false;
        this.init_params = config.init || {};
        this.init_params.onEmit = (data, stream_id, callback) => {
            config.onEmit(data, stream_id, callback);
        };
        this.emitCallback = this.init_params.onEmit;
        this.errorCallback = config.onError || (() => {
            // no-op
        });
        this.errorCallback = this.wrapCallbackSetError(this.errorCallback);
        this.allow_parallel = config.allow_parallel || false;

        this.isShuttingDown = false;

        this.inSend = 0;
        this.pendingSendRequests = [];
        this.pendingShutdownCallback = null;

        try {
            if (config.type == "sys") {
                this.bolt = createSysBolt(config);
            } else if (config.type == "module_class") {
                this.makeWorkingDirAbsolute();
                const module = require(this.working_dir);
                const obj = new module[this.cmd](this.subtype);
                if (!obj) {
                    throw new Error(
                        `Bolt factory returned null: ${this.working_dir}, cmd=${this.cmd}, subtype=${this.subtype}`);
                }
                if (obj.init.length < 4) {
                    this.bolt = new BoltAsyncWrapper(obj);
                } else {
                    this.bolt = obj;
                }
            } else if (config.type == "module_method") {
                this.makeWorkingDirAbsolute();
                const module = require(this.working_dir);
                const obj = module[this.cmd](this.subtype);
                if (!obj) {
                    throw new Error(
                        `Bolt factory returned null: ${this.working_dir}, cmd=${this.cmd}, subtype=${this.subtype}`);
                }
                if (obj.init.length < 4) {
                    this.bolt = new BoltAsyncWrapper(obj);
                } else {
                    this.bolt = obj;
                }
            } else {
                this.working_dir = path.resolve(this.working_dir); // path may be relative to current working dir
                const module_path = path.join(this.working_dir, this.cmd);
                const obj = require(module_path).create(this.subtype);
                if (!obj) {
                    throw new Error(`Bolt factory returned null: ${module_path}, subtype=${this.subtype}`);
                }
                if (obj.init.length < 4) {
                    this.bolt = new BoltAsyncWrapper(obj);
                } else {
                    this.bolt = obj;
                }
            }
        } catch (e) {
            log.logger().error(`Error while creating an inproc bolt (${this.name})`);
            log.logger().exception(e);
            throw e;
        }
    }

    /** Returns name of this node */
    public getName(): string {
        return this.name;
    }

    /** Returns inner bolt object */
    public getBoltObject(): intf.IBolt {
        return this.bolt;
    }

    /** Shuts down the child */
    public async shutdown(): Promise<void> {
        await this.bolt.shutdown();
    }

    /** Initializes child object. */
    public async init(): Promise<void> {
        // wrap callback to set self.isError when an exception passed
        await this.bolt.init(this.name, this.init_params, this.context);
    }

    /** Sends data to child object. */
    public async receive(data: any, stream_id: string): Promise<void> {
        await this.bolt.receive(data, stream_id);
    }

    /** Utility function for making working dir absolute - used to avoid some problematic situations */
    private makeWorkingDirAbsolute() {
        if (!path.isAbsolute(this.working_dir)) {
            this.working_dir = path.resolve(this.working_dir);
        }
    }
}
