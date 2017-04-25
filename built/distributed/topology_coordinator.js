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
const leader = require("./topology_leader");
const EventEmitter = require("events");
const utils = require("../util/helpers");
/** This class handles communication with topology coordination storage.
 */
class TopologyCoordinator extends EventEmitter {
    /** Simple constructor */
    constructor(name, storage) {
        super();
        this.storage = storage;
        this.name = name;
        this.leadership = new leader.TopologyLeader(this.name, this.storage);
        this.isRunning = false;
        this.shutdownCallback = null;
        this.loopTimeout = 2 * 1000; // 2 seconds for refresh
    }
    /** Runs main loop */
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            let self = this;
            self.isRunning = true;
            yield self.storage.registerWorker(self.name);
            self.leadership.run();
            while (self.isRunning) {
                yield self.handleIncommingRequests();
                yield utils.delay(self.loopTimeout);
            }
            console.log("[Coordinator] Coordinator shutdown finished.");
            if (self.shutdownCallback) {
                self.shutdownCallback();
            }
        });
    }
    /** Shut down the loop */
    shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            let self = this;
            yield self.reportWorker(self.name, "dead", "");
            yield self.leadership.shutdown();
            console.log("[Coordinator] Coordinator set for shutdown");
            return new Promise((resolve, reject) => {
                self.shutdownCallback = resolve;
                self.isRunning = false;
            });
        });
    }
    /** Set status on given topology */
    reportTopology(uuid, status, error) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.storage.setTopologyStatus(uuid, status, error);
            }
            catch (err) {
                console.log("[Coordinator] Couldn't report topology status");
                console.log("Topology:", uuid, status, error);
                console.log("Error:", err);
            }
        });
    }
    /** Set status on given worker */
    reportWorker(name, status, error) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.storage.setWorkerStatus(name, status);
            }
            catch (err) {
                console.log("[Coordinator] Couldn't report worker status");
                console.log("Worker:", name, status);
                console.log("Error:", err);
            }
        });
    }
    /** This method checks for new messages from coordination storage. */
    handleIncommingRequests() {
        return __awaiter(this, void 0, void 0, function* () {
            let self = this;
            let msgs = yield self.storage.getMessages(self.name);
            let promises = [];
            for (let msg of msgs) {
                if (msg.cmd === "start") {
                    self.emit("start", msg.content);
                }
                if (msg.cmd === "shutdown") {
                    self.emit("shutdown", {});
                }
            }
            return Promise.resolve();
        });
    }
}
exports.TopologyCoordinator = TopologyCoordinator;
//# sourceMappingURL=topology_coordinator.js.map