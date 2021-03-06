import * as path from "path";
import * as http from "http";

import * as intf from "../../topology_interfaces";
import * as http_server from "../../util/http_server";
import * as leader from "../topology_leader";

//////////////////////////////////////////////////////////////////////

/**
 * List of options for QTopologyDashboard
 */
export interface IDashboardServerOptions {
    /** Storage where the data is located */
    storage: intf.ICoordinationStorage;
    /** Port number where the stand-alone table should run. Optional. */
    port?: number;
    /** Express application to inject routes into. Optional. */
    app?: any;
    /** Path prefix to use when injecting into Express. Optional */
    prefix?: string;
    /** Page title. Optional */
    title?: string;
    /** Link url to parent page. Optional */
    back_url?: string;
    /** Link text to parent page. Optional */
    back_title?: string;
    /** Custom properties to present in GUI */
    custom_props?: intf.IStorageProperty[];
}

/**
 * Class for handling QTopology dashboard, either as stand-alone web server or
 * via injection into Express application.
 */
export class DashboardServer {
    /** Custom properties to present in GUI */
    public custom_props: intf.IStorageProperty[];

    /** Custom page title. Optional */
    private title?: string;
    /** Link url to parent page. Optional */
    private back_url?: string;
    /** Link text to parent page. Optional */
    private back_title?: string;
    /** Port number where the stand-alone table should run. */
    private port: number;
    /** Storage where the data is located */
    private storage: intf.ICoordinationStorage;
    /** Stand-alone web server */
    private server: http_server.MinimalHttpServer;

    /** Simple constructor */
    constructor() {
        this.storage = null;
        this.port = null;
        this.server = null;
        this.back_title = null;
        this.back_url = null;
        this.title = null;
        this.custom_props = [];
    }

    /**
     * The most flexible initialization method
     * @param options - object containing options for dashboard
     * @param callback - standard callback
     */
    public initComplex(options: IDashboardServerOptions, callback: intf.SimpleCallback) {
        const self = this;
        self.port = options.port;
        self.back_title = options.back_title;
        self.back_url = options.back_url;
        self.title = options.title;
        self.custom_props = options.custom_props || [];
        self.initCommon(options.storage, err => {
            if (err) { return callback(err); }
            if (options.app) {
                const app = options.app;
                const prefix = options.prefix;
                const prepareAddr = url => {
                    return url.replace(`/${prefix}`, "");
                };

                app.get(`/${prefix}`, (req, res) => {
                    res.redirect(`/${prefix}/qtopology_dashboard.html`);
                });
                app.get(`/${prefix}/*`, (req, res) => {
                    self.handle(req.method, prepareAddr(req.url), req.body, res);
                });
                app.post(`/${prefix}/*`, (req, res) => {
                    self.handle(req.method, prepareAddr(req.url), req.body, res);
                });
            }
            callback();
        });
    }

    /**
     * Simple method for initialization as stand-alone server
     * @param port - Port where stand-alone table should run
     * @param storage - Storage object
     * @param callback - Standard callback
     */
    public init(port: number, storage: intf.ICoordinationStorage, callback: intf.SimpleCallback) {
        this.initComplex({ port, storage }, callback);
    }

    /**
     * Simple method for injection into Express application
     * @param app - Express application where routes should be injected
     * @param prefix - Injection prefix
     * @param storage - Storage object
     * @param callback - Standard callback
     */
    public initForExpress(app: any, prefix: string, storage: intf.ICoordinationStorage, callback: intf.SimpleCallback) {
        const self = this;
        self.initComplex({ app, prefix, storage }, err => {
            if (err) { return callback(err); }

            const prepareAddr = url => {
                return url.replace(`/${prefix}`, "");
            };

            app.get(`/${prefix}`, (req, res) => {
                res.redirect(`/${prefix}/qtopology_dashboard.html`);
            });
            app.get(`/${prefix}/*`, (req, res) => {
                self.handle(req.method, prepareAddr(req.url), req.body, res);
            });
            app.post(`/${prefix}/*`, (req, res) => {
                self.handle(req.method, prepareAddr(req.url), req.body, res);
            });
            callback();
        });
    }

    /** Runs the stand-alone server */
    public run() {
        this.server.run(this.port);
    }

    /** Handles requests */
    public handle(method: string, addr: string, body: any, resp: http.ServerResponse) {
        this.server.handle(method, addr, body, resp);
    }

    /** Internal initialization step */
    private initCommon(storage: intf.ICoordinationStorage, callback_outer: intf.SimpleCallback) {
        const self = this;
        self.storage = storage;
        self.server = new http_server.MinimalHttpServer("[QTopology Dashboard]");

        // first register static files
        let static_dir = path.join(__dirname, "../../../resources/gui/");
        static_dir = path.resolve(static_dir);
        self.server.addDirectory(static_dir);
        self.server.addRoute("/", path.join(static_dir, "qtopology_dashboard.html"));

        // now add REST handlers
        self.server.addHandler("worker-status", (data, callback) => {
            self.storage.getWorkerStatus(callback);
        });
        self.server.addHandler("topology-status", (data, callback) => {
            self.storage.getTopologyStatus(callback);
        });
        self.server.addHandler("register-topology", (data, callback) => {
            self.storage.registerTopology(data.uuid, data.config, callback);
        });
        self.server.addHandler("clear-topology-error", (data, callback) => {
            leader.TopologyLeader.clearTopologyError(data.uuid, self.storage, callback);
        });
        self.server.addHandler("disable-topology", (data, callback) => {
            self.storage.disableTopology(data.uuid, callback);
        });
        self.server.addHandler("enable-topology", (data, callback) => {
            self.storage.enableTopology(data.uuid, callback);
        });
        self.server.addHandler("stop-topology", (data, callback) => {
            self.storage.stopTopology(data.uuid, callback);
        });
        self.server.addHandler("kill-topology", (data, callback) => {
            self.storage.killTopology(data.uuid, callback);
        });
        self.server.addHandler("topology-info", (data, callback) => {
            self.storage.getTopologyInfo(data.uuid, callback);
        });
        self.server.addHandler("topology-history", (data, callback) => {
            self.storage.getTopologyHistory(data.uuid, callback);
        });
        self.server.addHandler("worker-history", (data, callback) => {
            self.storage.getWorkerHistory(data.name, callback);
        });
        self.server.addHandler("delete-worker", (data, callback) => {
            self.storage.deleteWorker(data.name, callback);
        });
        self.server.addHandler("shut-down-worker", (data, callback) => {
            self.storage.sendMessageToWorker(
                data.name, intf.CONSTS.LeaderMessages.shutdown, {}, data.valid_msec || 60 * 1000, callback);
        });
        self.server.addHandler("enable-worker", (data, callback) => {
            self.storage.sendMessageToWorker(
                data.name, intf.CONSTS.LeaderMessages.set_enabled, {}, data.valid_msec || 60 * 1000, callback);
        });
        self.server.addHandler("disable-worker", (data, callback) => {
            self.storage.sendMessageToWorker(
                data.name, intf.CONSTS.LeaderMessages.set_disabled, {}, data.valid_msec || 60 * 1000, callback);
        });
        self.server.addHandler("rebalance-leader", (data, callback) => {
            self.storage.sendMessageToWorker(
                data.name, intf.CONSTS.LeaderMessages.rebalance, {}, data.valid_msec || 60 * 1000, callback);
        });
        self.server.addHandler("storage-info", (data, callback) => {
            self.storage.getProperties((err, props) => {
                callback(err, {
                    custom: self.custom_props,
                    storage: props
                });
            });
        });
        self.server.addHandler("display-data", (data, callback) => {
            callback(null, {
                back_title: this.back_title,
                back_url: this.back_url,
                title: this.title
            });
        });
        self.server.addHandler("msg-queue-content", (data, callback) => {
            self.storage.getMsgQueueContent((err, data_inner) => {
                if (err) { return callback(err); }
                const res = data_inner.map(x => {
                    return {
                        cmd: x.cmd,
                        content: x.data,
                        ts: x.created.getTime(),
                        valid_until: x.valid_until.getTime(),
                        worker: x.name
                    };
                });
                callback(null, { data: res });
            });
        });
        callback_outer();
    }
}
