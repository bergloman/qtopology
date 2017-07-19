"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const log = require("../../util/logger");
//////////////////////////////////////////////////////////////////////
class FileCoordinator {
    constructor(dir_name, file_pattern) {
        this.msgs = [];
        this.dir_name = dir_name;
        this.dir_name = path.resolve(this.dir_name);
        this.file_patterns = (typeof file_pattern === "string" ? [file_pattern] : file_pattern);
        this.file_patterns_regex = this.file_patterns
            .map(x => this.createRegexpForPattern(x));
        this.topology_configs = new Map();
        let items = fs.readdirSync(this.dir_name);
        log.logger().log("[FileCoordinator] Starting file-based coordination, from directory " + this.dir_name);
        for (let item of items) {
            let is_ok = false;
            for (let pattern of this.file_patterns_regex) {
                if (item.match(pattern)) {
                    is_ok = true;
                    continue;
                }
            }
            if (!is_ok) {
                continue;
            }
            let topology_uuid = item.slice(0, -path.extname(item).length); // file name without extension
            log.logger().log("[FileCoordinator] Found topology file " + item);
            let config = require(path.join(this.dir_name, item));
            this.msgs.push({
                cmd: "start",
                content: {
                    uuid: topology_uuid,
                    config: config
                }
            });
            this.topology_configs.set(topology_uuid, config);
        }
    }
    getProperties(callback) {
        let res = [];
        res.push({ key: "type", value: "FileCoordinator" });
        res.push({ key: "directory", value: this.dir_name });
        res.push({ key: "file_patterns", value: this.file_patterns });
        res.push({ key: "file_patterns_regex", value: this.file_patterns_regex });
        callback(null, res);
    }
    getMessages(name, callback) {
        let tmp = this.msgs;
        this.msgs = [];
        callback(null, tmp);
    }
    getWorkerStatus(callback) {
        callback(null, []);
    }
    getTopologyStatus(callback) {
        callback(null, []);
    }
    getTopologyDefinition(uuid, callback) {
        if (this.topology_configs.has(uuid)) {
            callback(null, this.topology_configs.get(uuid));
        }
        else {
            callback(new Error("Topology with given uuid doesn't exist: " + uuid));
        }
    }
    getTopologiesForWorker(worker, callback) {
        callback(null, []);
    }
    getLeadershipStatus(callback) {
        callback(null, { leadership: "ok" });
    }
    registerWorker(name, callback) {
        callback(null);
    }
    announceLeaderCandidacy(name, callback) {
        callback(null);
    }
    checkLeaderCandidacy(name, callback) {
        callback(null);
    }
    assignTopology(uuid, worker, callback) {
        callback(null);
    }
    setTopologyStatus(uuid, status, error, callback) {
        log.logger().log(`[FileCoordinator] Setting topology status: uuid=${uuid} status=${status} error=${error}`);
        callback(null);
    }
    setWorkerStatus(worker, status, callback) {
        log.logger().log(`[FileCoordinator] Setting worker status: name=${worker} status=${status}`);
        callback(null);
    }
    registerTopology(uuid, config, callback) {
        callback(new Error("Operation not supported by this storage: registerTopology"));
    }
    disableTopology(uuid, callback) {
        callback(new Error("Operation not supported by this storage: disableTopology"));
    }
    enableTopology(uuid, callback) {
        callback(new Error("Operation not supported by this storage: enableTopology"));
    }
    deleteTopology(uuid, callback) {
        callback(new Error("Operation not supported by this storage: deleteTopology"));
    }
    createRegexpForPattern(str) {
        if (!str)
            return /.*/g;
        str = str
            .replace(/\./g, "\.")
            .replace(/\*/g, ".*");
        return new RegExp("^" + str + "$", "gi");
    }
}
exports.FileCoordinator = FileCoordinator;
//# sourceMappingURL=file_coordinator.js.map