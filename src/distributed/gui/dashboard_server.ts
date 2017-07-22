import * as path from "path";
import * as fs from "fs";

import * as intf from "../../topology_interfaces";
import * as log from "../../util/logger";
import * as http_server from "../../util/http_server";

//////////////////////////////////////////////////////////////////////

export class DashboardServer {

    private port: number;
    private storage: intf.CoordinationStorage;
    private server: http_server.MinimalHttpServer;

    constructor() {
        this.storage = null;
        this.port = null;
        this.server = null;
    }

    init(port: number, storage: intf.CoordinationStorage, callback: intf.SimpleCallback) {
        let self = this;
        self.port = port;
        self.storage = storage;
        self.server = new http_server.MinimalHttpServer();

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
            self.storage.clearTopologyError(data.uuid, callback);
        });
        self.server.addHandler("disable-topology", (data, callback) => {
            self.storage.disableTopology(data.uuid, callback);
        });
        self.server.addHandler("enable-topology", (data, callback) => {
            self.storage.enableTopology(data.uuid, callback);
        });
        self.server.addHandler("storage-info", (data, callback) => {
            self.storage.getProperties((err, props) => {
                callback(err, { data: props });
            });
        });
        callback();
    }

    run() {
        this.server.run(this.port);
    }
}
