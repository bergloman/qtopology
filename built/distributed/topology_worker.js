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
const tlp = require("./topology_local_proxy");
const coord = require("./topology_coordinator");
const comp = require("../topology_compiler");
class TopologyItem {
}
/** This class handles topology worker - singleton instance on
 * that registers with coordination storage, receives instructions from
 * it and runs assigned topologies as subprocesses.
*/
class TopologyWorker {
    /** Initializes this object */
    constructor(name, storage) {
        this.name = name;
        this.coordinator = new coord.TopologyCoordinator(name, storage);
        this.topologies = [];
        let self = this;
        self.coordinator.on("start", (msg) => __awaiter(this, void 0, void 0, function* () {
            console.log("[Worker] Received start instruction from coordinator");
            yield self.start(msg.uuid, msg.config);
        }));
        self.coordinator.on("shutdown", (msg) => __awaiter(this, void 0, void 0, function* () {
            console.log("[Worker] Received shutdown instruction from coordinator");
            yield self.shutdown();
        }));
    }
    /** Starts this worker */
    run() {
        this.coordinator.run();
    }
    /** Starts single topology */
    start(uuid, config) {
        return __awaiter(this, void 0, void 0, function* () {
            let compiler = new comp.TopologyCompiler(config);
            compiler.compile();
            config = compiler.getWholeConfig();
            let self = this;
            if (self.topologies.filter(x => x.uuid === uuid).length > 0) {
                yield self.coordinator.reportTopology(uuid, "error", "Topology with this UUID already exists: " + uuid);
                return;
            }
            let rec = new TopologyItem();
            rec.uuid = uuid;
            rec.config = config;
            self.topologies.push(rec);
            rec.proxy = new tlp.TopologyLocalProxy((err) => {
                if (!rec.proxy.wasShutDown()) {
                    if (err) {
                        self.coordinator.reportTopology(uuid, "error", "" + err);
                    }
                    else {
                        self.coordinator.reportTopology(uuid, "stopped", "" + err);
                    }
                }
                self.removeTopology(uuid);
            });
            try {
                yield rec.proxy.init(config);
            }
            catch (err) {
                self.removeTopology(uuid);
                self.coordinator.reportTopology(uuid, "error", "" + err);
                return;
            }
            try {
                yield rec.proxy.run();
            }
            catch (err) {
                self.removeTopology(uuid);
                self.coordinator.reportTopology(uuid, "error", "" + err);
            }
            yield self.coordinator.reportTopology(uuid, "running", "");
        });
    }
    /** Remove specified topology from internal list */
    removeTopology(uuid) {
        this.topologies = this.topologies.filter(x => x.uuid != uuid);
    }
    /** Shuts down the worker and all its subprocesses. */
    shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            let self = this;
            for (let item of self.topologies) {
                yield item.proxy.shutdown();
                //    console.log("[Worker] Error while shutting down topology", item.uuid, err);
                yield self.coordinator.reportTopology(item.uuid, "stopped", "");
            }
            //console.log("[Worker] Error while shutting down topologies:", err);
            yield self.coordinator.shutdown();
        });
    }
}
exports.TopologyWorker = TopologyWorker;
//# sourceMappingURL=topology_worker.js.map