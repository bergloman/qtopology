import * as intf from "./topology_interfaces";
import * as async from "async";
import * as path from "path";
import * as top_inproc from "./topology_local_inprocess";
import * as log from "./util/logger";
import { readJsonFileSync } from "./util/strip_json_comments";
import { validate } from "./topology_validation";
import { TopologyCompiler } from "./topology_compiler";

////////////////////////////////////////////////////////////////////

/** Internal record for router mapping */
class OutputRouterDestination {
    public destination: string;
    public stream_id: string;
}

/** Class that performs redirection of messages after they are emited from nodes */
export class OutputRouter {

    private sources: Map<string, OutputRouterDestination>;

    /** Constructor prepares the object before any information is received. */
    constructor() {
        this.sources = new Map<string, OutputRouterDestination>();
    }

    /** This method registers binding between source and destination
     * @param {string} source - Name of source
     * @param {string} destination - Name of destination
     * @param {string} stream_id - Stream ID used for routing
     */
    public register(source: string, destination: string, stream_id: string) {
        if (!this.sources[source]) {
            this.sources[source] = [];
        }
        this.sources[source].push({ destination, stream_id: stream_id || null });
    }

    /** Returns list of names that are destinations for data, emitted by source.
     * @param {*} source - Name of source
     * @param {string} stream_id - Stream ID used for routing
     */
    public getDestinationsForSource(source: string, stream_id: string): string[] {
        if (!this.sources[source]) {
            return [];
        }
        return this.sources[source]
            .filter(x => x.stream_id == stream_id)
            .map(x => x.destination);
    }
}

/** This class runs local topology */
export class TopologyLocal {

    private spouts: top_inproc.TopologySpoutWrapper[];
    private bolts: top_inproc.TopologyBoltWrapper[];
    private config: any;
    private uuid: string;
    private logging_prefix: string;
    private pass_binary_messages: boolean;
    private heartbeatTimeout: number;
    private router: OutputRouter;
    private isInitialized: boolean;
    private isRunning: boolean;
    private isShuttingDown: boolean;
    private shutdownHardCalled: boolean;
    private heartbeatTimer: NodeJS.Timer;
    // private onErrorHandler: intf.SimpleCallback; // handles internal errors

    /** Constructor prepares the object before any information is received. */
    constructor(/*onError?: intf.SimpleCallback*/) {
        this.spouts = [];
        this.bolts = [];
        this.config = null;
        this.uuid = null;
        this.pass_binary_messages = false;
        this.heartbeatTimeout = 10000;
        this.router = new OutputRouter();

        this.isRunning = false;
        this.isShuttingDown = false;
        this.isInitialized = false;
        this.shutdownHardCalled = false;
        this.heartbeatTimer = null;
        this.logging_prefix = null;
        // this.onErrorHandler = onError || (() => {
        //     // no-op
        // });
        // this.onErrorHandler = tryCallback(this.onErrorHandler);
    }

    /** Initialization that sets up internal structure and
     * starts underlaying processes.
     */
    public async init(uuid: string, config: any): Promise<void> {

        if (this.isInitialized) {
            throw new Error(this.logging_prefix + "Already initialized");
        }
        this.config = config;
        this.uuid = uuid;
        this.logging_prefix = `[TopologyLocal ${uuid}] `;
        this.heartbeatTimeout = config.general.heartbeat;
        this.pass_binary_messages = config.general.pass_binary_messages || false;
        this.isInitialized = true;
        const context = await this.initContext();

        const tasks = [];
        this.config.bolts.forEach(bolt_config => {
            if (bolt_config.disabled) {
                log.logger().debug(this.logging_prefix + `Skipping disabled bolt - ${bolt_config.name}`);
                return;
            }
            bolt_config.onEmit = async (data, stream_id) => {
                await this.redirect(bolt_config.name, data, stream_id);
            };
            const bolt = new top_inproc.TopologyBoltWrapper(bolt_config, context);
            this.bolts.push(bolt);
            tasks.push(xcallback => { bolt.init(xcallback); });
            for (const input of bolt_config.inputs) {
                if (input.disabled) {
                    log.logger().debug(
                        this.logging_prefix + `Skipping disabled source - ${input.source} -> ` +
                        `${bolt_config.name} (stream ${input.stream_id})`);
                    continue;
                }
                log.logger().debug(
                    this.logging_prefix + `Establishing source - ${input.source} -> ` +
                    `${bolt_config.name} (stream ${input.stream_id})`);
                this.router.register(input.source, bolt_config.name, input.stream_id);
            }
        });
        this.config.spouts.forEach(spout_config => {
            if (spout_config.disabled) {
                log.logger().debug(this.logging_prefix + `Skipping disabled spout - ${spout_config.name}`);
                return;
            }
            spout_config.onEmit = (data, stream_id, xcallback) => {
                this.redirect(spout_config.name, data, stream_id, xcallback);
            };
            spout_config.onError = (e: Error) => {
                this.onInternalError(e);
            };
            const spout = new top_inproc.TopologySpoutWrapper(spout_config, context);
            this.spouts.push(spout);
            tasks.push(xcallback => {
                spout.init(xcallback);
            });
        });
        async.series(tasks, (err_inner: Error) => {
            if (err_inner) {
                log.logger().error(this.logging_prefix + "Error while initializing topology");
                log.logger().exception(err_inner);
            } else {
                this.runHeartbeat();
            }
            return callback(err_inner);
        });

    }

    /** Sends run signal to all spouts. Each spout.run is idempotent */
    public run(callback: intf.SimpleCallback) {
        callback = tryCallback(callback);
        if (!this.isInitialized) {
            return callback(new Error(this.logging_prefix + "Topology not initialized and cannot run."));
        }
        if (this.isRunning) {
            return callback(new Error(this.logging_prefix + "Topology is already running."));
        }
        this.isRunning = true;
        log.logger().log(this.logging_prefix + "Local topology started");
        // spouts pass internal exceptions to errorCallback
        // no exceptions are expected to be thrown here
        for (const spout of this.spouts) {
            spout.run();
        }
        return callback();
    }

    /** Sends pause signal to all spouts. Each spout.pause is idempotent  */
    public pause(callback: intf.SimpleCallback) {
        callback = tryCallback(callback);
        if (!this.isInitialized) {
            return callback(new Error(this.logging_prefix + "Topology not initialized and cannot be paused."));
        }
        if (!this.isRunning) {
            return callback(new Error(this.logging_prefix + "Topology is already paused."));
        }
        this.isRunning = false;
        // spouts pass internal exceptions to errorCallback
        // no exceptions are expected to be thrown here
        for (const spout of this.spouts) {
            spout.pause();
        }
        return callback();
    }

    /** Sends shutdown signal to all child processes */
    public shutdown(callback: intf.SimpleCallback) {
        callback = tryCallback(callback);
        if (!this.isInitialized) {
            return callback(new Error(this.logging_prefix + "Topology not initialized and cannot shutdown."));
        }
        if (this.isShuttingDown) {
            // without an exception the caller will think that everything shut down nicely already
            // when we call shutdown twice by mistake
            return callback(new Error(this.logging_prefix + "Topology is already shutting down."));
        }

        this.isShuttingDown = true;
        // disable heartbeat
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }

        const shutdownTasks = () => {
            const tasks = [];
            for (const spout of this.spouts) {
                tasks.push(xcallback => {
                    try {
                        spout.shutdown(xcallback);
                    } catch (e) {
                        xcallback(e);
                    }
                });
            }
            for (const bolt of this.bolts) {
                tasks.push(xcallback => {
                    try {
                        bolt.shutdown(xcallback);
                    } catch (e) {
                        xcallback(e);
                    }
                });
            }
            if (this.config.general.shutdown) {
                const factory = module_path => {
                    return xcallback => {
                        try {
                            require(module_path).shutdown(xcallback);
                        } catch (e) {
                            xcallback(e);
                        }
                    };
                };
                for (const shutdown_conf of this.config.general.shutdown) {
                    if (shutdown_conf.disabled) {
                        continue; // skip if disabled
                    }
                    const dir = path.resolve(shutdown_conf.working_dir); // path may be relative to current working dir
                    const module_path = path.join(dir, shutdown_conf.cmd);
                    tasks.push(factory(module_path));
                }
            }
            async.series(tasks, (e: Error) => {
                // call hard shutdown regardless of the error
                if (this.config.general.shutdown_hard) {
                    try {
                        this.shutdownHard();
                    } catch (e) {
                        log.logger().exception(e);
                        /* do nothing extra */
                    }
                }
                callback(e);
            });
        };
        if (this.isRunning) {
            this.pause(err => {
                if (err) {
                    // only possible error is when isInit is false
                    log.logger().error("THIS SHOULD NOT HAPPEN!");
                    log.logger().exception(err);
                    return callback(err);
                }
                shutdownTasks();
            });
        } else {
            shutdownTasks();
        }
    }

    /** Runs hard-core shutdown sequence */
    public shutdownHard() {
        if (this.config.general.shutdown_hard) {
            if (this.shutdownHardCalled) {
                return;
            }
            this.shutdownHardCalled = true;
            for (const shutdown_conf of this.config.general.shutdown_hard) {
                try {
                    if (shutdown_conf.disabled) {
                        continue; // skip if disabled
                    }
                    const dir = path.resolve(shutdown_conf.working_dir); // path may be relative to current working dir
                    const module_path = path.join(dir, shutdown_conf.cmd);
                    require(module_path).shutdown_hard();
                } catch (e) {
                    log.logger().exception(e);
                    // just swallow the error
                }
            }
        }
    }

    /** Returns uuid of the topology that is running. */
    public getUuid(): string {
        return this.uuid;
    }

    /** This method redirects/broadcasts message from source to other nodes.
     * It is done in async/parallel manner.
     * @param {string} source - Name of the source that emitted this data
     * @param {Object} data - Data content of the message
     * @param {string} stream_id - Name of the stream that this data belongs to
     * @param {Function} callback - standard callback
     */
    private async redirect(source: string, data: any, stream_id: string): Promise<void> {
        const destinations = this.router.getDestinationsForSource(source, stream_id);
        // by default, each successor should receive a copy of current message
        // this encapsulates down-stream processing and changes.
        // This behavoir is opt-out, using "pass_binary_messages".
        const s = JSON.stringify(data);
        for (const destination of destinations) {
            let data_clone = data;
            if (!this.pass_binary_messages) {
                data_clone = JSON.parse(s);
            }
            const bolt = this.getBolt(destination);
            await bolt.receive(data_clone, stream_id);
        }
    }

    /** Find bolt with given name.
     * @param {string} name - Name of the bolt that we need to find
     */
    private getBolt(name: string) {
        const hits = this.bolts.filter(x => x.getName() == name);
        if (hits.length === 0) {
            return null;
        }
        return hits[0];
    }

    /** This method optionally runs context initialization code
     * and returns the context object.
     */
    private async initContext(): Promise<any> {
        if (this.config.general.initialization) {
            const common_context = {};
            for (const init_conf of this.config.general.initialization) {
                if (init_conf.disabled) {
                    continue;
                }
                const dir = path.resolve(init_conf.working_dir); // path may be relative to current working dir
                const module_path = path.join(dir, init_conf.cmd);
                init_conf.init = init_conf.init || {};
                init_conf.init.$name = this.uuid;
                await require(module_path).init(init_conf.init, common_context);
            }
            return common_context;
        } else {
            return {};
        }
    }
}

//////////////////////////////////////////////////////////////////////////////////////////////////

/** This function injects override values into variables section of the configuration. */
function injectOverrides(config: any, overrides: any) {
    config.variables = config.variables || {};
    for (const f in overrides) {
        if (overrides.hasOwnProperty(f)) {
            config.variables[f] = overrides[f];
        }
    }
}

/** This functin is used for running topology localy */
export async function runLocalTopologyFromFile(file_name: string, overrides?: any): Promise<(code: number) => void> {
    let config = readJsonFileSync(file_name);
    validate({ config, exitOnError: true });
    injectOverrides(config, overrides || {});

    const comp = new TopologyCompiler(config);
    comp.compile();
    config = comp.getWholeConfig();
    let topology = new TopologyLocal();

    await topology.init("topology.1", config);
    console.log("Init done");
    topology.run();
}
        ],
err => {
    if (err) {
        console.log("Error in shutdown", err);
    }
    console.log("Running");
}
    );

function shutdown(exit_code: number) {
    if (topology) {
        topology.shutdown(err => {
            if (err) {
                console.log("Error", err);
            }
            process.exit(exit_code);
        });
        topology = null;
    }
}

// do something when app is closing
process.on("exit", () => { shutdown(0); });

// catches ctrl+c event
process.on("SIGINT", () => {
    console.log("SIGINT received, shutting down...");
    shutdown(1);
});

// catches uncaught exceptions
process.on("uncaughtException", e => {
    console.log("Uncaught exception found");
    console.log(e);
    process.exit(1);
});

return shutdown;
}
