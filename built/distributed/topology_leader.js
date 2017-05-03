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
const lb = require("../util/load_balance");
const utils = require("../util/helpers");
/** This class handles leader-status determination and
 * performs leadership tasks if marked as leader.
 */
class TopologyLeader {
    /** Simple constructor */
    constructor(name, storage) {
        this.storage = storage;
        this.name = name;
        this.isRunning = false;
        this.shutdownCallback = null;
        this.isLeader = false;
        this.loopTimeout = 3 * 1000; // 3 seconds for refresh
    }
    /** Runs main loop that handles leadership detection */
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            let self = this;
            self.isRunning = true;
            while (self.isRunning) {
                if (self.isLeader) {
                    self.performLeaderLoop();
                }
                else {
                    self.checkIfLeader();
                }
                yield utils.delay(self.loopTimeout);
            }
            if (self.shutdownCallback) {
                self.shutdownCallback();
            }
        });
    }
    /** Shut down the loop */
    shutdown() {
        let self = this;
        return new Promise((resolve, reject) => {
            self.shutdownCallback = resolve;
            self.isRunning = false;
        });
    }
    /** Single step in checking if current node should be
     * promoted into leadership role.
     **/
    checkIfLeader() {
        return __awaiter(this, void 0, void 0, function* () {
            let self = this;
            let res = yield self.storage.getLeadershipStatus();
            if (res.leadership == "ok")
                return;
            if (res.leadership == "pending")
                return;
            // status is vacant
            yield self.storage.announceLeaderCandidacy(self.name);
            let is_leader = yield self.storage.checkLeaderCandidacy(self.name);
            self.isLeader = is_leader;
            if (self.isLeader) {
                console.log("[Leader] This worker became a leader...");
            }
        });
    }
    /** Single step in performing leadership role.
     * Checks work statuses and redistributes topologies from dead
     * to alive workers.
     */
    performLeaderLoop() {
        return __awaiter(this, void 0, void 0, function* () {
            let self = this;
            let alive_workers = null;
            let workers = yield self.storage.getWorkerStatus();
            // each worker: name, status, topology_count
            // possible statuses: alive, dead, unloaded
            let dead_workers = workers
                .filter(x => x.status === "dead")
                .map(x => x.name);
            alive_workers = workers
                .filter(x => x.status === "alive");
            if (alive_workers.length >= 0) {
                for (let dead_worker of dead_workers) {
                    yield self.handleDeadWorker(dead_worker);
                }
            }
            if (alive_workers.length == 0) {
                return;
            }
            let topologies = yield self.storage.getTopologyStatus();
            // each topology: name, status
            // possible statuses: unassigned, waiting, running, error, stopped
            let unassigned_topologies = topologies
                .filter(x => x.status === "unassigned" || x.status === "stopped")
                .map(x => x.uuid);
            if (unassigned_topologies.length > 0) {
                console.log("[Leader] Found unassigned topologies:", unassigned_topologies);
            }
            let load_balancer = new lb.LoadBalancer(alive_workers.map(x => { return { name: x.name, weight: x.topology_count }; }));
            for (let unassigned_topology of unassigned_topologies) {
                let target = load_balancer.next();
                console.log(`[Leader] Assigning topology ${unassigned_topology} to worker ${target}`);
                yield self.storage.assignTopology(unassigned_topology, target);
            }
        });
    }
    /** Handles situation when there is a dead worker and its
     * topologies need to be re-assigned to other servers.
     */
    handleDeadWorker(dead_worker) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("[Leader] Handling dead worker", dead_worker);
            let self = this;
            let topologies = yield self.storage.getTopologiesForWorker(dead_worker);
            for (let topology of topologies) {
                console.log("[Leader] Unassigning topology", topology.uuid);
                yield self.storage.setTopologyStatus(topology.uuid, "unassigned", null);
            }
            ;
            //console.log("[Leader] Error while handling dead worker", err);
            console.log("[Leader] Setting dead worker as unloaded", dead_worker);
            yield self.storage.setWorkerStatus(dead_worker, "unloaded");
        });
    }
}
exports.TopologyLeader = TopologyLeader;
//# sourceMappingURL=topology_leader.js.map